from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from typing import Any

ASGIMessage = dict[str, Any]
Receive = Callable[[], Awaitable[ASGIMessage]]
Send = Callable[[ASGIMessage], Awaitable[None]]


class RequestBodyLimitMiddleware:
    """Bound buffered HTTP request bodies before JSON parsing and validation."""

    def __init__(self, app: Any, *, max_body_bytes: int) -> None:
        self.app = app
        self.max_body_bytes = max_body_bytes

    async def __call__(self, scope: dict[str, Any], receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        content_length = next(
            (
                value
                for name, value in scope.get("headers", [])
                if name.lower() == b"content-length"
            ),
            None,
        )
        if content_length is not None:
            try:
                if int(content_length) > self.max_body_bytes:
                    await _send_too_large(send)
                    return
            except ValueError:
                await _send_invalid_length(send)
                return

        messages: list[ASGIMessage] = []
        body_size = 0
        while True:
            message = await receive()
            messages.append(message)
            if message["type"] == "http.disconnect":
                break
            if message["type"] != "http.request":
                continue
            body_size += len(message.get("body", b""))
            if body_size > self.max_body_bytes:
                await _send_too_large(send)
                return
            if not message.get("more_body", False):
                break

        message_index = 0

        async def replay_receive() -> ASGIMessage:
            nonlocal message_index
            if message_index < len(messages):
                message = messages[message_index]
                message_index += 1
                return message
            return await receive()

        await self.app(scope, replay_receive, send)


async def _send_too_large(send: Send) -> None:
    await _send_json_error(
        send,
        413,
        "request_too_large",
        "Request body exceeds the configured size limit.",
    )


async def _send_invalid_length(send: Send) -> None:
    await _send_json_error(
        send,
        400,
        "invalid_content_length",
        "Content-Length must be a valid non-negative integer.",
    )


async def _send_json_error(send: Send, status_code: int, code: str, message: str) -> None:
    body = json.dumps({"detail": {"code": code, "message": message}}).encode("utf-8")
    await send(
        {
            "type": "http.response.start",
            "status": status_code,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode("ascii")),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body})
