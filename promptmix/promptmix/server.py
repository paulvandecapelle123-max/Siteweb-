"""Serveur web FastAPI de PromptMix.

Lancement : uvicorn promptmix.server:app --port 8000
"""
from __future__ import annotations

import json
import logging
import shutil
import threading
import time
import traceback
import uuid
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import config
from .audio_io import AudioError, looks_like_mp3, probe_codec
from .pipeline import analyze_job, mix_job

log = logging.getLogger("promptmix")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

STATIC = Path(__file__).parent / "static"
EXAMPLE_PROMPT = (
    "Mix de 5 minutes, ambiance montée progressive pour un début de soirée. "
    "Commence par le morceau 1 avec son intro, puis enchaîne le morceau 2 avec un bass swap sur 8 mesures. "
    "Pour finir, passe au morceau 3 avec un riser de 8 mesures et une coupure nette sur son drop. "
    "Termine le mix dans une réverb."
)

app = FastAPI(title="PromptMix", docs_url="/api/docs")
executor = ThreadPoolExecutor(max_workers=2)
_lock = threading.Lock()
_jobs: dict[str, dict] = {}


# --------------------------------------------------------------------------- état des tâches

def jobs_root() -> Path:
    root = Path(config.DATA_DIR) / "jobs"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _save(job: dict) -> None:
    d = jobs_root() / job["id"]
    if d.exists():
        (d / "job.json").write_text(json.dumps(job, ensure_ascii=False, indent=1))


def get_job(job_id: str) -> dict:
    try:
        uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(404, "Tâche inconnue")
    with _lock:
        if job_id in _jobs:
            return _jobs[job_id]
    f = jobs_root() / job_id / "job.json"
    if not f.exists():
        raise HTTPException(404, "Tâche inconnue ou expirée (fichiers supprimés 24 h après le rendu)")
    job = json.loads(f.read_text())
    with _lock:
        _jobs[job_id] = job
    return job


def update(job: dict, **kw) -> None:
    with _lock:
        job.update(kw)
        _save(job)


def progress_cb(job: dict):
    def cb(frac: float, msg: str) -> None:
        update(job, progress=round(min(1.0, max(0.0, frac)), 3), message=msg)
    return cb


# --------------------------------------------------------------------------- nettoyage 24 h

def cleanup_once(now: float | None = None) -> int:
    """Supprime les tâches rendues depuis plus de 24 h (et les dépôts jamais mixés de plus de 24 h)."""
    now = now or time.time()
    removed = 0
    for d in jobs_root().iterdir():
        f = d / "job.json"
        try:
            job = json.loads(f.read_text()) if f.exists() else {}
        except Exception:
            job = {}
        ref = job.get("rendered_at") or job.get("created_at") or d.stat().st_mtime
        if now - ref > config.RETENTION_SECONDS:
            shutil.rmtree(d, ignore_errors=True)
            with _lock:
                _jobs.pop(d.name, None)
            removed += 1
    return removed


def _cleanup_loop() -> None:
    while True:
        try:
            n = cleanup_once()
            if n:
                log.info("nettoyage : %d tâche(s) supprimée(s)", n)
        except Exception:
            log.exception("nettoyage")
        time.sleep(600)


@asynccontextmanager
async def lifespan(_app):
    threading.Thread(target=_cleanup_loop, daemon=True).start()
    yield


app.router.lifespan_context = lifespan


# --------------------------------------------------------------------------- API

@app.get("/api/config")
def api_config() -> dict:
    import os
    return {"example_prompt": EXAMPLE_PROMPT, "max_mb": config.MAX_UPLOAD_BYTES // (1024 * 1024),
            "min_tracks": config.MIN_TRACKS, "max_tracks": config.MAX_TRACKS,
            "claude": bool(os.environ.get("ANTHROPIC_API_KEY")), "model": config.MODEL,
            "retention_hours": config.RETENTION_SECONDS // 3600}


@app.get("/api/lexique")
def api_lexique() -> dict:
    from .plan.lexique import GLOSSAIRE, TECHNIQUES
    keep = ("id", "famille", "nom", "synonymes", "dj", "simple", "quand", "mesures")
    return {"techniques": [{k: t[k] for k in keep} for t in TECHNIQUES], "glossaire": GLOSSAIRE}


async def _store_upload(up: UploadFile, dest: Path) -> int:
    name = up.filename or ""
    if not name.lower().endswith(".mp3"):
        raise HTTPException(415, f"« {name} » : seuls les fichiers MP3 sont acceptés")
    if up.content_type not in (None, "", "audio/mpeg", "audio/mp3", "audio/mpeg3", "audio/x-mpeg-3",
                               "application/octet-stream"):
        raise HTTPException(415, f"« {name} » : type {up.content_type} refusé (MP3 uniquement)")
    size = 0
    with dest.open("wb") as fh:
        while chunk := await up.read(1 << 20):
            size += len(chunk)
            if size > config.MAX_UPLOAD_BYTES:
                raise HTTPException(413, f"« {name} » dépasse 50 Mo")
            fh.write(chunk)
    with dest.open("rb") as fh:
        head = fh.read(8192)
    if not looks_like_mp3(head):
        raise HTTPException(415, f"« {name} » n'est pas un vrai fichier MP3")
    try:
        if probe_codec(dest) != "mp3":
            raise HTTPException(415, f"« {name} » n'est pas encodé en MP3")
    except AudioError:
        raise HTTPException(415, f"« {name} » est illisible")
    return size


@app.post("/api/jobs")
async def create_job(files: list[UploadFile] = File(...), rights: str = Form("")) -> dict:
    if rights.lower() not in ("true", "on", "1", "yes", "oui"):
        raise HTTPException(400, "Coche « J'ai les droits sur ces fichiers » pour continuer")
    if not (config.MIN_TRACKS <= len(files) <= config.MAX_TRACKS):
        raise HTTPException(400, f"Dépose {config.MIN_TRACKS} ou {config.MAX_TRACKS} fichiers MP3")
    job_id = str(uuid.uuid4())
    d = jobs_root() / job_id
    d.mkdir()
    tracks = []
    try:
        for i, up in enumerate(files, start=1):
            dest = d / f"piste_{i}.mp3"
            await _store_upload(up, dest)
            tracks.append({"track_id": i, "path": str(dest), "original_name": Path(up.filename or f"piste_{i}.mp3").name})
    except HTTPException:
        shutil.rmtree(d, ignore_errors=True)
        raise
    job = {"id": job_id, "created_at": time.time(), "status": "analyse", "progress": 0.0,
           "message": "En file d'attente", "tracks": tracks, "analysis": None, "result": None, "error": None}
    with _lock:
        _jobs[job_id] = job
        _save(job)
    executor.submit(_run_analysis, job)
    return {"job_id": job_id}


def _run_analysis(job: dict) -> None:
    try:
        analysis = analyze_job(jobs_root() / job["id"], job["tracks"], progress_cb(job))
        update(job, status="pret", progress=1.0, message="Analyse terminée", analysis=analysis)
    except Exception as exc:
        log.error("analyse %s : %s", job["id"], traceback.format_exc())
        update(job, status="erreur", error=f"Analyse impossible : {exc}")


class MixRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=4000)
    corrections: dict[str, dict] = Field(default_factory=dict)  # {"1": {"bpm": 128, "key": "8A"}}


@app.post("/api/jobs/{job_id}/mix")
def start_mix(job_id: str, req: MixRequest) -> dict:
    job = get_job(job_id)
    if job["status"] in ("analyse", "mixage"):
        raise HTTPException(409, "Une opération est déjà en cours pour ces fichiers")
    if not job.get("analysis"):
        raise HTTPException(409, "L'analyse n'est pas terminée")
    update(job, status="mixage", progress=0.0, message="Démarrage du mix", result=None, error=None)
    executor.submit(_run_mix, job, req.prompt, req.corrections)
    return {"ok": True}


def _run_mix(job: dict, prompt: str, corrections: dict) -> None:
    try:
        result = mix_job(jobs_root() / job["id"], job["tracks"], job["analysis"], prompt, corrections,
                         progress_cb(job))
        analysis = json.loads((jobs_root() / job["id"] / "analysis.json").read_text())
        update(job, status="termine", progress=1.0, message="Mix prêt", result=result, analysis=analysis,
               rendered_at=time.time())
    except Exception as exc:
        log.error("mix %s : %s", job["id"], traceback.format_exc())
        update(job, status="erreur", error=str(exc) or exc.__class__.__name__)


def _public(job: dict) -> dict:
    out = {k: job.get(k) for k in ("id", "status", "progress", "message", "error", "result", "created_at", "rendered_at")}
    out["tracks"] = []
    for a in job.get("analysis") or []:
        out["tracks"].append({k: a[k] for k in ("track_id", "filename", "display", "artist", "title", "tag_source",
                                                 "duration_s", "bpm", "bpm_corrected", "key", "key_corrected")}
                             | {"sections": a["sections"]["sections"], "n_bars": a["grid"]["n_bars"],
                                "beat_engine": a["grid"]["engine"], "band_phases_ms": a["grid"]["band_phases_ms"]})
    if job.get("rendered_at"):
        out["expires_at"] = job["rendered_at"] + config.RETENTION_SECONDS
    return out


@app.get("/api/jobs/{job_id}")
def job_status(job_id: str) -> dict:
    return _public(get_job(job_id))


@app.get("/api/jobs/{job_id}/mix.mp3")
def download_mix(job_id: str, download: int = 0):
    job = get_job(job_id)
    f = jobs_root() / job["id"] / "mix.mp3"
    if job["status"] != "termine" or not f.exists():
        raise HTTPException(404, "Mix pas encore prêt")
    return FileResponse(f, media_type="audio/mpeg",
                        filename="PromptMix.mp3" if download else None)


@app.get("/api/jobs/{job_id}/tracklist.txt", response_class=PlainTextResponse)
def download_tracklist(job_id: str):
    job = get_job(job_id)
    f = jobs_root() / job["id"] / "tracklist.txt"
    if not f.exists():
        raise HTTPException(404, "Mix pas encore prêt")
    return PlainTextResponse(f.read_text(), headers={"Content-Disposition": 'attachment; filename="PromptMix-tracklist.txt"'})


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


app.mount("/static", StaticFiles(directory=STATIC), name="static")
