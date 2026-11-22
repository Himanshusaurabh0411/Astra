import secrets
from collections import deque

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.state import state_store
from app.services import government_auth as auth


@pytest.fixture
def officer(monkeypatch):
    email = "officer@example.gov.in"
    password = secrets.token_urlsafe(20)
    salt = secrets.token_bytes(16)
    account = auth.Account(email=email, agency="District Operations", salt=salt.hex(),
                           password_hash=auth.derive_password(password, salt).hex())
    monkeypatch.setattr(auth, "accounts", {email: account})
    monkeypatch.setattr(auth, "_attempts", deque())
    monkeypatch.setattr(auth, "_sessions", {})
    return {"email": email, "password": password}


def test_sign_in_protects_notes_and_revokes_access_on_logout(officer):
    client = TestClient(app)
    assert client.get("/api/government/overview").status_code == 401
    assert client.get("/api/government/session").json()["officer"] is None
    public = client.get("/api/sos").json()
    assert public and all("note" not in packet["triage"] for packet in public)
    assert all("note" not in packet["triage"] for packet in client.get("/api/state").json()["sos_packets"])
    request_id = public[0]["sos_id"]
    assert client.post(f"/api/sos/{request_id}/resolve").status_code == 401

    response = client.post("/api/government/login", json=officer)
    assert response.status_code == 200
    assert response.json() == {"email": officer["email"], "agency": "District Operations"}
    assert "HttpOnly" in response.headers["set-cookie"] and "SameSite=strict" in response.headers["set-cookie"]
    saved_session = client.cookies.get(auth.COOKIE)
    private = client.get("/api/government/overview").json()["requests"]
    assert any(packet["triage"].get("note") for packet in private)
    assert client.post(f"/api/sos/{request_id}/resolve", headers={"Origin": "https://other.example"}).status_code == 403

    assert client.post("/api/government/logout").status_code == 204
    client.cookies.set(auth.COOKIE, saved_session)
    assert client.get("/api/government/overview").status_code == 401


def test_repeated_invalid_government_logins_are_rate_limited(officer, monkeypatch):
    monkeypatch.setattr(auth, "derive_password", lambda _password, _salt: bytes(32))
    client = TestClient(app)
    mismatched = {**officer, "password": secrets.token_urlsafe(20)}
    for _ in range(6):
        assert client.post("/api/government/login", json=mismatched).status_code == 401
    assert client.post("/api/government/login", json=mismatched).status_code == 429


def test_retry_of_received_sos_does_not_reopen_a_resolved_request(officer, monkeypatch):
    monkeypatch.setattr(state_store, "sos_packets", dict(state_store.sos_packets))
    monkeypatch.setattr(state_store, "resolved_sos", {})
    client = TestClient(app)
    assert client.post("/api/government/login", json=officer).status_code == 200
    packet = client.get("/api/sos").json()[0]
    endpoint = f"/api/sos/{packet['sos_id']}/resolve"
    assert client.post(endpoint).status_code == 200
    assert client.post(endpoint).status_code == 200
    assert client.post("/api/sos", json=packet).json()["sos_id"] == packet["sos_id"]
    assert all(item["sos_id"] != packet["sos_id"] for item in client.get("/api/sos").json())
