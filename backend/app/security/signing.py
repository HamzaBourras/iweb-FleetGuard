import hashlib
import hmac
import time


MAX_SKEW_SECONDS = 300
_seen: dict[str, float] = {}


def _message(method: str, route: str, timestamp: int | str, body: bytes) -> str:
    return "\n".join(
        [method.upper(), route, str(timestamp), hashlib.sha256(body).hexdigest()]
    )


def sign_headers(token: str, method: str, route: str, body: bytes = b"") -> dict[str, str]:
    timestamp = str(int(time.time()))
    signature = hmac.new(
        token.encode(),
        _message(method, route, timestamp, body).encode(),
        hashlib.sha256,
    ).hexdigest()
    return {"X-Iweb-Timestamp": timestamp, "X-Iweb-Signature": signature}


def verify_signature(
    token: str,
    method: str,
    route: str,
    timestamp: str | None,
    signature: str | None,
    body: bytes,
) -> bool:
    try:
        timestamp_int = int(timestamp)
    except (TypeError, ValueError):
        return False

    now = time.time()
    if abs(now - timestamp_int) > MAX_SKEW_SECONDS or not signature:
        return False

    expected = hmac.new(
        token.encode(),
        _message(method, route, timestamp_int, body).encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        return False

    expired = [key for key, expiry in _seen.items() if expiry < now]
    for key in expired:
        del _seen[key]
    if signature in _seen:
        return False
    _seen[signature] = now + MAX_SKEW_SECONDS + 30
    return True
