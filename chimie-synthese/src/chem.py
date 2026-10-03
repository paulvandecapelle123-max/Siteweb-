"""Petit moteur de dessin SVG pour formules chimiques (développées / semi-développées).

Coordonnées en « unités de grille » (u px) ; y vers le bas.
Les chiffres qui suivent une lettre, ')' ou ']' deviennent des indices (CH3 -> CH₃).
Dans un texte libre, ⟦...⟧ = formule chimique, **...** = gras.
"""
import math
import re
from html import escape

INK = '#1f2430'
ACID = '#1764ab'    # partie venant de l'acide
ALC = '#c45f00'     # partie venant de l'alcool
WAT = '#c81e3a'     # atomes qui partent (eau, HCl)
NEW = '#7a2db8'     # nouvelle liaison formée
AMI = '#16834a'     # partie amine
GREY = '#8a8f99'
ELEC = '#0aa5a5'    # électrons célibataires
FONT = "'Source Sans 3','Liberation Sans',Arial,sans-serif"


def runs(lab):
    out = []
    prev = ''
    for ch in lab:
        sub = ch.isdigit() and (prev.isalpha() or (prev != '' and prev in ')]') or (bool(out) and out[-1][1] and prev.isdigit()))
        if ch == 'n' and prev != '' and prev in ')]':
            sub = True
        if out and out[-1][1] == sub:
            out[-1][0] += ch
        else:
            out.append([ch, sub])
        prev = ch
    return out


def rich_runs(text):
    res = []
    bold = False
    for part in re.split(r'(⟦[^⟧]*⟧|\*\*)', text):
        if part == '**':
            bold = not bold
            continue
        if not part:
            continue
        if part.startswith('⟦'):
            for t, sub in runs(part[1:-1].replace('-', '–')):
                res.append((t, sub, bold))
        else:
            res.append((part, False, bold))
    return res


def char_w(ch, fs, sub=False, bold=False):
    if sub:
        w = 0.40
    elif ch in 'MW':
        w = 0.84
    elif ch.isupper():
        w = 0.60
    elif ch in "il.,:;!|'’ ":
        w = 0.26
    elif ch in '()[]':
        w = 0.31
    elif ch in 'mw':
        w = 0.76
    elif ch.isdigit():
        w = 0.50
    elif ch in '→⇌⟶':
        w = 1.0
    else:
        w = 0.48
    return w * fs * (1.06 if bold else 1.0)


def rich_w(text, fs):
    return sum(char_w(c, fs, s, b) for t, s, b in rich_runs(text) for c in t)


def lab_w(lab, fs):
    return sum(char_w(c, fs, s) for t, s in runs(lab) for c in t)


def emit(rs, fs):
    s = ''
    cur = 0.0
    d = round(fs * 0.3, 1)
    for t, sub, b in rs:
        target = d if sub else 0.0
        attrs = ''
        if target != cur:
            attrs += f' dy="{target - cur:.1f}"'
            cur = target
        if sub:
            attrs += f' font-size="{fs * 0.7:.1f}"'
        if b:
            attrs += ' font-weight="700"'
        s += f'<tspan{attrs}>{escape(t)}</tspan>' if attrs else escape(t)
    return s


class Mol:
    def __init__(self, u=30, fs=15):
        self.u = u
        self.fs = fs
        self.at = {}
        self.bg, self.mid, self.fg = [], [], []
        self.bb = [1e9, 1e9, -1e9, -1e9]

    # ---------- bornes ----------
    def _ext(self, x0, y0, x1=None, y1=None):
        if x1 is None:
            x1, y1 = x0, y0
        b = self.bb
        b[0] = min(b[0], x0, x1)
        b[1] = min(b[1], y0, y1)
        b[2] = max(b[2], x0, x1)
        b[3] = max(b[3], y0, y1)

    # ---------- atomes & liaisons ----------
    def a(self, name, x, y, lab='C', col=INK, fs=None, weight=None):
        fs = fs or self.fs
        X, Y = x * self.u, y * self.u
        w = lab_w(lab, fs) if lab else 0
        self.at[name] = dict(X=X, Y=Y, lab=lab, col=col, fs=fs,
                             hw=(w / 2 + 2.5) if lab else 0, hh=(fs * 0.42 + 2.5) if lab else 0)
        if lab:
            fw = f' font-weight="{weight}"' if weight else ''
            self.fg.append(f'<text x="{X:.1f}" y="{Y + fs * 0.35:.1f}" text-anchor="middle" '
                           f'font-size="{fs}" fill="{col}"{fw}>{emit([(t, s, False) for t, s in runs(lab)], fs)}</text>')
            self._ext(X - w / 2, Y - fs * 0.62, X + w / 2, Y + fs * 0.62)
        else:
            self._ext(X, Y)
        return name

    def b(self, n1, n2, o=1, col=INK, col2=None, w=1.5, dash=False, dash2=False):
        A, B = self.at[n1], self.at[n2]
        x1, y1, x2, y2 = A['X'], A['Y'], B['X'], B['Y']
        dx, dy = x2 - x1, y2 - y1
        L = math.hypot(dx, dy)

        def clip(at):
            if not at['lab']:
                return 0.0
            tx = at['hw'] / abs(dx) if abs(dx) > 1e-6 else 1e9
            ty = at['hh'] / abs(dy) if abs(dy) > 1e-6 else 1e9
            return min(tx, ty)

        t1, t2 = clip(A), clip(B)
        sx, sy = x1 + dx * t1, y1 + dy * t1
        ex, ey = x2 - dx * t2, y2 - dy * t2
        if o == 1:
            self._line(sx, sy, ex, ey, col, w, dash)
        else:
            nx, ny = -dy / L * 2.7, dx / L * 2.7
            self._line(sx + nx, sy + ny, ex + nx, ey + ny, col, w, dash)
            self._line(sx - nx, sy - ny, ex - nx, ey - ny, col2 or col, w, dash2)

    def _line(self, x1, y1, x2, y2, col=INK, w=1.5, dash=False, cap='round'):
        d = ' stroke-dasharray="4 3"' if dash else ''
        if dash and isinstance(dash, str):
            d = f' stroke-dasharray="{dash}"'
        self.mid.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{col}" '
                        f'stroke-width="{w}" stroke-linecap="{cap}"{d}/>')
        self._ext(x1, y1, x2, y2)

    def line(self, x1, y1, x2, y2, col=INK, w=1.5, dash=False):
        u = self.u
        self._line(x1 * u, y1 * u, x2 * u, y2 * u, col, w, dash)

    # ---------- surlignages ----------
    def hl(self, names, col, pad=2.5, fill=None, dash=True, r=6, w=1.4, opacity=1):
        xs, ys = [], []
        for n in names:
            A = self.at[n]
            hw = A['hw'] or 3
            hh = A['hh'] or 3
            xs += [A['X'] - hw, A['X'] + hw]
            ys += [A['Y'] - hh, A['Y'] + hh]
        x0, x1, y0, y1 = min(xs) - pad, max(xs) + pad, min(ys) - pad, max(ys) + pad
        d = ' stroke-dasharray="4 2.5"' if dash else ''
        f = fill or 'none'
        self.bg.append(f'<rect x="{x0:.1f}" y="{y0:.1f}" width="{x1 - x0:.1f}" height="{y1 - y0:.1f}" rx="{r}" '
                       f'fill="{f}" stroke="{col}" stroke-width="{w}"{d} opacity="{opacity}"/>')
        self._ext(x0, y0, x1, y1)
        return (x0, y0, x1, y1)

    def box(self, x, y, w, h, fill='none', stroke=INK, sw=1.2, r=6, dash=False, layer='bg'):
        u = self.u
        d = ' stroke-dasharray="4 3"' if dash else ''
        s = (f'<rect x="{x * u:.1f}" y="{y * u:.1f}" width="{w * u:.1f}" height="{h * u:.1f}" rx="{r}" '
             f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d}/>')
        getattr(self, layer).append(s)
        self._ext(x * u, y * u, (x + w) * u, (y + h) * u)

    def circle(self, cx, cy, r, fill='none', stroke=INK, sw=1.2, layer='mid'):
        u = self.u
        getattr(self, layer).append(f'<circle cx="{cx * u:.1f}" cy="{cy * u:.1f}" r="{r * u:.1f}" fill="{fill}" '
                                    f'stroke="{stroke}" stroke-width="{sw}"/>')
        self._ext((cx - r) * u, (cy - r) * u, (cx + r) * u, (cy + r) * u)

    def dot(self, x, y, col=ELEC, r=2.6):
        """électron célibataire (point)"""
        u = self.u
        self.fg.append(f'<circle cx="{x * u:.1f}" cy="{y * u:.1f}" r="{r}" fill="{col}"/>')
        self._ext(x * u - r, y * u - r, x * u + r, y * u + r)

    def raw(self, svg, bbox, layer='mid'):
        getattr(self, layer).append(svg)
        self._ext(*bbox)

    # ---------- textes ----------
    def t(self, x, y, text, col=INK, fs=None, anchor='middle', weight=None, italic=False, layer='fg'):
        fs = fs or self.fs
        u = self.u
        lines = text.split('\n')
        X = x * u
        Y0 = y * u
        lh = fs * 1.18
        out = []
        for i, ln in enumerate(lines):
            Y = Y0 + i * lh + fs * 0.35
            fw = f' font-weight="{weight}"' if weight else ''
            it = ' font-style="italic"' if italic else ''
            out.append(f'<text x="{X:.1f}" y="{Y:.1f}" text-anchor="{anchor}" font-size="{fs}" fill="{col}"{fw}{it}>'
                       f'{emit(rich_runs(ln), fs)}</text>')
            w = rich_w(ln, fs) * (1.06 if weight and int(weight) >= 600 else 1)
            if anchor == 'middle':
                xa, xb = X - w / 2, X + w / 2
            elif anchor == 'start':
                xa, xb = X, X + w
            else:
                xa, xb = X - w, X
            self._ext(xa, Y - fs * 0.85, xb, Y + fs * 0.3)
        getattr(self, layer).extend(out)

    # ---------- crochets, accolades, flèches ----------
    def br(self, xl, xr, yc, h=0.95, n='n', col=INK, w=1.4, nfs=None):
        u = self.u
        X1, X2, Y, H = xl * u, xr * u, yc * u, h * u
        t = 4.5
        self.mid.append(f'<path d="M{X1 + t:.1f},{Y - H:.1f} L{X1:.1f},{Y - H:.1f} L{X1:.1f},{Y + H:.1f} L{X1 + t:.1f},{Y + H:.1f}" '
                        f'fill="none" stroke="{col}" stroke-width="{w}"/>')
        self.mid.append(f'<path d="M{X2 - t:.1f},{Y - H:.1f} L{X2:.1f},{Y - H:.1f} L{X2:.1f},{Y + H:.1f} L{X2 - t:.1f},{Y + H:.1f}" '
                        f'fill="none" stroke="{col}" stroke-width="{w}"/>')
        self._ext(X1, Y - H, X2, Y + H)
        if n:
            nfs = nfs or self.fs * 0.95
            self.fg.append(f'<text x="{X2 + 2.5:.1f}" y="{Y + H + 2:.1f}" font-size="{nfs:.1f}" font-style="italic" '
                           f'font-weight="600" fill="{col}">{escape(n)}</text>')
            self._ext(X2, Y + H - nfs, X2 + 4 + nfs * 0.6, Y + H + 4)

    def brace(self, x0, x1, y, col=INK, label=None, fs=None, up=False, w=1.3, depth=0.22):
        u = self.u
        X0, X1, Y = x0 * u, x1 * u, y * u
        s = -1 if up else 1
        d = depth * u
        xm = (X0 + X1) / 2
        q = min(6, (X1 - X0) / 4)
        p = (f'M{X0:.1f},{Y:.1f} Q{X0:.1f},{Y + s * d / 2:.1f} {X0 + q:.1f},{Y + s * d / 2:.1f} '
             f'L{xm - q:.1f},{Y + s * d / 2:.1f} Q{xm:.1f},{Y + s * d / 2:.1f} {xm:.1f},{Y + s * d:.1f} '
             f'Q{xm:.1f},{Y + s * d / 2:.1f} {xm + q:.1f},{Y + s * d / 2:.1f} '
             f'L{X1 - q:.1f},{Y + s * d / 2:.1f} Q{X1:.1f},{Y + s * d / 2:.1f} {X1:.1f},{Y:.1f}')
        self.mid.append(f'<path d="{p}" fill="none" stroke="{col}" stroke-width="{w}"/>')
        self._ext(X0, min(Y, Y + s * d), X1, max(Y, Y + s * d))
        if label:
            fs = fs or self.fs * 0.85
            nl = label.count('\n')
            if up:
                ly = (Y - d - 4 - fs * 0.55 - fs * 1.18 * nl) / u
            else:
                ly = (Y + d + 4 + fs * 0.6) / u
            self.t((x0 + x1) / 2, ly, label, col=col, fs=fs)

    def arrow(self, x1, y1, x2, y2, col=INK, w=1.6, head=7, top=None, bottom=None, fs=None, dash=False, tcol=None):
        u = self.u
        X1, Y1, X2, Y2 = x1 * u, y1 * u, x2 * u, y2 * u
        L = math.hypot(X2 - X1, Y2 - Y1)
        ux, uy = (X2 - X1) / L, (Y2 - Y1) / L
        bx, by = X2 - ux * head, Y2 - uy * head
        self._line(X1, Y1, bx + ux * 1, by + uy * 1, col, w, dash, cap='butt')
        px, py = -uy * head * 0.5, ux * head * 0.5
        self.mid.append(f'<path d="M{X2:.1f},{Y2:.1f} L{bx + px:.1f},{by + py:.1f} L{bx - px:.1f},{by - py:.1f} Z" fill="{col}"/>')
        self._ext(X1, Y1, X2, Y2)
        fs = fs or self.fs * 0.78
        ym = (Y1 + Y2) / 2
        if top:
            self.t((x1 + x2) / 2, (ym - 4 - fs * 0.55 - fs * 1.18 * top.count('\n')) / u, top, col=tcol or col, fs=fs)
        if bottom:
            self.t((x1 + x2) / 2, (ym + 5 + fs * 0.6) / u, bottom, col=tcol or col, fs=fs)

    def eq(self, x1, x2, y, col=INK, w=1.5, top=None, bottom=None, fs=None):
        """double flèche d'équilibre ⇌"""
        u = self.u
        X1, X2, Y = x1 * u, x2 * u, y * u
        g = 3.2
        h = 6
        self.mid.append(f'<path d="M{X1:.1f},{Y - g:.1f} L{X2:.1f},{Y - g:.1f} L{X2 - h:.1f},{Y - g - h * 0.75:.1f}" fill="none" stroke="{col}" stroke-width="{w}" stroke-linejoin="round"/>')
        self.mid.append(f'<path d="M{X2:.1f},{Y + g:.1f} L{X1:.1f},{Y + g:.1f} L{X1 + h:.1f},{Y + g + h * 0.75:.1f}" fill="none" stroke="{col}" stroke-width="{w}" stroke-linejoin="round"/>')
        self._ext(X1, Y - g - h, X2, Y + g + h)
        fs = fs or self.fs * 0.78
        if top:
            self.t((x1 + x2) / 2, (Y - g - 6 - fs * 0.55) / u, top, col=col, fs=fs)
        if bottom:
            self.t((x1 + x2) / 2, (Y + g + 8 + fs * 0.6) / u, bottom, col=col, fs=fs)

    def scissors(self, x, y0, y1, col=WAT):
        self.line(x, y0, x, y1, col=col, w=1.4, dash=True)
        self.t(x, y0 - 0.38, '✂', col=col, fs=self.fs * 1.05)

    def ring(self, prefix, cx, cy, r=0.8, col=INK, aromatic=True, w=1.5):
        for i in range(6):
            ang = math.radians(60 * i)
            self.a(f'{prefix}{i}', cx + r * math.cos(ang), cy + r * math.sin(ang), '')
        for i in range(6):
            self.b(f'{prefix}{i}', f'{prefix}{(i + 1) % 6}', 1, col, w=w)
        if aromatic:
            self.circle(cx, cy, r * 0.58, stroke=col, sw=w)

    # ---------- sortie ----------
    def svg(self, pad=6, scale=1.0, cls='mol', title=''):
        x0, y0, x1, y1 = self.bb
        x0 -= pad
        y0 -= pad
        x1 += pad
        y1 += pad
        W, H = x1 - x0, y1 - y0
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.1f} {y0:.1f} {W:.1f} {H:.1f}" '
                f'width="{W * scale:.0f}" height="{H * scale:.0f}" class="{cls}" font-family="{FONT}" '
                f'role="img" aria-label="{escape(title)}">' + ''.join(self.bg + self.mid + self.fg) + '</svg>')


# ---------- briques réutilisables ----------

def _dx(m, subs, dx):
    need = max(lab_w(subs[0], m.fs) + lab_w(subs[2], m.fs), lab_w(subs[1], m.fs) + lab_w(subs[3], m.fs)) / 2 + 9
    return max(dx, need / m.u)


def alkene(m, p, x, y, subs=('H', 'H', 'H', 'H'), cols=None, dx=1.15, dy=1.0, col2=None, cc=INK):
    """C=C dessiné en développé ; subs = (haut-gauche, bas-gauche, haut-droite, bas-droite)"""
    cols = cols or [INK] * 4
    dx = _dx(m, subs, dx)
    m.a(p + 'c1', x, y, 'C', cc)
    m.a(p + 'c2', x + dx, y, 'C', cc)
    m.b(p + 'c1', p + 'c2', 2, cc, col2=col2)
    pos = [(x, y - dy), (x, y + dy), (x + dx, y - dy), (x + dx, y + dy)]
    owners = ['c1', 'c1', 'c2', 'c2']
    for i, (s, (sx, sy)) in enumerate(zip(subs, pos)):
        m.a(p + f's{i}', sx, sy, s, cols[i])
        m.b(p + owners[i], p + f's{i}')


def motif(m, p, x, y, subs=('H', 'H', 'H', 'H'), dx=1.15, dy=1.0, n='n', ext=0.95, bcol=INK, cols=None):
    """–[C–C]n– : x = position du 1er C"""
    cols = cols or [INK] * 4
    dx = _dx(m, subs, dx)
    bl = max(0.45, (max(lab_w(subs[0], m.fs), lab_w(subs[1], m.fs)) / 2 + 7) / m.u)
    brr = max(0.45, (max(lab_w(subs[2], m.fs), lab_w(subs[3], m.fs)) / 2 + 7) / m.u)
    ext = max(ext, bl + 0.45, brr + 0.45)
    m.a(p + 'e1', x - ext, y, '')
    m.a(p + 'c1', x, y, 'C')
    m.a(p + 'c2', x + dx, y, 'C')
    m.a(p + 'e2', x + dx + ext, y, '')
    m.b(p + 'e1', p + 'c1', 1, bcol)
    m.b(p + 'c1', p + 'c2')
    m.b(p + 'c2', p + 'e2', 1, bcol)
    pos = [(x, y - dy), (x, y + dy), (x + dx, y - dy), (x + dx, y + dy)]
    owners = ['c1', 'c1', 'c2', 'c2']
    for i, (s, (sx, sy)) in enumerate(zip(subs, pos)):
        m.a(p + f's{i}', sx, sy, s, cols[i])
        m.b(p + owners[i], p + f's{i}')
    if n is not None:
        m.br(x - bl, x + dx + brr, y, h=dy + 0.42, n=n)
