"""Entrées/sorties audio : décodage ffmpeg, encodage MP3, time-stretch Rubber Band, tags ID3."""
from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .config import CHANNELS, SR


class AudioError(RuntimeError):
    pass


def _run(cmd: list[str], stdin: bytes | None = None) -> bytes:
    proc = subprocess.run(cmd, input=stdin, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        raise AudioError(proc.stderr.decode("utf-8", "replace")[-800:])
    return proc.stdout


def decode(path: str | Path, sr: int = SR) -> np.ndarray:
    """Décode n'importe quel fichier lisible par ffmpeg en float32 (n, 2)."""
    raw = _run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(path), "-map", "0:a:0",
                "-f", "f32le", "-acodec", "pcm_f32le", "-ac", str(CHANNELS), "-ar", str(sr), "pipe:1"])
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, CHANNELS).copy()


def encode_mp3(audio: np.ndarray, path: str | Path, bitrate: str = "320k", sr: int = SR,
               tags: dict[str, str] | None = None) -> None:
    meta: list[str] = []
    for k, v in (tags or {}).items():
        meta += ["-metadata", f"{k}={v}"]
    data = np.ascontiguousarray(audio, dtype=np.float32).tobytes()
    _run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "f32le", "-ar", str(sr), "-ac", str(CHANNELS),
          "-i", "pipe:0", "-c:a", "libmp3lame", "-b:a", bitrate, "-id3v2_version", "3", *meta, str(path)],
         stdin=data)


def write_wav(audio: np.ndarray, path: str | Path, sr: int = SR) -> None:
    import soundfile as sf
    sf.write(str(path), audio, sr, subtype="FLOAT")


def time_stretch(audio: np.ndarray, ratio: float, sr: int = SR) -> np.ndarray:
    """Change le tempo d'un facteur `ratio` (>1 = plus rapide) sans toucher à la tonalité (Rubber Band).

    La longueur de sortie est recalée exactement sur len/ratio pour que la grille des temps
    reste mathématiquement prévisible (t' = t / ratio).
    """
    if abs(ratio - 1.0) < 1e-5:
        return audio.copy()
    n_out = int(round(len(audio) / ratio))
    # Rubber Band (filtre ffmpeg) : tempo seul, pitch conservé, transitoires nettes pour les kicks.
    af = f"rubberband=tempo={ratio:.8f}:transients=crisp:detector=percussive:pitchq=quality:channels=together"
    raw = _run(["ffmpeg", "-nostdin", "-v", "error", "-f", "f32le", "-ar", str(sr), "-ac", str(CHANNELS),
                "-i", "pipe:0", "-af", af, "-f", "f32le", "-acodec", "pcm_f32le", "pipe:1"],
               stdin=np.ascontiguousarray(audio, dtype=np.float32).tobytes())
    out = np.frombuffer(raw, dtype=np.float32).reshape(-1, CHANNELS)
    if len(out) >= n_out:
        return out[:n_out].copy()
    return np.concatenate([out, np.zeros((n_out - len(out), CHANNELS), np.float32)])


# --------------------------------------------------------------------------- tags

@dataclass
class TrackTags:
    artist: str
    title: str
    source: str  # "id3" | "nom de fichier"

    @property
    def display(self) -> str:
        return f"{self.artist} – {self.title}" if self.artist else self.title


def read_tags(path: str | Path, original_name: str) -> TrackTags:
    artist = title = ""
    try:
        from mutagen.easyid3 import EasyID3
        t = EasyID3(str(path))
        artist = (t.get("artist") or [""])[0].strip()
        title = (t.get("title") or [""])[0].strip()
    except Exception:
        pass
    if title:
        return TrackTags(artist, title, "id3")
    stem = Path(original_name).stem
    stem = re.sub(r"[_]+", " ", stem).strip()
    m = re.match(r"^\s*(?:\d+[\s.\-]+)?(.+?)\s+[-–—]\s+(.+)$", stem)
    if m:
        return TrackTags(m.group(1).strip(), m.group(2).strip(), "nom de fichier")
    return TrackTags(artist, stem, "nom de fichier")


def looks_like_mp3(head: bytes) -> bool:
    """Vérifie la signature : tag ID3v2 ou synchro de trame MPEG audio layer III."""
    if head[:3] == b"ID3":
        return True
    for i in range(min(len(head) - 1, 4096)):
        if head[i] == 0xFF and (head[i + 1] & 0xE0) == 0xE0 and ((head[i + 1] >> 1) & 0x3) == 0x1:
            return True
    return False


def probe_codec(path: str | Path) -> str:
    out = _run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_name",
                "-of", "default=nw=1:nk=1", str(path)])
    return out.decode().strip()
