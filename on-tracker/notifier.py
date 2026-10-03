"""Envoi des alertes : console, ntfy (appli mobile gratuite) et Telegram."""
import logging

import requests

log = logging.getLogger("notifier")


class Notifier:
    def __init__(self, cfg: dict):
        self.ntfy_topic = (cfg.get("ntfy_topic") or "").strip()
        self.ntfy_server = (cfg.get("ntfy_serveur") or "https://ntfy.sh").rstrip("/")
        self.tg_token = (cfg.get("telegram_bot_token") or "").strip()
        self.tg_chat = str(cfg.get("telegram_chat_id") or "").strip()

    def send(self, title: str, message: str, urgent: bool = False, tags=None):
        print(f"\n🔔 {title}\n{message}\n", flush=True)
        if self.ntfy_topic:
            try:
                requests.post(
                    self.ntfy_server + "/",
                    json={
                        "topic": self.ntfy_topic,
                        "title": title,
                        "message": message,
                        "priority": 5 if urgent else 4,
                        "tags": tags or [],
                    },
                    timeout=10,
                ).raise_for_status()
            except requests.RequestException as e:
                log.warning("ntfy : échec d'envoi (%s)", e)
        if self.tg_token and self.tg_chat:
            try:
                requests.post(
                    f"https://api.telegram.org/bot{self.tg_token}/sendMessage",
                    json={"chat_id": self.tg_chat, "text": f"{title}\n\n{message}"},
                    timeout=10,
                ).raise_for_status()
            except requests.RequestException as e:
                log.warning("Telegram : échec d'envoi (%s)", e)
