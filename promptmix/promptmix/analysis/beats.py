"""Grille des temps et des mesures.

Démarche :
1. Estimation grossière (réseau de neurones beat_this si disponible, sinon DSP : autocorrélation
   de l'enveloppe d'attaques).
2. Affinage DSP à la milliseconde, en supposant un tempo constant (musique électronique) :
   recherche de la période qui « replie » le mieux l'enveloppe d'attaques sur un seul cycle.
3. Phase des temps estimée séparément sur trois bandes (basses < 150 Hz, bande complète,
   aigus > 4 kHz). Une basse syncopée ou des charleys sur les contretemps donnent une phase
   différente : on retient le consensus des bandes qui s'accordent.
4. Premier temps de mesure : vote des premiers temps du réseau, sinon accents + changements
   d'énergie en début de mesure.
"""
from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field

import numpy as np
from scipy import signal

from ..config import BEAT_ENGINE, SR

log = logging.getLogger(__name__)

DECIM = 44                       # enveloppes à ~1 kHz
BEATS_PER_BAR = 4
BAND_AGREE_S = 0.015


@dataclass
class BeatGrid:
    bpm: float
    first_beat: float            # instant (s) du temps d'indice 0 (premier temps >= 0)
    downbeat_offset: int         # indice (0..3) du premier « premier temps de mesure »
    n_beats: int
    duration: float
    engine: str = "dsp"
    band_phases_ms: dict = field(default_factory=dict)   # diagnostic : phase par bande vs grille retenue
    phase_source: str = ""                               # bandes retenues
    confidence: float = 0.0

    @property
    def period(self) -> float:
        return 60.0 / self.bpm

    @property
    def bar_s(self) -> float:
        return self.period * BEATS_PER_BAR

    def beat_time(self, k: float) -> float:
        return self.first_beat + k * self.period

    def bar_time(self, bar: float) -> float:
        return self.beat_time(self.downbeat_offset + BEATS_PER_BAR * bar)

    @property
    def n_bars(self) -> int:
        return max(0, (self.n_beats - self.downbeat_offset) // BEATS_PER_BAR)

    def beats(self) -> np.ndarray:
        return self.first_beat + np.arange(self.n_beats) * self.period

    def downbeats(self) -> np.ndarray:
        return np.array([self.bar_time(b) for b in range(self.n_bars)])

    def to_dict(self) -> dict:
        d = asdict(self)
        d["n_bars"] = self.n_bars
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "BeatGrid":
        keys = cls.__dataclass_fields__.keys()
        return cls(**{k: v for k, v in d.items() if k in keys})


# --------------------------------------------------------------------------- enveloppes

_last_low_power: np.ndarray | None = None  # énergie des basses (~1 kHz) du dernier appel, pour les mesures

def to_mono(audio: np.ndarray) -> np.ndarray:
    return audio.mean(axis=1) if audio.ndim == 2 else audio


def band_envelopes(mono: np.ndarray, sr: int = SR) -> tuple[dict[str, np.ndarray], float]:
    """Enveloppes d'attaque (dérivée demi-onde du log-énergie lissé) par bande, à ~1 kHz."""
    env_sr = sr / DECIM
    smooth = signal.butter(2, 160.0, "low", fs=sr, output="sos")
    filters = {
        "low": signal.butter(4, 150.0, "low", fs=sr, output="sos"),
        "full": None,
        "high": signal.butter(4, 4000.0, "high", fs=sr, output="sos"),
    }
    out: dict[str, np.ndarray] = {}
    global _last_low_power
    for name, sos in filters.items():
        y = mono if sos is None else signal.sosfiltfilt(sos, mono)
        e = signal.sosfiltfilt(smooth, y.astype(np.float64) ** 2)[::DECIM]
        e = np.maximum(e, 0.0)
        ref = np.percentile(e, 99) + 1e-12
        if name == "low":
            _last_low_power = e
        if name == "full":  # enveloppe en amplitude (peu compressée) : la grosse caisse y domine
            out["_full_amp"] = np.maximum(np.gradient(np.sqrt(e / ref)), 0.0)
        le = np.log1p(30.0 * e / ref)
        d = np.gradient(le)
        d = np.maximum(d, 0.0)
        # retire la tendance lente pour ne garder que les attaques
        d = d - signal.medfilt(d, 51) if len(d) > 51 else d
        out[name] = np.maximum(d, 0.0)
    return out, env_sr


# --------------------------------------------------------------------------- tempo

def _tempo_prior(bpm: np.ndarray) -> np.ndarray:
    return np.exp(-0.5 * (np.log2(bpm / 125.0) / 0.6) ** 2)


def coarse_period_dsp(env: np.ndarray, env_sr: float, bpm_min: float = 70, bpm_max: float = 200) -> float:
    x = env - env.mean()
    n = len(x)
    nfft = 1 << int(np.ceil(np.log2(2 * n)))
    f = np.fft.rfft(x, nfft)
    ac = np.fft.irfft(f * np.conj(f), nfft)[:n]
    ac /= ac[0] + 1e-12
    lags = np.arange(len(ac))
    lo, hi = int(env_sr * 60 / bpm_max), int(env_sr * 60 / bpm_min)
    cand = lags[lo:hi]
    bpm = 60.0 * env_sr / cand
    # renforce les multiples (2x, 4x) pour stabiliser l'octave
    score = ac[lo:hi].copy()
    for m in (2, 4):
        idx = np.clip(cand * m, 0, len(ac) - 1)
        score += 0.5 * ac[idx]
    score = score * _tempo_prior(bpm)
    i = int(np.argmax(score))
    lag = float(cand[i])
    # affinage sur un multiple long (16 temps) pour gagner en précision
    for mult in (4, 16):
        target = lag * mult
        a, b = int(target * 0.98), int(target * 1.02) + 1
        if b >= len(ac) - 1:
            break
        j = a + int(np.argmax(ac[a:b]))
        if 0 < j < len(ac) - 1:
            y0, y1, y2 = ac[j - 1], ac[j], ac[j + 1]
            den = y0 - 2 * y1 + y2
            jj = j + (0.5 * (y0 - y2) / den if den != 0 else 0.0)
        else:
            jj = j
        lag = jj / mult
    return lag / env_sr


def _fold(env: np.ndarray, env_sr: float, period: float, nbins: int) -> np.ndarray:
    t = np.arange(len(env)) / env_sr
    ph = np.mod(t, period) / period
    idx = np.minimum((ph * nbins).astype(np.int64), nbins - 1)
    h = np.bincount(idx, weights=env, minlength=nbins)
    return h


def _smooth_circ(h: np.ndarray, sigma_bins: float) -> np.ndarray:
    r = int(4 * sigma_bins) + 1
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma_bins) ** 2)
    hp = np.concatenate([h[-r:], h, h[:r]])
    return np.convolve(hp, k / k.sum(), mode="same")[r:-r]


def _fold_sharpness(env, env_sr, period, nbins):
    h = _smooth_circ(_fold(env, env_sr, period, nbins), 1.5)
    return float(h.max() / (h.mean() + 1e-12))


def refine_period(env: np.ndarray, env_sr: float, p0: float) -> float:
    """Cherche la période qui donne le repli le plus net (2 passes : ±1 %, puis fin)."""
    nbins = max(64, int(p0 * 2000))  # ~0,5 ms par case
    best = p0
    for span, steps in ((0.01, 201), (0.0004, 81), (0.00002, 41)):
        cands = best * (1 + np.linspace(-span, span, steps))
        scores = np.array([_fold_sharpness(env, env_sr, p, nbins) for p in cands])
        i = int(np.argmax(scores))
        if 0 < i < len(cands) - 1:
            y0, y1, y2 = scores[i - 1], scores[i], scores[i + 1]
            den = y0 - 2 * y1 + y2
            off = 0.5 * (y0 - y2) / den if den != 0 else 0.0
            best = cands[i] + off * (cands[1] - cands[0])
        else:
            best = cands[i]
    return float(best)


def band_phase_candidates(env: np.ndarray, env_sr: float, period: float) -> list[tuple[float, float]]:
    """Pics du repli d'une bande : liste (phase_s, force normalisée), du plus fort au plus faible."""
    nbins = max(64, int(period * 2000))
    h = _smooth_circ(_fold(env, env_sr, period, nbins), 2.0)
    h = h / (h.max() + 1e-12)
    peaks, props = signal.find_peaks(np.concatenate([h, h[:3]]), height=0.35, distance=max(1, nbins // 16))
    res = []
    for p in peaks:
        p = p % nbins
        y0, y1, y2 = h[(p - 1) % nbins], h[p], h[(p + 1) % nbins]
        den = y0 - 2 * y1 + y2
        off = 0.5 * (y0 - y2) / den if den != 0 else 0.0
        res.append((((p + off + 0.5) / nbins * period) % period, float(y1)))
    res.sort(key=lambda r: -r[1])
    # dédoublonne (pics de bord)
    out: list[tuple[float, float]] = []
    for ph, s in res:
        if all(_circ_dist(ph, q, period) > 0.004 for q, _ in out):
            out.append((ph, s))
    return out


def _circ_dist(a: float, b: float, period: float) -> float:
    d = abs(a - b) % period
    return min(d, period - d)


def _fold_curve(env: np.ndarray, env_sr: float, period: float) -> np.ndarray:
    nbins = max(64, int(period * 2000))
    h = _smooth_circ(_fold(env, env_sr, period, nbins), 2.0)
    return h / (h.max() + 1e-12)


def _at(curve: np.ndarray, phase: float, period: float, win_s: float = 0.006) -> float:
    n = len(curve)
    c = int(phase / period * n)
    w = max(1, int(win_s / period * n))
    return float(max(curve[(c + o) % n] for o in range(-w, w + 1)))


def choose_phase(envs: dict[str, np.ndarray], env_sr: float, period: float,
                 hint: float | None = None) -> tuple[float, dict, str, float]:
    """Phase des temps par comparaison des bandes.

    Piège classique : une basse syncopée donne, dans les graves seuls, un pic de repli décalé
    (ex. sur la 2e double-croche). On ne se fie donc pas aux basses seules :
    - la bande complète (en amplitude, peu compressée) désigne les attaques les plus fortes (grosse caisse) ;
    - les aigus valident la grille à la croche : charleys sur le temps OU sur le contretemps ;
    - les basses ne servent que d'appoint.
    `hint` (phase du réseau de neurones) départage les cas serrés.
    """
    curves = {b: _fold_curve(e, env_sr, period) for b, e in envs.items()}
    curves["full_amp"] = _fold_curve(envs["_full_amp"], env_sr, period) if "_full_amp" in envs else curves["full"]
    bands = [b for b in ("low", "full", "high") if b in envs]
    cands = {b: band_phase_candidates(envs[b], env_sr, period)[:4] for b in bands}
    pool = sorted({round(ph, 4) for lst in cands.values() for ph, _ in lst})
    if hint is not None:
        pool.append(float(hint))
    best = None
    for ph in pool:
        F = _at(curves["full_amp"], ph, period)
        Fl = _at(curves["full"], ph, period)
        L = _at(curves["low"], ph, period)
        H = max(_at(curves["high"], ph, period), _at(curves["high"], (ph + period / 2) % period, period))
        score = 1.0 * F + 0.5 * Fl + 0.3 * L + 0.8 * H
        if hint is not None and _circ_dist(ph, hint, period) <= 0.03:
            score += 0.5
        if best is None or score > best[0]:
            best = (score, ph)
    assert best is not None
    _, ph0 = best
    # affinage : moyenne des pics des bandes qui ont une attaque à moins de 15 ms
    support = {}
    for b in bands:
        near = [(p, s) for p, s in cands[b] if _circ_dist(p, ph0, period) <= BAND_AGREE_S]
        if near:
            support[b] = max(near, key=lambda r: r[1])
    if not support:
        support = {"full": (ph0, 1.0)}
    ang = sum(s * np.exp(2j * np.pi * p / period) for p, s in support.values())
    phase = (np.angle(ang) / (2 * np.pi) * period) % period
    diag = {}
    for b, lst in cands.items():
        if lst:
            d = ((lst[0][0] - phase + period / 2) % period) - period / 2  # meilleur pic de la bande vs retenu
            diag[b] = round(float(1000 * d), 1)
    conf = float(min(1.0, best[0] / 2.2))
    return float(phase), diag, "+".join(sorted(support)), conf


def _regress_period(beats: np.ndarray) -> float:
    """Période par régression linéaire temps ~ indice (robuste à la quantification 20 ms du réseau)."""
    d = np.diff(beats)
    med = float(np.median(d))
    k = np.concatenate([[0], np.cumsum(np.maximum(1, np.round(d / med)))])
    slope, _ = np.polyfit(k, beats, 1)
    for _ in range(2):  # rejette les temps aberrants
        resid = beats - (slope * k + _)
        keep = np.abs(resid) < 0.04
        if keep.sum() < 8:
            break
        slope, _ = np.polyfit(k[keep], beats[keep], 1)
    return float(slope)


def _fix_octave(env: np.ndarray, env_sr: float, period: float, max_bpm: float = 185.0) -> float:
    """Si le repli montre une attaque presque aussi forte au demi-temps, le tempo réel est double."""
    if 120.0 / period > max_bpm:
        return period
    nbins = max(64, int(period * 2000))
    h = _smooth_circ(_fold(env, env_sr, period, nbins), 2.0)
    i = int(np.argmax(h))
    j = (i + nbins // 2) % nbins
    w = max(2, nbins // 50)
    second = max(h[(j + o) % nbins] for o in range(-w, w + 1))
    if second >= 0.6 * h[i]:
        return period / 2
    return period


# --------------------------------------------------------------------------- premiers temps

def choose_downbeat_dsp(envs: dict[str, np.ndarray], env_sr: float, beats: np.ndarray,
                        low_power: np.ndarray | None = None) -> int:
    """Indice 0..3 du premier temps : accent d'attaque + changements d'énergie des basses."""
    if len(beats) < 8:
        return 0
    def at(env, t):
        i = np.clip(np.round(t * env_sr).astype(int), 0, len(env) - 1)
        w = 12  # ±12 ms
        return np.array([env[max(0, j - w): j + w + 1].max() for j in i])
    acc = at(envs["full"], beats) + at(envs["low"], beats)
    # énergie des basses par temps (pour repérer les entrées / sorties de basse)
    lowcum = np.cumsum(envs["low"])
    idx = np.clip((beats * env_sr).astype(int), 0, len(lowcum) - 1)
    per_beat = np.diff(np.concatenate([[0], lowcum[idx]]))
    change = np.abs(np.diff(per_beat, prepend=per_beat[0]))
    acc = acc / (acc.mean() + 1e-12)
    change = change / (change.mean() + 1e-12)
    score = np.array([acc[o::4].mean() + 0.5 * change[o::4].mean() for o in range(4)])
    # entrées / sorties franches de la basse (break, drop) : elles tombent sur des premiers temps
    if low_power is not None:
        lp = np.cumsum(low_power)
        edges = np.clip((np.concatenate([beats, [beats[-1] + np.median(np.diff(beats))]]) * env_sr).astype(int), 0, len(lp) - 1)
        per = np.diff(lp[edges]) / np.maximum(1, np.diff(edges))
        ldb = 10 * np.log10(per + 1e-12)
        jumps = np.abs(np.diff(ldb))
        big = np.where(jumps > 6.0)[0] + 1  # indice du temps où l'énergie change
        if len(big):
            votes = np.bincount(big % 4, weights=jumps[big - 1], minlength=4)
            score = score + 2.0 * votes / (votes.max() + 1e-12)
    return int(np.argmax(score))


# --------------------------------------------------------------------------- réseau de neurones

_bt_model = None


def _beat_this(mono: np.ndarray, sr: int):
    global _bt_model
    from beat_this.inference import Audio2Beats  # import paresseux (torch)
    if _bt_model is None:
        _bt_model = Audio2Beats(checkpoint_path="final0", device="cpu", dbn=False)
    beats, downbeats = _bt_model(mono.astype(np.float32), sr)
    return np.asarray(beats, float), np.asarray(downbeats, float)


def _engine() -> str:
    if BEAT_ENGINE in ("dsp", "beat_this"):
        return BEAT_ENGINE
    try:
        import beat_this  # noqa: F401
        return "beat_this"
    except Exception:
        return "dsp"


# --------------------------------------------------------------------------- API

def detect_grid(audio: np.ndarray, sr: int = SR, engine: str | None = None,
                bpm_override: float | None = None, downbeat_override: float | None = None) -> BeatGrid:
    """Détecte la grille. `bpm_override` : BPM corrigé par l'utilisateur (la phase reste mesurée).
    `downbeat_override` : instant (s) d'un premier temps de mesure imposé."""
    mono = to_mono(audio).astype(np.float64)
    duration = len(mono) / sr
    envs, env_sr = band_envelopes(mono, sr)
    engine = engine or _engine()

    nn_beats = nn_down = None
    if engine == "beat_this" and bpm_override is None:
        try:
            nn_beats, nn_down = _beat_this(mono, sr)
        except Exception as exc:  # modèle indisponible (réseau, mémoire...) -> DSP
            log.warning("beat_this indisponible (%s), repli DSP", exc)
            engine = "dsp"
    if engine == "beat_this" and (nn_beats is None or len(nn_beats) < 8):
        engine = "dsp"

    if bpm_override:
        p0 = 60.0 / float(bpm_override)
        period = refine_period(envs["full"], env_sr, p0)
        # le BPM imposé fait foi s'il diffère réellement (version accélérée, etc.)
        if abs(period / p0 - 1) > 0.003:
            period = p0
    else:
        if engine == "beat_this":
            p0 = _regress_period(nn_beats)
        else:
            p0 = coarse_period_dsp(envs["full"] + envs["low"], env_sr)
        combo = envs["full"] + 0.5 * envs["low"] + 0.5 * envs["high"]
        period = refine_period(combo, env_sr, p0)
        if engine == "dsp":
            period = _fix_octave(combo, env_sr, period)
        else:
            # garde-fou : on confronte la période du réseau à l'estimation DSP, la plus nette gagne
            alt = _fix_octave(combo, env_sr, refine_period(combo, env_sr, coarse_period_dsp(envs["full"] + envs["low"], env_sr)))
            nb = max(64, int(period * 2000))
            if abs(alt / period - 1) > 0.002 and \
                    _fold_sharpness(combo, env_sr, alt, nb) > 1.15 * _fold_sharpness(combo, env_sr, period, nb):
                log.info("période beat_this %.3f BPM remplacée par DSP %.3f BPM", 60 / period, 60 / alt)
                period = alt

    hint = None
    if nn_beats is not None:
        ang = np.exp(2j * np.pi * (nn_beats % period) / period).mean()
        hint = (np.angle(ang) / (2 * np.pi) * period) % period
    phase, diag, src, conf = choose_phase(envs, env_sr, period, hint)
    first = phase % period
    n_beats = int(np.floor((duration - first) / period)) + 1
    beats = first + np.arange(n_beats) * period

    if downbeat_override is not None:
        k = int(round((downbeat_override - first) / period))
        dboff = k % BEATS_PER_BAR
    elif nn_down is not None and len(nn_down) >= 2:
        ks = np.round((nn_down - first) / period).astype(int) % BEATS_PER_BAR
        votes = np.bincount(ks, minlength=4)
        dboff = int(votes.argmax())
        if votes.max() < 0.7 * votes.sum():  # réseau hésitant -> accents / énergie
            dboff = choose_downbeat_dsp(envs, env_sr, beats, _last_low_power)
    else:
        dboff = choose_downbeat_dsp(envs, env_sr, beats, _last_low_power)

    return BeatGrid(bpm=float(60.0 / period), first_beat=float(first), downbeat_offset=int(dboff),
                    n_beats=n_beats, duration=float(duration), engine=engine, band_phases_ms=diag,
                    phase_source=src, confidence=round(conf, 3))


def measure_phase(audio: np.ndarray, period: float, sr: int = SR) -> tuple[float, str, float]:
    """Phase des temps (s, modulo la période) d'un extrait dont la période est connue.
    Retourne (phase, bandes retenues, confiance 0..1)."""
    envs, env_sr = band_envelopes(to_mono(audio).astype(np.float64), sr)
    ph, _, src, conf = choose_phase(envs, env_sr, period)
    return ph, src, conf
