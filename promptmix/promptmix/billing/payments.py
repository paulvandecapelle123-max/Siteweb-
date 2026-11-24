"""Paiement par carte avec Stripe Checkout.

Parcours : la page Crédits appelle `create_checkout` -> le client paie sur la page sécurisée de Stripe
(carte, Apple Pay, Google Pay…) -> Stripe prévient le serveur (webhook `checkout.session.completed`)
-> les crédits sont ajoutés. Au retour sur la page, `confirm_session` vérifie aussi le paiement
(au cas où le webhook arrive après) : la référence unique du paiement empêche tout double crédit.

PromptMix ne voit ni ne stocke jamais de numéro de carte. L'argent arrive sur le compte Stripe,
qui le vire automatiquement sur le compte bancaire (IBAN) renseigné dans le tableau de bord Stripe.
"""
from __future__ import annotations

import json
import logging
import math
import os

from .. import config
from . import db

log = logging.getLogger(__name__)


class PaymentError(RuntimeError):
    pass


def packs() -> list[dict]:
    raw = os.environ.get("PROMPTMIX_PACKS")
    data = json.loads(raw) if raw else config.DEFAULT_PACKS
    out = []
    for p in data:
        p = {"id": str(p["id"]), "name": str(p["name"]), "credits": int(p["credits"]), "price_cents": int(p["price_cents"])}
        p["price_eur"] = f"{p['price_cents'] / 100:.2f}".replace(".", ",") + " €"
        p["per_mix_eur"] = f"{p['price_cents'] / 100 / p['credits']:.2f}".replace(".", ",") + " €"
        out.append(p)
    return out


def credits_for_duration(duration_s: float | None) -> int:
    """1 crédit par tranche de 10 minutes de mix (minimum 1)."""
    if not duration_s:
        return 1
    return max(1, math.ceil(duration_s / config.SECONDS_PER_CREDIT - 1e-9))


def _client():
    key = os.environ.get("STRIPE_SECRET_KEY")
    if not key:
        raise PaymentError("Paiement non configuré (STRIPE_SECRET_KEY absente).")
    import stripe
    return stripe.StripeClient(key)


def create_checkout(user: dict, pack_id: str, waiver_accepted: bool) -> str:
    """Crée une page de paiement Stripe et retourne son adresse."""
    if not waiver_accepted:
        raise PaymentError("Coche la case sur l'exécution immédiate pour continuer.")
    pack = next((p for p in packs() if p["id"] == pack_id), None)
    if pack is None:
        raise PaymentError("Pack inconnu.")
    session = _client().v1.checkout.sessions.create(params={
        "mode": "payment",
        "customer_email": user["email"],
        "client_reference_id": str(user["id"]),
        "line_items": [{
            "quantity": 1,
            "price_data": {
                "currency": "eur",
                "unit_amount": pack["price_cents"],
                "product_data": {"name": f"PromptMix — {pack['name']}",
                                 "description": f"{pack['credits']} crédits (1 crédit = 1 mix jusqu'à 10 minutes)"},
            },
        }],
        "metadata": {"user_id": str(user["id"]), "pack_id": pack["id"], "credits": str(pack["credits"])},
        "payment_intent_data": {"metadata": {"user_id": str(user["id"]), "pack_id": pack["id"]}},
        "success_url": f"{config.PUBLIC_URL}/credits?session_id={{CHECKOUT_SESSION_ID}}",
        "cancel_url": f"{config.PUBLIC_URL}/credits?annule=1",
        "locale": "fr",
    })
    return session.url


def _grant(session) -> bool:
    """Crédite le compte pour une session Checkout payée. Idempotent (référence = id de la session)."""
    s = session.to_dict() if hasattr(session, "to_dict") else dict(session)
    if s.get("payment_status") != "paid":
        return False
    meta = s.get("metadata") or {}
    try:
        user_id, credits = int(meta["user_id"]), int(meta["credits"])
    except (KeyError, ValueError):
        log.error("session Stripe %s sans métadonnées PromptMix", s.get("id"))
        return False
    # on ne fait confiance qu'au montant réellement payé : il doit correspondre au pack
    pack = next((p for p in packs() if p["id"] == meta.get("pack_id")), None)
    if pack is None or pack["credits"] != credits or s.get("amount_total") != pack["price_cents"]:
        log.error("session Stripe %s : montant ou pack incohérent", s.get("id"))
        return False
    added = db.add_entry(user_id, credits, f"Achat : {pack['name']}", f"stripe:{s['id']}", s.get("amount_total"))
    if added:
        log.info("crédits ajoutés : utilisateur %s +%s (%s)", user_id, credits, s["id"])
    return added


def handle_webhook(payload: bytes, signature: str | None) -> str:
    """Vérifie la signature Stripe puis traite l'événement."""
    secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
    if not secret:
        raise PaymentError("STRIPE_WEBHOOK_SECRET absente.")
    import stripe
    try:
        event = stripe.Webhook.construct_event(payload, signature, secret)
    except (ValueError, stripe.SignatureVerificationError) as exc:
        raise PaymentError("Signature Stripe invalide.") from exc
    if event["type"] in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        _grant(event["data"]["object"])
    return event["type"]


def confirm_session(user: dict, session_id: str) -> dict:
    """Au retour de Stripe : vérifie le paiement directement auprès de Stripe."""
    s = _client().v1.checkout.sessions.retrieve(session_id)
    d = s.to_dict()
    if str((d.get("metadata") or {}).get("user_id")) != str(user["id"]):
        raise PaymentError("Ce paiement ne correspond pas à ton compte.")
    _grant(d)
    return {"paid": d.get("payment_status") == "paid", "credits": int((d.get("metadata") or {}).get("credits", 0))}
