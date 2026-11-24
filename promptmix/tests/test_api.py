import io
import json
import time

import pytest
from fastapi.testclient import TestClient

from promptmix import config, server
from promptmix.audio_io import encode_mp3
from tests.synth import click_track


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DATA_DIR", tmp_path)
    return TestClient(server.app)


@pytest.fixture(scope="module")
def mp3_bytes(tmp_path_factory):
    p = tmp_path_factory.mktemp("m") / "a.mp3"
    a, _ = click_track(128, 8)
    encode_mp3(a, p)
    return p.read_bytes()


def files(*items):
    return [("files", (n, io.BytesIO(b), t)) for n, b, t in items]


def test_requires_rights(client, mp3_bytes):
    r = client.post("/api/jobs", files=files(("a.mp3", mp3_bytes, "audio/mpeg"), ("b.mp3", mp3_bytes, "audio/mpeg")),
                    data={"rights": "false"})
    assert r.status_code == 400 and "droits" in r.json()["detail"]


def test_rejects_non_mp3(client, mp3_bytes):
    r = client.post("/api/jobs", files=files(("a.wav", mp3_bytes, "audio/wav"), ("b.mp3", mp3_bytes, "audio/mpeg")),
                    data={"rights": "true"})
    assert r.status_code == 415
    r = client.post("/api/jobs", files=files(("a.mp3", b"\x00" * 5000, "audio/mpeg"), ("b.mp3", mp3_bytes, "audio/mpeg")),
                    data={"rights": "true"})
    assert r.status_code == 415


def test_rejects_too_big(client, mp3_bytes, monkeypatch):
    monkeypatch.setattr(config, "MAX_UPLOAD_BYTES", 1000)
    r = client.post("/api/jobs", files=files(("a.mp3", mp3_bytes, "audio/mpeg"), ("b.mp3", mp3_bytes, "audio/mpeg")),
                    data={"rights": "true"})
    assert r.status_code == 413


def test_track_count(client, mp3_bytes):
    one = files(("a.mp3", mp3_bytes, "audio/mpeg"))
    assert client.post("/api/jobs", files=one, data={"rights": "true"}).status_code == 400
    four = files(*[(f"{i}.mp3", mp3_bytes, "audio/mpeg") for i in range(4)])
    assert client.post("/api/jobs", files=four, data={"rights": "true"}).status_code == 400


def test_cleanup_after_24h(client, tmp_path):
    root = server.jobs_root()
    old, fresh = root / "11111111-1111-1111-1111-111111111111", root / "22222222-2222-2222-2222-222222222222"
    for d, t in ((old, time.time() - 25 * 3600), (fresh, time.time() - 3600)):
        d.mkdir()
        (d / "job.json").write_text(json.dumps({"id": d.name, "created_at": t - 10, "rendered_at": t}))
    assert server.cleanup_once() == 1
    assert not old.exists() and fresh.exists()


def test_config_has_example_prompt(client):
    r = client.get("/api/config").json()
    assert "morceau 1" in r["example_prompt"] and r["max_mb"] == 50
