from __future__ import annotations

from collections import OrderedDict, deque
from hashlib import sha256
from threading import BoundedSemaphore, Lock
from time import monotonic

from scenariolab_api.ai.models import (
    BriefingContent,
    BriefingContext,
    BriefingResponse,
)
from scenariolab_api.ai.provider import AIProvider, OpenAICompatibleProvider, ProviderError
from scenariolab_api.config import Settings


class ProviderCallLimiter:
    """Small per-process, per-caller guard against accidental provider call floods."""

    def __init__(self, calls_per_minute: int, max_callers: int = 1_024) -> None:
        self._limit = calls_per_minute
        self._max_callers = max_callers
        self._calls: OrderedDict[str, deque[float]] = OrderedDict()
        self._lock = Lock()

    def allow(self, caller_key: str) -> bool:
        now = monotonic()
        cutoff = now - 60.0
        with self._lock:
            calls = self._calls.setdefault(caller_key, deque())
            self._calls.move_to_end(caller_key)
            while calls and calls[0] <= cutoff:
                calls.popleft()
            if len(calls) >= self._limit:
                return False
            calls.append(now)
            while len(self._calls) > self._max_callers:
                self._calls.popitem(last=False)
            return True


class BriefingService:
    def __init__(
        self,
        provider: AIProvider | None,
        *,
        calls_per_minute: int = 20,
        cache_entries: int = 256,
        max_concurrent_provider_calls: int = 2,
    ) -> None:
        self._provider = provider
        self._limiter = ProviderCallLimiter(calls_per_minute)
        self._cache_entries = cache_entries
        self._provider_slots = BoundedSemaphore(max_concurrent_provider_calls)
        self._cache: OrderedDict[str, BriefingContent] = OrderedDict()
        self._cache_lock = Lock()

    def generate(
        self,
        context: BriefingContext,
        *,
        caller_key: str = "unknown",
    ) -> BriefingResponse:
        cache_key = sha256(context.model_dump_json().encode("utf-8")).hexdigest()
        cached = self._get_cached(cache_key)
        if cached is not None:
            return BriefingResponse(source="live", **cached.model_dump())
        if self._provider is None or not self._limiter.allow(caller_key):
            return _fallback_briefing(context)
        if not self._provider_slots.acquire(blocking=False):
            return _fallback_briefing(context)
        try:
            briefing = self._provider.generate_briefing(context)
        except ProviderError:
            return _fallback_briefing(context)
        finally:
            self._provider_slots.release()
        self._set_cached(cache_key, briefing)
        return BriefingResponse(source="live", **briefing.model_dump())

    def _get_cached(self, key: str) -> BriefingContent | None:
        with self._cache_lock:
            value = self._cache.get(key)
            if value is not None:
                self._cache.move_to_end(key)
            return value

    def _set_cached(self, key: str, value: BriefingContent) -> None:
        with self._cache_lock:
            self._cache[key] = value
            self._cache.move_to_end(key)
            while len(self._cache) > self._cache_entries:
                self._cache.popitem(last=False)


def create_briefing_service(settings: Settings) -> BriefingService:
    provider: AIProvider | None = None
    api_key = settings.ai_api_key.get_secret_value() if settings.ai_api_key else ""
    if settings.ai_enabled and api_key and settings.ai_model:
        provider = OpenAICompatibleProvider(
            api_key=api_key,
            model=settings.ai_model,
            base_url=str(settings.ai_base_url),
            timeout_seconds=settings.ai_timeout_seconds,
            max_response_tokens=settings.ai_max_response_tokens,
        )
    return BriefingService(
        provider,
        calls_per_minute=settings.ai_provider_calls_per_minute,
        max_concurrent_provider_calls=settings.ai_max_concurrent_provider_calls,
    )


def _fallback_briefing(context: BriefingContext) -> BriefingResponse:
    event = context.triggered_event
    headline = (
        f"{event.title} Shapes the Latest Turn"
        if event is not None
        else f"{context.selected_action_title} Sets the Course"
    )
    situation = (
        f"The team chose {context.selected_action_title}: "
        f"{context.selected_action_description}"
    )
    if event is not None:
        situation += f" The simulation also recorded {event.title}."

    changed = [change for change in context.metric_changes if change.delta != 0]
    if changed:
        movements = ", ".join(
            f"{change.title} {'increased' if change.delta > 0 else 'decreased'}"
            for change in changed
        )
        consequence = f"The authoritative engine recorded these movements: {movements}."
    else:
        consequence = "The authoritative engine recorded no metric movement this turn."

    unfavorable = [
        change.title
        for change in changed
        if change.favorable_direction.value != "neutral"
        and (
            (change.delta < 0 and change.favorable_direction.value == "higher")
            or (change.delta > 0 and change.favorable_direction.value == "lower")
        )
    ]
    if unfavorable:
        insight = f"Keep close watch on {', '.join(unfavorable)} after this tradeoff."
    else:
        insight = "The recorded tradeoff avoided an immediately unfavorable metric direction."
    teaser = (
        "A future turn may test whether this choice remains resilient as conditions change."
    )
    return BriefingResponse(
        source="fallback",
        headline=headline,
        situation_summary=situation,
        consequence_explanation=consequence,
        strategic_insight=insight,
        next_turn_teaser=teaser,
    )
