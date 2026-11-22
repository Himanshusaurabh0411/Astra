import argparse
import hashlib
import hmac
import json
import secrets
from collections import deque
from getpass import getpass
from threading import Lock
from time import monotonic
from typing import Annotated

from fastapi import HTTPException, Request, Response
from pydantic import BaseModel, Field, TypeAdapter, ValidationError

from app.config import settings

COOKIE = "terrapulse_government"
SESSION_SECONDS = 8 * 60 * 60
ATTEMPT_WINDOW = 5 * 60
Email = Annotated[str, Field(max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")]


class Officer(BaseModel):
    email: Email
    agency: str = Field(min_length=2, max_length=120)


class Account(Officer):
    salt: str = Field(pattern=r"^[0-9a-f]{32}$")
    password_hash: str = Field(pattern=r"^[0-9a-f]{64}$", repr=False)


def derive_password(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=2**15, r=8, p=3, maxmem=64 * 1024**2, dklen=32)


def load_accounts() -> dict[str, Account]:
    raw_accounts = settings.GOVERNMENT_ACCOUNTS
    if not raw_accounts or not raw_accounts.get_secret_value().strip():
        return {}
    try:
        records = TypeAdapter(list[Account]).validate_json(raw_accounts.get_secret_value())
    except ValidationError:
        raise RuntimeError("GOVERNMENT_ACCOUNTS must contain a JSON array of provisioned accounts.") from None
    result = {account.email.lower(): account for account in records}
    if len(result) != len(records):
        raise RuntimeError("GOVERNMENT_ACCOUNTS contains duplicate email addresses.")
    return result


accounts = load_accounts()
_lock = Lock()
_attempts: deque[tuple[float, str]] = deque()
_sessions: dict[bytes, tuple[float, str]] = {}
_dummy_salt = secrets.token_bytes(16)


def require_trusted_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    allowed = {url.strip().rstrip("/") for url in settings.CORS_ORIGINS.split(",")}
    allowed.add(f"{request.url.scheme}://{request.url.netloc}")
    if request.headers.get("sec-fetch-site") == "cross-site" or (origin is not None and origin not in allowed):
        raise HTTPException(403, "Open the Government Portal on the TerraPulse site.")


def _session_key(token: str) -> bytes:
    return hashlib.sha256(token.encode()).digest()


def session_officer(request: Request) -> Officer | None:
    token = request.cookies.get(COOKIE, "")
    if len(token) != 43:
        return None
    with _lock:
        key = _session_key(token)
        entry = _sessions.get(key)
        if entry is None:
            return None
        expires, email = entry
        account = accounts.get(email)
        if expires <= monotonic() or account is None:
            _sessions.pop(key, None)
            return None
    return Officer(email=account.email, agency=account.agency)


def require_officer(request: Request) -> Officer:
    if request.method != "GET":
        require_trusted_origin(request)
    officer = session_officer(request)
    if officer is None:
        raise HTTPException(401, "Sign in to the Government Portal.")
    return officer


def new_session(request: Request, response: Response, email: str, password: str) -> Officer:
    require_trusted_origin(request)
    if not accounts:
        raise HTTPException(503, "Government accounts have not been set up for this installation.")
    email = email.strip().lower()
    now = monotonic()
    with _lock:
        while _attempts and now - _attempts[0][0] >= ATTEMPT_WINDOW:
            _attempts.popleft()
        if len(_attempts) >= 60 or sum(attempted == email for _, attempted in _attempts) >= 6:
            raise HTTPException(429, "Too many sign-in attempts. Try again in a few minutes.",
                                headers={"Retry-After": str(ATTEMPT_WINDOW)})
        _attempts.append((now, email))

    account = accounts.get(email)
    salt = bytes.fromhex(account.salt) if account else _dummy_salt
    expected = bytes.fromhex(account.password_hash) if account else bytes(32)
    valid = hmac.compare_digest(derive_password(password, salt), expected)
    if not valid or account is None:
        raise HTTPException(401, "Check your work email and password.")

    token = secrets.token_urlsafe(32)
    previous = request.cookies.get(COOKIE, "")
    with _lock:
        for key, (expires, _) in list(_sessions.items()):
            if expires <= now:
                _sessions.pop(key)
        if len(previous) == 43:
            _sessions.pop(_session_key(previous), None)
        if len(_sessions) >= 512:
            _sessions.pop(next(iter(_sessions)))
        _sessions[_session_key(token)] = (now + SESSION_SECONDS, email)

    response.set_cookie(COOKIE, token, max_age=SESSION_SECONDS, path="/api", httponly=True,
                        secure=settings.APP_ENV == "production" or request.url.scheme == "https", samesite="strict")
    return Officer(email=account.email, agency=account.agency)


def end_session(request: Request, response: Response) -> None:
    require_trusted_origin(request)
    token = request.cookies.get(COOKIE, "")
    if len(token) == 43:
        with _lock:
            _sessions.pop(_session_key(token), None)
    response.delete_cookie(COOKIE, path="/api", httponly=True, samesite="strict",
                           secure=settings.APP_ENV == "production" or request.url.scheme == "https")


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare a government account for a TerraPulse installation.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--agency", required=True)
    args = parser.parse_args()
    password = getpass("Password (14–128 characters): ")
    if not 14 <= len(password) <= 128 or password != getpass("Confirm password: "):
        parser.exit(2, "Enter matching passwords of 14–128 characters.\n")
    salt = secrets.token_bytes(16)
    account = Account(email=args.email.strip().lower(), agency=args.agency.strip(), salt=salt.hex(),
                      password_hash=derive_password(password, salt).hex())
    config = json.dumps([account.model_dump()], separators=(",", ":"), ensure_ascii=True)
    print("GOVERNMENT_ACCOUNTS='" + config.replace("'", r"\u0027") + "'")


if __name__ == "__main__":
    main()
