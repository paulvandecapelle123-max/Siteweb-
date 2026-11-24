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

from fastapi import FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import config
from .audio_io import AudioError, looks_like_mp3, probe_codec
from .billing import auth, db, payments
from .pipeline import analyze_job, mix_job
from .plan.planner import parse_duration_s

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


def job_for(request: Request, job_id: str) -> dict:
    """Tâche accessible seulement par son propriétaire quand la facturation est activée."""
    job = get_job(job_id)
    if config.BILLING:
        user = current_user(request)
        if user is None or job.get("user_id") != user["id"]:
            raise HTTPException(404, "Tâche inconnue")
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
            "retention_hours": config.RETENTION_SECONDS // 3600, "billing": config.BILLING,
            "site_url": config.SITE_URL}


# --------------------------------------------------------------------------- comptes et crédits

def current_user(request: Request) -> dict | None:
    return auth.user_for_token(request.cookies.get(auth.COOKIE))


def require_user(request: Request) -> dict | None:
    """Avec la facturation activée, il faut être connecté ; sinon (local) personne n'est exigé."""
    user = current_user(request)
    if config.BILLING and user is None:
        raise HTTPException(401, "Connecte-toi pour continuer (page Crédits).")
    return user


def _set_session(resp: Response, user_id: int) -> None:
    resp.set_cookie(auth.COOKIE, auth.new_session(user_id), max_age=auth.SESSION_DAYS * 86400, httponly=True,
                    samesite="lax", secure=config.PUBLIC_URL.startswith("https://"), path="/")


class Credentials(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=200)


@app.post("/api/auth/register")
def api_register(body: Credentials, response: Response) -> dict:
    try:
        uid = auth.register(body.email, body.password)
    except auth.AuthError as exc:
        raise HTTPException(400, str(exc))
    _set_session(response, uid)
    return {"ok": True}


@app.post("/api/auth/login")
def api_login(body: Credentials, response: Response) -> dict:
    try:
        uid = auth.login(body.email, body.password)
    except auth.AuthError as exc:
        raise HTTPException(401, str(exc))
    _set_session(response, uid)
    return {"ok": True}


@app.post("/api/auth/logout")
def api_logout(request: Request, response: Response) -> dict:
    tok = request.cookies.get(auth.COOKIE)
    if tok:
        auth.end_session(tok)
    response.delete_cookie(auth.COOKIE, path="/")
    return {"ok": True}


@app.get("/api/me")
def api_me(request: Request) -> dict:
    user = current_user(request)
    if user is None:
        return {"logged_in": False, "billing": config.BILLING}
    return {"logged_in": True, "billing": config.BILLING, "email": user["email"],
            "credits": db.balance(user["id"]), "history": db.history(user["id"])}


@app.get("/api/packs")
def api_packs() -> dict:
    return {"packs": payments.packs(), "minutes_per_credit": config.SECONDS_PER_CREDIT // 60}


class CheckoutRequest(BaseModel):
    pack_id: str
    waiver: bool = False   # exécution immédiate + renonciation au droit de rétractation
    cgv: bool = False


@app.post("/api/checkout")
def api_checkout(body: CheckoutRequest, request: Request) -> dict:
    user = current_user(request)
    if user is None:
        raise HTTPException(401, "Connecte-toi pour acheter des crédits.")
    if not body.cgv:
        raise HTTPException(400, "Accepte les conditions générales de vente pour continuer.")
    try:
        return {"url": payments.create_checkout(user, body.pack_id, body.waiver)}
    except payments.PaymentError as exc:
        raise HTTPException(400, str(exc))


@app.get("/api/checkout/confirm")
def api_checkout_confirm(session_id: str, request: Request) -> dict:
    user = current_user(request)
    if user is None:
        raise HTTPException(401, "Connecte-toi.")
    try:
        res = payments.confirm_session(user, session_id)
    except payments.PaymentError as exc:
        raise HTTPException(400, str(exc))
    return res | {"balance": db.balance(user["id"])}


@app.post("/api/stripe/webhook")
async def stripe_webhook(request: Request) -> dict:
    payload = await request.body()
    try:
        kind = payments.handle_webhook(payload, request.headers.get("stripe-signature"))
    except payments.PaymentError as exc:
        raise HTTPException(400, str(exc))
    return {"received": kind}


class QuoteRequest(BaseModel):
    prompt: str = Field(default="", max_length=4000)


@app.post("/api/quote")
def api_quote(body: QuoteRequest, request: Request) -> dict:
    """Prix d'un mix avant de le lancer : 1 crédit par tranche de 10 minutes."""
    dur = parse_duration_s(body.prompt)
    credits = payments.credits_for_duration(dur)
    user = current_user(request)
    return {"billing": config.BILLING, "credits": credits, "duration_s": dur,
            "max_duration_s": credits * config.SECONDS_PER_CREDIT,
            "balance": db.balance(user["id"]) if user else None}


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
async def create_job(request: Request, files: list[UploadFile] = File(...), rights: str = Form("")) -> dict:
    user = require_user(request)
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
           "message": "En file d'attente", "tracks": tracks, "analysis": None, "result": None, "error": None,
           "user_id": user["id"] if user else None, "mix_count": 0}
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
def start_mix(job_id: str, req: MixRequest, request: Request) -> dict:
    job = job_for(request, job_id)
    if job["status"] in ("analyse", "mixage"):
        raise HTTPException(409, "Une opération est déjà en cours pour ces fichiers")
    if not job.get("analysis"):
        raise HTTPException(409, "L'analyse n'est pas terminée")
    charge = None
    if config.BILLING:
        credits = payments.credits_for_duration(parse_duration_s(req.prompt))
        n = int(job.get("mix_count") or 0) + 1
        try:
            db.debit(job["user_id"], credits, "Mix", f"mix:{job_id}:{n}")
        except db.InsufficientCredits as exc:
            raise HTTPException(402, f"{exc} Achète des crédits sur la page Crédits.")
        charge = {"user_id": job["user_id"], "credits": credits, "n": n}
        update(job, mix_count=n)
    update(job, status="mixage", progress=0.0, message="Démarrage du mix", result=None, error=None)
    executor.submit(_run_mix, job, req.prompt, req.corrections, charge)
    return {"ok": True, "credits_used": charge["credits"] if charge else 0}


def _run_mix(job: dict, prompt: str, corrections: dict, charge: dict | None = None) -> None:
    try:
        max_dur = charge["credits"] * config.SECONDS_PER_CREDIT if charge else None
        result = mix_job(jobs_root() / job["id"], job["tracks"], job["analysis"], prompt, corrections,
                         progress_cb(job), max_duration_s=max_dur)
        analysis = json.loads((jobs_root() / job["id"] / "analysis.json").read_text())
        update(job, status="termine", progress=1.0, message="Mix prêt", result=result, analysis=analysis,
               rendered_at=time.time())
    except Exception as exc:
        log.error("mix %s : %s", job["id"], traceback.format_exc())
        msg = str(exc) or exc.__class__.__name__
        if charge:  # mix raté : crédits rendus automatiquement
            db.add_entry(charge["user_id"], charge["credits"], "Remboursement (mix en échec)",
                         f"refund:{job['id']}:{charge['n']}")
            msg += " — tes crédits ont été rendus."
        update(job, status="erreur", error=msg)


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
def job_status(job_id: str, request: Request) -> dict:
    return _public(job_for(request, job_id))


@app.get("/api/jobs/{job_id}/mix.mp3")
def download_mix(job_id: str, request: Request, download: int = 0):
    job = job_for(request, job_id)
    f = jobs_root() / job["id"] / "mix.mp3"
    if job["status"] != "termine" or not f.exists():
        raise HTTPException(404, "Mix pas encore prêt")
    return FileResponse(f, media_type="audio/mpeg",
                        filename="PromptMix.mp3" if download else None)


@app.get("/api/jobs/{job_id}/tracklist.txt", response_class=PlainTextResponse)
def download_tracklist(job_id: str, request: Request):
    job = job_for(request, job_id)
    f = jobs_root() / job["id"] / "tracklist.txt"
    if not f.exists():
        raise HTTPException(404, "Mix pas encore prêt")
    return PlainTextResponse(f.read_text(), headers={"Content-Disposition": 'attachment; filename="PromptMix-tracklist.txt"'})


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


@app.get("/credits")
def credits_page():
    return FileResponse(STATIC / "credits.html")


@app.get("/cgv")
def cgv_page():
    return FileResponse(STATIC / "cgv.html")


app.mount("/static", StaticFiles(directory=STATIC), name="static")
