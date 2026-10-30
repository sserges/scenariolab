from enum import StrEnum


class ScenarioCategory(StrEnum):
    BUSINESS = "business"
    CYBERSECURITY = "cybersecurity"
    SPACE = "space"
    CUSTOM = "custom"


class ScenarioSource(StrEnum):
    PREDEFINED = "predefined"
    PROMPT = "prompt"
    DOCUMENT = "document"
    URL = "url"


class AvailabilityStatus(StrEnum):
    AVAILABLE = "available"
    PLANNED = "planned"


class MetricKind(StrEnum):
    COUNT = "count"
    MONEY = "money"
    PERCENTAGE = "percentage"
    RESOURCE = "resource"
    SCORE = "score"


class MetricUnit(StrEnum):
    CENTS = "cents"
    PEOPLE = "people"
    USERS = "users"
    PERCENT = "percent"
    POINTS = "points"
    UNITS = "units"


class DisplayStyle(StrEnum):
    CURRENCY = "currency"
    NUMBER = "number"
    PERCENTAGE = "percentage"
    SCORE = "score"


class FavorableDirection(StrEnum):
    HIGHER = "higher"
    LOWER = "lower"
    NEUTRAL = "neutral"


class EffectOperator(StrEnum):
    ADD = "add"
    SUBTRACT = "subtract"
    MULTIPLY = "multiply"
    SET = "set"
    TRANSFER = "transfer"


class ComparisonOperator(StrEnum):
    LESS_THAN = "lt"
    LESS_THAN_OR_EQUAL = "lte"
    EQUAL = "eq"
    GREATER_THAN_OR_EQUAL = "gte"
    GREATER_THAN = "gt"


class ConditionReference(StrEnum):
    METRIC = "metric"
    TURN = "turn"
    ACTION_COUNT = "action-count"


class MatchLogic(StrEnum):
    ALL = "all"
    ANY = "any"


class TurnUnit(StrEnum):
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    YEAR = "year"


class GameStatus(StrEnum):
    NOT_STARTED = "not-started"
    ACTIVE = "active"
    WON = "won"
    LOST = "lost"
