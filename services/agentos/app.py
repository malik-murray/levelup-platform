"""LevelUpOS: authenticated AgentOS runtime with a bounded, persisted work queue.

Deploy exactly ONE replica and ONE uvicorn worker. Pending jobs survive restarts;
interrupted jobs fail visibly rather than silently repeating model charges.
"""
import asyncio
import contextlib
import json
import logging
import os
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from uuid import UUID, uuid4

from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.os import AgentOS
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Column, Float, MetaData, String, Table, Text, create_engine, func, select

logger = logging.getLogger(__name__)
KEY = os.environ.get("OS_SECURITY_KEY", "")
if len(KEY) < 32:
    raise RuntimeError("Set OS_SECURITY_KEY to a random secret of at least 32 characters")
DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required (persistent PostgreSQL in production)")
if DATABASE_URL.startswith(("postgres://", "postgresql://")):
    DATABASE_URL = "postgresql+psycopg://" + DATABASE_URL.split("://", 1)[1]
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
metadata = MetaData()
jobs = Table(
    "levelupos_jobs", metadata,
    Column("id", String, primary_key=True),
    Column("user_id", String, nullable=False, index=True),
    Column("request_id", String, nullable=False, unique=True),
    Column("status", String, nullable=False),
    Column("request", Text, nullable=False),
    Column("output", Text), Column("error", Text),
    Column("created_at", Float, nullable=False),
    Column("updated_at", Float, nullable=False),
)
MODEL = os.environ.get("LEVELUPOS_MODEL", "gpt-4o-mini")
manager = Agent(
    id="levelupos-manager", name="LevelUpOS Manager",
    model=OpenAIChat(id=MODEL, max_completion_tokens=500, timeout=60, max_retries=0),
    instructions=[
        "Create a concise workout brief for the Workout Agent from the user's request.",
        "Keep the user's duration, equipment, goals and limitations explicit. Do not invent them.",
        "Only plan exercise. Do not claim to contact anyone, change data, or schedule anything.",
    ], telemetry=False,
)
workout = Agent(
    id="levelupos-workout", name="Workout Agent",
    model=OpenAIChat(id=MODEL, max_completion_tokens=1800, timeout=90, max_retries=0),
    instructions=[
        "Create a practical workout using the original user request and manager brief.",
        "Include warm-up, exercises, sets/reps or duration, rest, and cool-down within the time budget.",
        "Honor stated limitations and equipment. Do not diagnose or prescribe rehabilitation.",
        "When limitations are unclear, use conservative options and state your assumptions.",
        "Return a readable concise plan. You have no external action tools; never claim actions were taken.",
    ], telemetry=False,
)


def now():
    return datetime.now(timezone.utc).timestamp()


def public_job(row):
    return {key: row[key] for key in (
        "id", "status", "request", "output", "error", "created_at", "updated_at"
    )}


def recover_interrupted(db):
    # A new deployment must not fail a still-running request in the old process.
    # Execution is bounded at 180 seconds; the extra minute allows shutdown drift.
    db.execute(jobs.update().where(
        jobs.c.status == "running", jobs.c.updated_at < now() - 240,
    ).values(status="failed", error="Backend interrupted this run. Review before retrying.", updated_at=now()))


async def execute_workout(prompt, user_id, job_id):
    # Fresh sessions prevent history from leaking between users or growing token costs.
    brief = await manager.arun(prompt, user_id=user_id, session_id=f"{job_id}:manager")
    result = await workout.arun(
        json.dumps({"original_request": prompt, "manager_brief": str(brief.content)}),
        user_id=user_id, session_id=f"{job_id}:workout",
    )
    if not isinstance(result.content, str) or not result.content.strip():
        raise ValueError("No workout returned")
    return result.content[:30000]


async def worker():
    while True:
        with engine.begin() as db:
            recover_interrupted(db)
            row = db.execute(select(jobs).where(jobs.c.status == "queued")
                             .order_by(jobs.c.created_at).limit(1)
                             .with_for_update(skip_locked=True)).mappings().first()
            if row:
                db.execute(jobs.update().where(jobs.c.id == row["id"])
                           .values(status="running", updated_at=now()))
        if not row:
            await asyncio.sleep(2)
            continue
        try:
            output = await asyncio.wait_for(
                execute_workout(row["request"], row["user_id"], row["id"]), timeout=180,
            )
            values = {"status": "completed", "output": output, "error": None}
        except asyncio.CancelledError:
            raise
        except Exception:
            # Never expose SDK exceptions, credentials or prompts through an API error.
            logger.warning("Agent run failed: %s", row["id"])
            values = {"status": "failed", "error": "Run failed or timed out. Review before submitting again."}
        with engine.begin() as db:
            db.execute(jobs.update().where(jobs.c.id == row["id"])
                       .values(**values, updated_at=now()))


@asynccontextmanager
async def lifespan(_app):
    metadata.create_all(engine)
    with engine.begin() as db:
        recover_interrupted(db)
    task = asyncio.create_task(worker())
    _app.state.worker = task
    try:
        yield
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


api = FastAPI()


class Submission(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_id: UUID
    request_id: UUID
    message: str = Field(min_length=10, max_length=2000)


@api.get("/levelupos/health")
async def health(request: Request):
    with engine.connect() as db:
        db.execute(select(1))
    task = getattr(request.app.state, "worker", None)
    ready = bool(os.environ.get("OPENAI_API_KEY")) and task is not None and not task.done()
    return JSONResponse({"ready": ready}, status_code=200 if ready else 503)


@api.get("/levelupos/jobs")
def list_jobs(user_id: UUID):
    with engine.connect() as db:
        rows = db.execute(select(jobs).where(jobs.c.user_id == str(user_id))
                          .order_by(jobs.c.created_at.desc()).limit(20)).mappings()
        return {"jobs": [public_job(row) for row in rows]}


@api.post("/levelupos/jobs", status_code=202)
def submit(body: Submission):
    if not os.environ.get("OPENAI_API_KEY"):
        raise HTTPException(503, "Model credentials are not configured")
    user_id, request_id = str(body.user_id), str(body.request_id)
    # Single replica plus a DB row lock serializes submissions (including daily caps).
    with engine.begin() as db:
        if engine.dialect.name == "postgresql":
            from sqlalchemy import text
            db.execute(text("SELECT pg_advisory_xact_lock(68420719)"))
        existing = db.execute(select(jobs).where(jobs.c.request_id == request_id)).mappings().first()
        if existing:
            if existing["user_id"] != user_id:
                raise HTTPException(409, "Request ID is already in use")
            return public_job(existing)
        active = db.execute(select(jobs.c.id).where(
            jobs.c.user_id == user_id, jobs.c.status.in_(["queued", "running"]),
        )).first()
        if active:
            raise HTTPException(409, "You already have an active run")
        midnight = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
        today = select(func.count()).select_from(jobs).where(jobs.c.created_at >= midnight)
        total = db.scalar(today)
        user_total = db.scalar(today.where(jobs.c.user_id == user_id))
        if total >= int(os.environ.get("LEVELUPOS_GLOBAL_DAILY_LIMIT", "25")) or user_total >= int(os.environ.get("LEVELUPOS_USER_DAILY_LIMIT", "5")):
            raise HTTPException(429, "Daily run limit reached; resets at midnight UTC")
        row = dict(id=str(uuid4()), user_id=user_id, request_id=request_id,
                   status="queued", request=body.message, output=None, error=None,
                   created_at=now(), updated_at=now())
        db.execute(jobs.insert().values(**row))
        return public_job(row)


runtime = AgentOS(name="LevelUpOS", agents=[manager, workout], base_app=api,
                  lifespan=lifespan, telemetry=False)
app = runtime.get_app()


@app.middleware("http")
async def require_service_key(request: Request, call_next):
    # Protect ALL runtime routes, including docs and native execution endpoints.
    # Railway probes only the minimal /healthz route.
    if request.url.path == "/healthz":
        return JSONResponse({"status": "ok"})
    provided = request.headers.get("authorization", "")
    if not secrets.compare_digest(provided, f"Bearer {KEY}"):
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)
    return await call_next(request)
