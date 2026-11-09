from __future__ import annotations

import logging
from enum import StrEnum

from pydantic import ValidationError


class DirectorDiagnosticCode(StrEnum):
    PROVIDER_UNAVAILABLE = "provider_unavailable"
    PROVIDER_RATE_LIMITED = "provider_rate_limited"
    PROVIDER_CONCURRENCY_LIMITED = "provider_concurrency_limited"
    PROVIDER_TRANSPORT_FAILURE = "provider_transport_failure"
    PROVIDER_TIMEOUT = "provider_timeout"
    PROVIDER_RESPONSE_TOO_LARGE = "provider_response_too_large"
    PROVIDER_RESPONSE_INCOMPLETE = "provider_response_incomplete"
    PROMPT_CONTEXT_LIMIT_EXCEEDED = "prompt_context_limit_exceeded"
    OUTPUT_TRUNCATED = "output_truncated"
    INVALID_JSON = "invalid_json"
    STRUCTURED_SCHEMA_FAILURE = "structured_schema_failure"
    UNKNOWN_METRIC = "unknown_metric"
    UNKNOWN_OPERATOR = "unknown_operator"
    EFFECT_LIMIT_VIOLATION = "effect_limit_violation"
    UNAFFORDABLE_CHOICE = "unaffordable_choice"
    SEMANTIC_VALIDATION_FAILURE = "semantic_validation_failure"


_LOGGER = logging.getLogger("scenariolab_api.director")


def record_director_diagnostic(code: DirectorDiagnosticCode) -> None:
    """Log a stable code only; never attach provider text, context, or exceptions."""

    _LOGGER.warning("director_generation_diagnostic code=%s", code.value)


def schema_diagnostic_code(error: ValidationError) -> DirectorDiagnosticCode:
    """Classify known structural failures without logging error inputs or messages."""

    for issue in error.errors(include_input=False):
        location = issue.get("loc", ())
        if issue.get("type") == "value_error":
            return DirectorDiagnosticCode.SEMANTIC_VALIDATION_FAILURE
        if (
            location
            and location[-1] == "operator"
            and issue.get("type") == "literal_error"
        ):
            return DirectorDiagnosticCode.UNKNOWN_OPERATOR
    return DirectorDiagnosticCode.STRUCTURED_SCHEMA_FAILURE
