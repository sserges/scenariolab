from __future__ import annotations

import base64
import binascii
import hmac
from collections.abc import Mapping

from pydantic import SecretStr

from scenariolab_api.config import Settings
from scenariolab_api.director.canonical import canonical_json_bytes, digest
from scenariolab_api.director.models import HMACSignature


class SigningUnavailable(Exception):
    pass


class InvalidSignature(Exception):
    pass


class DirectorSigner:
    """HMAC signing and verification for versioned Director records."""

    def __init__(
        self,
        keys: Mapping[str, SecretStr],
        active_key_id: str | None,
    ) -> None:
        self._keys = {
            key_id: secret.get_secret_value().encode("utf-8")
            for key_id, secret in keys.items()
        }
        self._active_key_id = active_key_id
        if (
            active_key_id is not None
            and (
                active_key_id not in self._keys
                or len(self._keys[active_key_id]) < 32
            )
        ):
            raise SigningUnavailable("Director signing configuration is unavailable")

    @classmethod
    def from_settings(cls, settings: Settings) -> DirectorSigner:
        if not settings.director_signing_keys or not settings.director_active_signing_key_id:
            raise SigningUnavailable("Director signing configuration is unavailable")
        return cls(
            settings.director_signing_keys,
            settings.director_active_signing_key_id,
        )

    def sign(self, payload: object, *, domain: str, key_id: str | None = None) -> HMACSignature:
        selected_key_id = key_id or self._active_key_id
        if selected_key_id is None or selected_key_id not in self._keys:
            raise SigningUnavailable("Director signing configuration is unavailable")
        message = self._message(payload, domain=domain, key_id=selected_key_id)
        mac = hmac.digest(self._keys[selected_key_id], message, "sha256")
        encoded = base64.urlsafe_b64encode(mac).decode("ascii").rstrip("=")
        return HMACSignature(key_id=selected_key_id, value=encoded)

    def verify(
        self,
        payload: object,
        signature: HMACSignature,
        *,
        domain: str,
    ) -> None:
        key = self._keys.get(signature.key_id)
        if key is None:
            raise InvalidSignature("Director record uses an unknown signing key")
        expected = hmac.digest(
            key,
            self._message(payload, domain=domain, key_id=signature.key_id),
            "sha256",
        )
        try:
            supplied = base64.urlsafe_b64decode(
                signature.value + "=" * (-len(signature.value) % 4)
            )
        except (ValueError, binascii.Error) as error:
            raise InvalidSignature("Director record signature is malformed") from error
        matches = hmac.compare_digest(expected, supplied)
        if len(supplied) != len(expected) or not matches:
            raise InvalidSignature("Director record signature is invalid")

    @staticmethod
    def proposal_digest(payload: object) -> str:
        return digest(payload, domain="director-proposal")

    @staticmethod
    def state_digest(state: object) -> str:
        return digest(state, domain="director-state")

    @staticmethod
    def result_digest(result: object) -> str:
        return digest(result, domain="director-result")

    @staticmethod
    def history_digest(history: object) -> str:
        return digest(history, domain="director-history")

    @staticmethod
    def context_digest(context: object) -> str:
        return digest(context, domain="director-context")

    @staticmethod
    def _message(payload: object, *, domain: str, key_id: str) -> bytes:
        return (
            f"scenariolab/{domain}/v1\0{key_id}\0".encode("utf-8")
            + canonical_json_bytes(payload)
        )
