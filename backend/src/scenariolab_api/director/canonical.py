from __future__ import annotations

import json
from hashlib import sha256
from typing import Any

from pydantic import BaseModel


def canonical_json_bytes(value: BaseModel | Any) -> bytes:
    """Serialize strict model data into the Director's canonical JSON form."""
    if isinstance(value, BaseModel):
        value = value.model_dump(mode="json")
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    ).encode("utf-8")


def digest(value: BaseModel | Any, *, domain: str) -> str:
    prefix = f"scenariolab/{domain}/v1\0".encode("utf-8")
    return sha256(prefix + canonical_json_bytes(value)).hexdigest()
