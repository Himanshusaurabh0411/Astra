import asyncio
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import settings

router = APIRouter(tags=["WebSocket Realtime Feed"])


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ConnectionManager:
    def __init__(self):
        self.connections: set[WebSocket] = set()

    async def broadcast(self, event_type: str, data: Any) -> None:
        message = {"event": event_type, "data": data, "timestamp": now()}

        async def send(connection: WebSocket) -> None:
            try:
                await asyncio.wait_for(connection.send_json(message), timeout=1.0)
            except (OSError, RuntimeError, WebSocketDisconnect, TimeoutError):
                self.connections.discard(connection)

        await asyncio.gather(*(send(connection) for connection in tuple(self.connections)))


ws_manager = ConnectionManager()


@router.websocket("/ws/live")
async def websocket_live_endpoint(websocket: WebSocket):
    origin = websocket.headers.get("origin")
    allowed = {url.strip() for url in settings.CORS_ORIGINS.split(",")}
    host = websocket.headers.get("host", "")
    same_origin = origin in {f"http://{host}", f"https://{host}"}
    if len(ws_manager.connections) >= 100 or (origin and origin not in allowed and not same_origin):
        await websocket.close(code=1008)
        return

    await websocket.accept()
    ws_manager.connections.add(websocket)
    try:
        await websocket.send_json({"event": "connected", "timestamp": now()})
        while True:
            message = await websocket.receive_text()
            if message == "ping":
                await websocket.send_text("pong")
    except (RuntimeError, WebSocketDisconnect):
        pass
    finally:
        ws_manager.connections.discard(websocket)
