import asyncio
import importlib
import os
from pathlib import Path
import sys
from uuid import uuid4
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["OS_SECURITY_KEY"] = "test-secret-" + "a" * 40
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["OPENAI_API_KEY"] = "test-not-a-real-key"
backend = importlib.import_module("app")
HEADERS = {"Authorization": f"Bearer {backend.KEY}"}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    engine = backend.create_engine(f"sqlite:///{tmp_path / 'jobs.db'}")
    monkeypatch.setattr(backend, "engine", engine)
    backend.metadata.create_all(engine)
    with TestClient(backend.app) as client:
        yield client
    engine.dispose()


def submission(user=None, **extra):
    return {"user_id": user or str(uuid4()), "request_id": str(uuid4()),
            "message": "Create a twenty-minute bodyweight workout.", **extra}


def test_all_runtime_routes_require_service_key(client):
    for path in ["/levelupos/jobs", "/agents", "/docs", "/config", "/levelupos/health"]:
        assert client.get(path).status_code == 401
    assert client.get("/healthz").status_code == 200
    assert client.get("/levelupos/health", headers=HEADERS).status_code == 200


def test_user_isolation_and_idempotent_submission(client):
    body = submission()
    first = client.post("/levelupos/jobs", json=body, headers=HEADERS)
    second = client.post("/levelupos/jobs", json=body, headers=HEADERS)
    assert first.status_code == second.status_code == 202
    assert first.json()["id"] == second.json()["id"]
    own = client.get(f'/levelupos/jobs?user_id={body["user_id"]}', headers=HEADERS).json()
    other = client.get(f'/levelupos/jobs?user_id={uuid4()}', headers=HEADERS).json()
    assert len(own["jobs"]) == 1
    assert other["jobs"] == []
    assert "user_id" not in first.json() and "request_id" not in first.json()


def test_limits_and_input_validation(client, monkeypatch):
    assert client.post("/levelupos/jobs", json=submission(message="tiny"), headers=HEADERS).status_code == 422
    assert client.post("/levelupos/jobs", json=submission(extra="forbidden"), headers=HEADERS).status_code == 422
    monkeypatch.setenv("LEVELUPOS_GLOBAL_DAILY_LIMIT", "1")
    assert client.post("/levelupos/jobs", json=submission(), headers=HEADERS).status_code == 202
    assert client.post("/levelupos/jobs", json=submission(), headers=HEADERS).status_code == 429


def test_one_active_run_per_user(client):
    user = str(uuid4())
    assert client.post("/levelupos/jobs", json=submission(user), headers=HEADERS).status_code == 202
    assert client.post("/levelupos/jobs", json=submission(user), headers=HEADERS).status_code == 409


def test_missing_model_key_does_not_accept_paid_work(client, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY")
    assert client.post("/levelupos/jobs", json=submission(), headers=HEADERS).status_code == 503


def test_worker_persists_output_without_live_model_calls(tmp_path, monkeypatch):
    engine = backend.create_engine(f"sqlite:///{tmp_path / 'worker.db'}")
    monkeypatch.setattr(backend, "engine", engine)
    backend.metadata.create_all(engine)
    row = {"id": str(uuid4()), "user_id": str(uuid4()), "request_id": str(uuid4()),
           "status": "queued", "request": "A short workout", "created_at": backend.now(), "updated_at": backend.now()}
    with engine.begin() as db:
        db.execute(backend.jobs.insert().values(**row))

    async def fake_workout(prompt, user_id, job_id):
        assert user_id == row["user_id"] and job_id == row["id"]
        return "Warm up. Walk for ten minutes. Cool down."

    monkeypatch.setattr(backend, "execute_workout", fake_workout)

    async def run():
        task = asyncio.create_task(backend.worker())
        for _ in range(100):
            await asyncio.sleep(0.01)
            with engine.connect() as db:
                saved = db.execute(backend.select(backend.jobs)).mappings().one()
            if saved["status"] == "completed":
                break
        task.cancel()
        with backend.contextlib.suppress(asyncio.CancelledError):
            await task
        assert saved["status"] == "completed"
        assert saved["output"].startswith("Warm up")

    asyncio.run(run())
    engine.dispose()


def test_manager_brief_and_original_request_reach_workout_agent(monkeypatch):
    manager = SimpleNamespace(arun=AsyncMock(return_value=SimpleNamespace(content="Respect the 20-minute budget")))
    workout = SimpleNamespace(arun=AsyncMock(return_value=SimpleNamespace(content="A complete workout")))
    monkeypatch.setattr(backend, "manager", manager)
    monkeypatch.setattr(backend, "workout", workout)
    output = asyncio.run(backend.execute_workout("Only bodyweight, 20 minutes", "user-1", "job-1"))
    assert output == "A complete workout"
    manager.arun.assert_awaited_once_with("Only bodyweight, 20 minutes", user_id="user-1", session_id="job-1:manager")
    call = workout.arun.call_args
    assert backend.json.loads(call.args[0]) == {
        "original_request": "Only bodyweight, 20 minutes", "manager_brief": "Respect the 20-minute budget",
    }
    assert call.kwargs == {"user_id": "user-1", "session_id": "job-1:workout"}


def test_restart_marks_interrupted_jobs_failed_and_preserves_queued(tmp_path, monkeypatch):
    engine = backend.create_engine(f"sqlite:///{tmp_path / 'restart.db'}")
    monkeypatch.setattr(backend, "engine", engine)
    backend.metadata.create_all(engine)
    ids = {}
    with engine.begin() as db:
        for status in ["running", "queued"]:
            ids[status] = str(uuid4())
            db.execute(backend.jobs.insert().values(
                id=ids[status], user_id=str(uuid4()), request_id=str(uuid4()), status=status,
                request="A workout", created_at=backend.now() - 300, updated_at=backend.now() - 300,
            ))

    async def idle_worker():
        await asyncio.sleep(3600)

    monkeypatch.setattr(backend, "worker", idle_worker)
    with TestClient(backend.app):
        with engine.connect() as db:
            rows = {r["id"]: r for r in db.execute(backend.select(backend.jobs)).mappings()}
        assert rows[ids["running"]]["status"] == "failed"
        assert "interrupted" in rows[ids["running"]]["error"]
        assert rows[ids["queued"]]["status"] == "queued"
    engine.dispose()
