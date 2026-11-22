from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, ConfigDict, Field, SecretStr

from app.models.state import state_store
from app.services import government_auth as auth

router = APIRouter(prefix="/api/government", tags=["Government Portal"])


class Credentials(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: auth.Email
    password: SecretStr = Field(min_length=1, max_length=128)


@router.get("/session")
def session(request: Request):
    return {"configured": bool(auth.accounts), "officer": auth.session_officer(request)}


@router.post("/login", response_model=auth.Officer)
def login(credentials: Credentials, request: Request, response: Response):
    return auth.new_session(request, response, credentials.email, credentials.password.get_secret_value())


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response):
    auth.end_session(request, response)


@router.get("/overview", dependencies=[Depends(auth.require_officer)])
async def overview():
    return {
        "requests": list(state_store.sos_packets.values()),
        "sources": state_store.portal_provenance,
        "mode": state_store.mode,
    }
