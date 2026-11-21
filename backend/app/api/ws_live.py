import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger("terrapulse.ws")
router = APIRouter(tags=["WebSocket Realtime Feed"])


class ConnectionManager:
    """
    Manages active WebSocket connections for live Central Command dashboards
    and field PWA responder clients.
    """

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Active connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Active connections: {len(self.active_connections)}")

    async def broadcast(self, event_type: str, data: Any) -> None:
        """
        Broadcasts an event payload to all actively connected clients.
        Silently cleans up any stale or closed connections.
        """
        if not self.active_connections:
            return

        payload = {
            "event": event_type,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        text_data = json.dumps(payload)
        dead_connections = []

        for connection in self.active_connections:
            try:
                await connection.send_text(text_data)
            except Exception as e:
                logger.debug(f"Failed to send to client ({e}); queueing for removal")
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect(dead)


ws_manager = ConnectionManager()


@router.websocket("/ws/live")
async def websocket_live_endpoint(websocket: WebSocket) -> None:
    """
    Continuous real-time telemetry stream broadcasting GeoAI layer updates,
    SOS distress alerts, and evacuation corridor dispatch vectors.
    """
    await ws_manager.connect(websocket)
    try:
        # Send initial connection handshake
        await websocket.send_json({
            "event": "connected",
            "message": "TerraPulse Realtime Telemetry Feed Connected",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        while True:
            # Keep connection open; acknowledge heartbeat pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
            else:
                logger.debug(f"Received client message over WS: {data}")

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket unexpected error: {e}")
        ws_manager.disconnect(websocket)
