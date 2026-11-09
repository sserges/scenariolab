from __future__ import annotations

from collections import OrderedDict
from hashlib import sha256
from threading import BoundedSemaphore, Lock

from pydantic import ValidationError

from scenariolab_api.ai.provider import (
    DirectorCandidateProvider,
    OpenAICompatibleProvider,
    ProviderError,
)
from scenariolab_api.ai.service import ProviderCallLimiter
from scenariolab_api.config import Settings
from scenariolab_api.director.canonical import canonical_json_bytes
from scenariolab_api.director.diagnostics import (
    DirectorDiagnosticCode,
    record_director_diagnostic,
    schema_diagnostic_code,
)
from scenariolab_api.director.models import (
    DirectorGeneratedProposal,
    DirectorGenerationContext,
)


class DirectorGenerationService:
    """One-attempt, process-local generation guard and exact-context cache."""

    def __init__(
        self,
        provider: DirectorCandidateProvider | None,
        *,
        calls_per_minute: int,
        max_concurrent_provider_calls: int,
        cache_entries: int = 128,
    ) -> None:
        self._provider = provider
        self._limiter = ProviderCallLimiter(calls_per_minute)
        self._provider_slots = BoundedSemaphore(max_concurrent_provider_calls)
        self._cache_entries = cache_entries
        self._cache: OrderedDict[str, DirectorGeneratedProposal] = OrderedDict()
        self._cache_lock = Lock()

    def get_cached(
        self,
        context: DirectorGenerationContext,
    ) -> DirectorGeneratedProposal | None:
        key = _context_key(context)
        with self._cache_lock:
            candidate = self._cache.get(key)
            if candidate is not None:
                self._cache.move_to_end(key)
            return candidate

    def generate_once(
        self,
        context: DirectorGenerationContext,
        *,
        caller_key: str,
    ) -> DirectorGeneratedProposal | None:
        """Make at most one provider attempt for this proposal request."""
        if self._provider is None:
            record_director_diagnostic(DirectorDiagnosticCode.PROVIDER_UNAVAILABLE)
            return None
        if not self._limiter.allow(caller_key):
            record_director_diagnostic(DirectorDiagnosticCode.PROVIDER_RATE_LIMITED)
            return None
        if not self._provider_slots.acquire(blocking=False):
            record_director_diagnostic(DirectorDiagnosticCode.PROVIDER_CONCURRENCY_LIMITED)
            return None
        try:
            return DirectorGeneratedProposal.model_validate(
                self._provider.generate_director_proposal(context)
            )
        except ProviderError as error:
            record_director_diagnostic(error.diagnostic_code)
            return None
        except ValidationError as error:
            record_director_diagnostic(schema_diagnostic_code(error))
            return None
        except ValueError:
            record_director_diagnostic(DirectorDiagnosticCode.INVALID_JSON)
            return None
        except Exception:
            # Provider details are deliberately not returned or logged here.
            record_director_diagnostic(DirectorDiagnosticCode.PROVIDER_TRANSPORT_FAILURE)
            return None
        finally:
            self._provider_slots.release()

    def cache_validated(
        self,
        context: DirectorGenerationContext,
        candidate: DirectorGeneratedProposal,
    ) -> None:
        key = _context_key(context)
        with self._cache_lock:
            self._cache[key] = candidate
            self._cache.move_to_end(key)
            while len(self._cache) > self._cache_entries:
                self._cache.popitem(last=False)


def create_director_generation_service(settings: Settings) -> DirectorGenerationService:
    provider: DirectorCandidateProvider | None = None
    api_key = settings.ai_api_key.get_secret_value() if settings.ai_api_key else ""
    if (
        settings.director_enabled
        and settings.director_live_generation_enabled
        and settings.ai_enabled
        and api_key.strip()
        and settings.ai_model
    ):
        provider = OpenAICompatibleProvider(
            api_key=api_key,
            model=settings.ai_model,
            base_url=str(settings.ai_base_url),
            timeout_seconds=settings.ai_timeout_seconds,
            max_response_tokens=settings.director_max_response_tokens,
        )
    return DirectorGenerationService(
        provider,
        calls_per_minute=settings.ai_provider_calls_per_minute,
        max_concurrent_provider_calls=settings.ai_max_concurrent_provider_calls,
    )


def _context_key(context: DirectorGenerationContext) -> str:
    return sha256(canonical_json_bytes(context)).hexdigest()
