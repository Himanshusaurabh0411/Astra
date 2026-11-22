import asyncio
import logging
import smtplib
import sqlite3
import ssl
import time
from contextlib import asynccontextmanager, closing, contextmanager
from datetime import datetime, timezone
from email.message import EmailMessage
from typing import Iterable, Literal

from app.config import settings
from app.models.regions import get_regions, region_at
from app.models.schemas import SOSEmailDraft, SOSEmailNotice, SOSPacket
from app.models.state import state_store

logger = logging.getLogger("terrapulse.sos_email")
MAX_ATTEMPTS = 3
RETRY_DELAYS = (60, 300)
HELP_TYPES = {"MEDICAL": "medical", "BOAT_RESCUE": "boat rescue", "WATER": "water",
              "FOOD": "food", "SAFE_SHELTER": "shelter", "EVACUATION": "evacuation"}


def routing_mode() -> Literal["off", "manual", "automatic"]:
    if not settings.SOS_EMAIL_TO:
        return "off"
    password = settings.SOS_SMTP_PASSWORD
    credential_pair = bool(settings.SOS_SMTP_USER) == bool(password and password.get_secret_value())
    if settings.SOS_SMTP_HOST and settings.SOS_EMAIL_FROM and credential_pair:
        return "automatic"
    return "manual"


def exercise_draft(packet: SOSPacket, recipient: str, received_at: float) -> SOSEmailDraft:
    region = get_regions()[region_at((packet.position.lng, packet.position.lat)) or "all-india"]
    needs = [HELP_TYPES[need] for need in packet.triage.needs if need in HELP_TYPES]
    timestamp = datetime.fromtimestamp(received_at, tz=timezone.utc).strftime("%d %b %Y, %H:%M UTC")
    body = "\n".join([
        "A field responder submitted a TerraPulse exercise SOS.", "",
        f"Request: {packet.sos_id}", f"Region: {region.short_name}", f"Urgency: {packet.triage.severity.value}",
        f"People: {packet.triage.headcount}", f"Help requested: {', '.join(needs) or 'See request'}",
        f"Received: {timestamp}", "", "Sign in to the TerraPulse Government Portal to review the field report.",
    ])
    return SOSEmailDraft(to=recipient, subject=f"[TerraPulse exercise] {packet.triage.severity.value} SOS · {packet.sos_id}", body=body)


@contextmanager
def database():
    path = settings.SOS_EMAIL_DB
    path.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(path, timeout=3)) as db, db:
        db.row_factory = sqlite3.Row
        db.execute("""CREATE TABLE IF NOT EXISTS sos_email (
            sos_id TEXT PRIMARY KEY, recipient TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL,
            status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, created REAL NOT NULL,
            updated REAL NOT NULL, next_attempt REAL NOT NULL DEFAULT 0)""")
        yield db


def notices_for(ids: Iterable[str]) -> dict[str, SOSEmailNotice]:
    ids = list(set(ids))
    if not ids or not settings.SOS_EMAIL_TO or not settings.SOS_EMAIL_DB.is_file():
        return {}
    try:
        with database() as db:
            placeholders = ",".join("?" for _ in ids)
            rows = db.execute(f"SELECT * FROM sos_email WHERE recipient = ? AND sos_id IN ({placeholders})",
                              [settings.SOS_EMAIL_TO, *ids]).fetchall()
    except (OSError, sqlite3.Error):
        logger.warning("Could not read exercise email status")
        return {}
    result = {}
    for row in rows:
        draft = None
        if row["status"] in ("manual", "failed"):
            draft = SOSEmailDraft(to=row["recipient"], subject=row["subject"], body=row["body"])
        result[row["sos_id"]] = SOSEmailNotice(status=row["status"], draft=draft)
    return result


def record_receipts(packets: list[SOSPacket], new_ids: set[str]) -> dict[str, SOSEmailNotice]:
    recipient = settings.SOS_EMAIL_TO
    if not recipient:
        return {}
    now = time.time()
    drafts = {p.sos_id: exercise_draft(p, recipient, now) for p in packets if p.sos_id in new_ids}
    if drafts:
        status = "queued" if routing_mode() == "automatic" else "manual"
        try:
            with database() as db:
                db.executemany("""INSERT INTO sos_email (sos_id, recipient, subject, body, status, created, updated)
                    VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(sos_id) DO NOTHING""",
                    [(key, recipient, draft.subject, draft.body, status, now, now) for key, draft in drafts.items()])
        except (OSError, sqlite3.Error):
            logger.warning("Exercise email queue unavailable; returned manual drafts")
            return {key: SOSEmailNotice(status="manual", draft=draft) for key, draft in drafts.items()}
    return notices_for(p.sos_id for p in packets)


def cancel_pending(sos_id: str | None = None) -> None:
    if not settings.SOS_EMAIL_TO or not settings.SOS_EMAIL_DB.is_file():
        return
    with database() as db:
        db.execute("""UPDATE sos_email SET status = 'cancelled', updated = ?
            WHERE status IN ('queued','manual','failed') AND (? IS NULL OR sos_id = ?)""", (time.time(), sos_id, sos_id))


class UnconfirmedDelivery(Exception):
    """The connection closed during submission before the mail server acknowledged it."""


def submit_mail(row: sqlite3.Row) -> None:
    message = EmailMessage()
    message["From"] = settings.SOS_EMAIL_FROM
    message["To"] = row["recipient"]
    message["Subject"] = row["subject"]
    domain = settings.SOS_EMAIL_FROM.rsplit("@", 1)[1]
    message["Message-ID"] = f"<{row['sos_id'].lower()}@{domain}>"
    message.set_content(row["body"])

    context = ssl.create_default_context()
    host, port = settings.SOS_SMTP_HOST, settings.SOS_SMTP_PORT
    smtp = (smtplib.SMTP_SSL(host, port, timeout=8, context=context) if settings.SOS_SMTP_SECURITY == "ssl"
            else smtplib.SMTP(host, port, timeout=8))
    try:
        if settings.SOS_SMTP_SECURITY == "starttls":
            smtp.starttls(context=context)
        if settings.SOS_SMTP_USER and settings.SOS_SMTP_PASSWORD:
            smtp.login(settings.SOS_SMTP_USER, settings.SOS_SMTP_PASSWORD.get_secret_value())
        try:
            smtp.send_message(message)
        except (smtplib.SMTPResponseException, smtplib.SMTPRecipientsRefused, smtplib.SMTPNotSupportedError):
            raise
        except OSError as error:
            raise UnconfirmedDelivery from error
    finally:
        smtp.close()


def deliver_next() -> None:
    if routing_mode() != "automatic" or not state_store.cellular_online:
        return
    now = time.time()
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        # A worker that stopped after SMTP submission may already have delivered the email.
        db.execute("UPDATE sos_email SET status='uncertain', updated=? WHERE status='sending' AND updated < ?",
                   (now, now - 300))
        row = db.execute("""SELECT * FROM sos_email WHERE status='queued' AND recipient=? AND next_attempt<=?
                          ORDER BY created, rowid LIMIT 1""", (settings.SOS_EMAIL_TO, now)).fetchone()
        if row is None:
            return
        db.execute("UPDATE sos_email SET status='sending', updated=?, attempts=attempts+1 WHERE sos_id=?",
                   (now, row["sos_id"]))
    status = "accepted"
    try:
        submit_mail(row)
    except UnconfirmedDelivery:
        status = "uncertain"
    except smtplib.SMTPRecipientsRefused as error:
        status = "failed" if any(code >= 500 for code, _ in error.recipients.values()) else "queued"
    except smtplib.SMTPResponseException as error:
        status = "failed" if error.smtp_code >= 500 else "queued"
    except OSError:
        status = "queued"
    attempts = row["attempts"] + 1
    if status == "queued" and attempts >= MAX_ATTEMPTS:
        status = "failed"
    now = time.time()
    next_attempt = now + RETRY_DELAYS[attempts - 1] if status == "queued" else 0
    with database() as db:
        db.execute("UPDATE sos_email SET status=?, updated=?, next_attempt=? WHERE sos_id=? AND status='sending'",
                   (status, now, next_attempt, row["sos_id"]))


@asynccontextmanager
async def lifespan(_app):
    stopped = asyncio.Event()

    async def run():
        while not stopped.is_set():
            try:
                await asyncio.to_thread(deliver_next)
            except (OSError, sqlite3.Error):
                logger.warning("Exercise email worker could not access its queue")
            try:
                await asyncio.wait_for(stopped.wait(), timeout=4)
            except asyncio.TimeoutError:
                pass

    worker = asyncio.create_task(run()) if routing_mode() == "automatic" else None
    try:
        yield
    finally:
        stopped.set()
        if worker:
            await worker
