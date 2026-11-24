"""Comptes, crédits et paiement Stripe (appels à Stripe simulés, signatures de webhook réelles)."""
import hashlib
import hmac
import json
import time
import uuid
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from promptmix import config, server
from promptmix.billing import db, payments

WH_SECRET = "whsec_test_secret"


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DATA_DIR", tmp_path)
    monkeypatch.setattr(config, "BILLING", True)
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_dummy")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", WH_SECRET)
    return TestClient(server.app)


def register(c, email="dj@example.com", pw="motdepasse1"):
    r = c.post("/api/auth/register", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return c.get("/api/me").json()


def signed(payload: dict, secret: str = WH_SECRET) -> tuple[bytes, str]:
    body = json.dumps(payload).encode()
    t = int(time.time())
    sig = hmac.new(secret.encode(), f"{t}.".encode() + body, hashlib.sha256).hexdigest()
    return body, f"t={t},v1={sig}"


def checkout_event(user_id, pack_id="pack5", credits=5, amount=699, paid="paid", sid=None):
    return {"id": f"evt_{uuid.uuid4().hex}", "object": "event", "type": "checkout.session.completed",
            "data": {"object": {"id": sid or f"cs_test_{uuid.uuid4().hex}", "object": "checkout.session",
                                "payment_status": paid, "amount_total": amount,
                                "metadata": {"user_id": str(user_id), "pack_id": pack_id, "credits": str(credits)}}}}


# ------------------------------------------------------------------ comptes

def test_register_gives_welcome_credit(client):
    me = register(client)
    assert me["logged_in"] and me["credits"] == 1 and me["email"] == "dj@example.com"


def test_register_rules(client):
    assert client.post("/api/auth/register", json={"email": "pasunmail", "password": "motdepasse1"}).status_code == 400
    assert client.post("/api/auth/register", json={"email": "a@b.fr", "password": "court"}).status_code == 400
    register(client, "a@b.fr")
    assert client.post("/api/auth/register", json={"email": "A@B.fr", "password": "motdepasse1"}).status_code == 400


def test_login_logout(client):
    register(client)
    client.post("/api/auth/logout", json={})
    assert client.get("/api/me").json()["logged_in"] is False
    assert client.post("/api/auth/login", json={"email": "dj@example.com", "password": "mauvais!!"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "DJ@example.com", "password": "motdepasse1"}).status_code == 200
    assert client.get("/api/me").json()["logged_in"] is True


def test_upload_requires_login_when_billing(client):
    r = client.post("/api/jobs", data={"rights": "true"}, files=[("files", ("a.mp3", b"x", "audio/mpeg"))] * 2)
    assert r.status_code == 401


# ------------------------------------------------------------------ prix

@pytest.mark.parametrize("prompt,credits", [("mix de 5 minutes", 1), ("10 min", 1), ("un mix de 25 minutes", 3),
                                            ("pas de durée", 1), ("12:30", 2)])
def test_quote(client, prompt, credits):
    assert client.post("/api/quote", json={"prompt": prompt}).json()["credits"] == credits


def test_packs_prices():
    ps = payments.packs()
    assert all(p["price_cents"] > 0 and p["credits"] > 0 for p in ps)
    assert ps[0]["price_eur"].endswith("€")


# ------------------------------------------------------------------ paiement

class FakeStripe:
    def __init__(self):
        self.created = None
        self.sessions = {}
        outer = self

        class Sessions:
            def create(self, params):
                outer.created = params
                return SimpleNamespace(url="https://checkout.stripe.com/c/pay/cs_test_123")

            def retrieve(self, sid):
                d = outer.sessions[sid]
                return SimpleNamespace(to_dict=lambda: d)

        self.v1 = SimpleNamespace(checkout=SimpleNamespace(sessions=Sessions()))


def test_checkout_creates_stripe_session(client, monkeypatch):
    fake = FakeStripe()
    monkeypatch.setattr(payments, "_client", lambda: fake)
    me = register(client)
    assert client.post("/api/checkout", json={"pack_id": "pack5", "cgv": True, "waiver": False}).status_code == 400
    assert client.post("/api/checkout", json={"pack_id": "pack5", "cgv": False, "waiver": True}).status_code == 400
    assert client.post("/api/checkout", json={"pack_id": "inconnu", "cgv": True, "waiver": True}).status_code == 400
    r = client.post("/api/checkout", json={"pack_id": "pack5", "cgv": True, "waiver": True})
    assert r.json()["url"].startswith("https://checkout.stripe.com/")
    p = fake.created
    assert p["mode"] == "payment" and p["customer_email"] == me["email"]
    assert p["line_items"][0]["price_data"]["unit_amount"] == 699 and p["line_items"][0]["price_data"]["currency"] == "eur"
    assert p["metadata"]["credits"] == "5" and "{CHECKOUT_SESSION_ID}" in p["success_url"]


def test_checkout_requires_login(client):
    assert client.post("/api/checkout", json={"pack_id": "pack5", "cgv": True, "waiver": True}).status_code == 401


def test_webhook_adds_credits_once(client):
    register(client)
    uid = 1
    body, sig = signed(checkout_event(uid, sid="cs_test_abc"))
    assert client.post("/api/stripe/webhook", content=body, headers={"stripe-signature": sig}).status_code == 200
    assert client.get("/api/me").json()["credits"] == 1 + 5
    # Stripe renvoie parfois le même événement : pas de double crédit
    body, sig = signed(checkout_event(uid, sid="cs_test_abc"))
    client.post("/api/stripe/webhook", content=body, headers={"stripe-signature": sig})
    assert client.get("/api/me").json()["credits"] == 6


def test_webhook_rejects_bad_signature(client):
    register(client)
    body, sig = signed(checkout_event(1), secret="whsec_pirate")
    assert client.post("/api/stripe/webhook", content=body, headers={"stripe-signature": sig}).status_code == 400
    assert client.post("/api/stripe/webhook", content=body).status_code == 400
    assert client.get("/api/me").json()["credits"] == 1


@pytest.mark.parametrize("kw", [{"paid": "unpaid"}, {"amount": 100}, {"credits": 500}])
def test_webhook_ignores_unpaid_or_tampered(client, kw):
    register(client)
    body, sig = signed(checkout_event(1, **kw))
    assert client.post("/api/stripe/webhook", content=body, headers={"stripe-signature": sig}).status_code == 200
    assert client.get("/api/me").json()["credits"] == 1


def test_confirm_on_return_and_no_double_with_webhook(client, monkeypatch):
    fake = FakeStripe()
    monkeypatch.setattr(payments, "_client", lambda: fake)
    register(client)
    ev = checkout_event(1, sid="cs_test_ret")
    fake.sessions["cs_test_ret"] = ev["data"]["object"]
    r = client.get("/api/checkout/confirm", params={"session_id": "cs_test_ret"}).json()
    assert r["paid"] and r["balance"] == 6
    body, sig = signed(ev)  # le webhook arrive après : rien de plus
    client.post("/api/stripe/webhook", content=body, headers={"stripe-signature": sig})
    assert client.get("/api/me").json()["credits"] == 6


def test_confirm_refuses_other_users_payment(client, monkeypatch):
    fake = FakeStripe()
    monkeypatch.setattr(payments, "_client", lambda: fake)
    register(client)
    fake.sessions["cs_x"] = checkout_event(999, sid="cs_x")["data"]["object"]
    assert client.get("/api/checkout/confirm", params={"session_id": "cs_x"}).status_code == 400


# ------------------------------------------------------------------ consommation des crédits

class SyncExecutor:
    def submit(self, fn, *a):
        fn(*a)


FAKE_ANALYSIS = {"track_id": 1, "filename": "a.mp3", "display": "A – B", "artist": "A", "title": "B",
                 "tag_source": "id3", "duration_s": 60.0, "bpm": 128.0, "bpm_corrected": False,
                 "key": {"name": "La mineur", "short": "Am", "camelot": "8A"}, "key_corrected": False,
                 "sections": {"sections": []}, "grid": {"n_bars": 30, "engine": "dsp", "band_phases_ms": {}}}


def fake_job(user_id, status="pret"):
    jid = str(uuid.uuid4())
    d = server.jobs_root() / jid
    d.mkdir(parents=True)
    job = {"id": jid, "created_at": time.time(), "status": status, "progress": 1.0, "message": "", "tracks": [],
           "analysis": [FAKE_ANALYSIS], "result": None, "error": None, "user_id": user_id, "mix_count": 0}
    (d / "job.json").write_text(json.dumps(job))
    (d / "analysis.json").write_text(json.dumps([FAKE_ANALYSIS]))
    return jid


def test_mix_debits_and_refunds_on_failure(client, monkeypatch):
    monkeypatch.setattr(server, "executor", SyncExecutor())
    register(client)
    jid = fake_job(1)

    def boom(*a, **kw):
        raise RuntimeError("panne")
    monkeypatch.setattr(server, "mix_job", boom)
    r = client.post(f"/api/jobs/{jid}/mix", json={"prompt": "mix de 5 minutes"})
    assert r.json()["credits_used"] == 1
    assert client.get("/api/me").json()["credits"] == 1          # rendu après l'échec
    assert "rendus" in client.get(f"/api/jobs/{jid}").json()["error"]


def test_mix_success_consumes_and_limits_duration(client, monkeypatch):
    monkeypatch.setattr(server, "executor", SyncExecutor())
    register(client)
    jid = fake_job(1)
    seen = {}

    def ok(*a, max_duration_s=None, **kw):
        seen["max"] = max_duration_s
        return {"ok": True}
    monkeypatch.setattr(server, "mix_job", ok)
    client.post(f"/api/jobs/{jid}/mix", json={"prompt": "un mix de 8 minutes"})
    assert client.get("/api/me").json()["credits"] == 0 and seen["max"] == 600
    # plus de crédits : refus avec 402
    r = client.post(f"/api/jobs/{jid}/mix", json={"prompt": "encore"})
    assert r.status_code == 402 and "crédit" in r.json()["detail"]


def test_jobs_are_private(client, monkeypatch):
    register(client, "a@a.fr")
    jid = fake_job(1)
    assert client.get(f"/api/jobs/{jid}").status_code == 200
    client.post("/api/auth/logout", json={})
    register(client, "b@b.fr")
    assert client.get(f"/api/jobs/{jid}").status_code == 404
    assert client.post(f"/api/jobs/{jid}/mix", json={"prompt": "abc"}).status_code == 404


def test_debit_never_negative(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DATA_DIR", tmp_path)
    db.add_entry(7, 2, "test", "t1")
    db.debit(7, 2, "mix", "m1")
    with pytest.raises(db.InsufficientCredits):
        db.debit(7, 1, "mix", "m2")
    assert db.balance(7) == 0


def test_billing_off_keeps_local_mode(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DATA_DIR", tmp_path)
    monkeypatch.setattr(config, "BILLING", False)
    c = TestClient(server.app)
    assert c.get("/api/me").json() == {"logged_in": False, "billing": False}
    jid = fake_job(None)
    assert c.get(f"/api/jobs/{jid}").status_code == 200
