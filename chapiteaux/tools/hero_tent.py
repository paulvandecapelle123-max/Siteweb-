"""Génère l'illustration SVG du chapiteau 6 x 12 du hero (projection parallèle).
Usage : python3 tools/hero_tent.py > /tmp/tent.svg  (puis coller dans index.html)"""
import math

O = (206.0, 288.0)            # coin avant-proche au sol (écran)
U = (17.0, -7.0)              # +1 m sur la longueur (x)
Zp = (-28.0, -11.0)           # +1 m vers le fond sur le pignon (z')
UP = 34.0                     # px par mètre de hauteur
H, R = 2.2, 3.7

def P(x=0.0, zp=0.0, y=0.0):
    return (O[0] + x * U[0] + zp * Zp[0], O[1] + x * U[1] + zp * Zp[1] - y * UP)

def f(p): return f"{p[0]:.1f} {p[1]:.1f}"
def poly(pts, **a):
    d = "M" + " L".join(f(p) for p in pts) + " Z"
    return path(d, **a)
def path(d, **a):
    attrs = " ".join(f'{k.replace("_", "-")}="{v}"' for k, v in a.items())
    return f'<path d="{d}" {attrs}/>'
def line(a, b, **k): return path(f"M{f(a)} L{f(b)}", **k)

out = []
S = dict(stroke="#8E9BB5", stroke_width="1.2", stroke_linejoin="round")

# ombre
out.append(poly([P(-0.6, -0.4, 0), P(12.8, -0.4, 0), P(12.8, 6.8, 0), P(-0.6, 6.8, 0)], fill="#3E6E36", opacity=".22", filter="url(#soft)"))
# pan arrière (dépasse du faîte)
out.append(poly([P(0, 3, R), P(12, 3, R), P(12, 6, H), P(0, 6, H)], fill="#C9D3E4"))
# intérieur : mur du fond (long côté éloigné), pignon arrière, sol
out.append(poly([P(0, 6, 0), P(12, 6, 0), P(12, 6, H), P(0, 6, H)], fill="#E7ECF5"))
out.append(poly([P(12, 0, 0), P(12, 6, 0), P(12, 6, H), P(12, 3, R), P(12, 0, H)], fill="#DDE4F0"))
out.append(poly([P(0, 0, 0), P(12, 0, 0), P(12, 6, 0), P(0, 6, 0)], fill="#6E9F5C"))

# invités + table (dans l'entrée)
ins = []
def person(x, zp, h, col):
    base = P(x, zp, 0); top = P(x, zp, h)
    w = 5.5
    ins.append(f'<rect x="{base[0]-w:.1f}" y="{top[1]+ 2*w:.1f}" width="{2*w:.1f}" height="{base[1]-top[1]-2*w:.1f}" rx="{w:.1f}" fill="{col}"/>')
    ins.append(f'<circle cx="{top[0]:.1f}" cy="{top[1]+w:.1f}" r="{w:.1f}" fill="{col}"/>')
tbl = [P(1.2, 2.4, .75), P(3.2, 2.4, .75), P(3.2, 3.3, .75), P(1.2, 3.3, .75)]
ins.append(poly(tbl, fill="#B98A55"))
for q in (P(1.3, 2.5, 0), P(1.3, 3.2, 0)):
    ins.append(line(q, (q[0], q[1] - .72 * UP), stroke="#6B5236", stroke_width="2"))
person(0.9, 4.9, 1.6, "#FFC857")
person(1.6, 3.9, 1.7, "#0F1E3A")
person(0.7, 1.6, 1.55, "#2B59C3")
out.append('<g class="inside">' + "".join(ins) + "</g>")

# guirlande sous l'avant-toit du pignon
pts = [P(0, zp, H - 0.12 - 0.55 * math.sin(math.pi * zp / 6)) for zp in [i * 6 / 30 for i in range(31)]]
out.append(path("M" + " L".join(f(p) for p in pts), fill="none", stroke="#0F1E3A", stroke_width="1"))
out.append('<g class="bulbs">' + "".join(f'<circle cx="{pts[i][0]:.1f}" cy="{pts[i][1]+2:.1f}" r="2.8"/>' for i in range(3, 30, 4)) + "</g>")

# long côté proche : mur + fenêtres en arcade
out.append(poly([P(0, 0, 0), P(12, 0, 0), P(12, 0, H), P(0, 0, H)], fill="url(#wallN)", **S))
glass, mull = [], []
for i in range(6):
    x0, x1 = 2 * i + .38, 2 * i + 1.62; r = (x1 - x0) / 2; cx = (x0 + x1) / 2; yb, ys = .55, 1.3
    arc = [P(cx - r * math.cos(t), 0, ys + r * math.sin(t)) for t in [k * math.pi / 16 for k in range(17)]]
    glass.append(poly([P(x0, 0, yb)] + arc + [P(x1, 0, yb)], fill="url(#glass)", stroke="#8E9BB5", stroke_width="1"))
    for k in (1, 2, 3):
        xx = x0 + (x1 - x0) * k / 4; top = ys + math.sqrt(max(0, r * r - (xx - cx) ** 2))
        mull.append(line(P(xx, 0, yb), P(xx, 0, top)))
    for yy in (.8, 1.05, 1.3, 1.55):
        half = r if yy <= ys else math.sqrt(max(0, r * r - (yy - ys) ** 2))
        mull.append(line(P(cx - half, 0, yy), P(cx + half, 0, yy)))
out += glass
out.append('<g stroke="#FFFFFF" stroke-width="1.6">' + "".join(mull) + "</g>")
for x in range(0, 13, 2):
    out.append(line(P(x, 0, 0), P(x, 0, H), stroke="#7C8BA8", stroke_width="2.6", stroke_linecap="round"))

def scallops(a, b, n, sag):
    pts = []
    for i in range(n):
        for k in range(9):
            t = (i + k / 8) / n
            p = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + sag * math.sin(math.pi * k / 8))
            pts.append(p)
    top_a, top_b = (a[0], a[1] - 3), (b[0], b[1] - 3)
    return poly([top_a] + pts + [top_b], fill="#F4F6FA", stroke="#8E9BB5", stroke_width="1")
out.append(scallops(P(0, 0, H), P(12, 0, H), 24, 4.5))

# pignon avant : triangle + logo
tri = [P(0, 0, H), P(0, 6, H), P(0, 3, R)]
out.append(poly(tri, fill="#F1F4F9", **S))

# rideaux plissés (bandes qui coulissent vers les poteaux)
cur = []
n = 7
for side, (za, zb, anchor) in enumerate([(0.04, 2.96, 0.04), (3.04, 5.96, 5.96)]):
    w = (zb - za) / n
    for k in range(n):
        z0 = za + k * w; z1 = z0 + w
        pl = [P(0, z0, .02), P(0, z1, .02), P(0, z1, H - .02), P(0, z0, H - .02)]
        # position « ouvert » : la bande se range contre le poteau
        target = anchor + (k * 0.06 if side == 0 else -(n - 1 - k) * 0.06) - (0 if side == 0 else w)
        dz = target - z0
        dx, dy = dz * Zp[0], dz * Zp[1]
        shade = "#FFFFFF" if k % 2 == 0 else "#EEF2F8"
        cur.append(f'<path class="pleat" style="--ox:{dx:.1f}px;--oy:{dy:.1f}px" d="M{" L".join(f(p) for p in pl)} Z" fill="{shade}" stroke="#C3CCDC" stroke-width=".8"/>')
out.append('<g class="curtains">' + "".join(cur) + "</g>")
out.append(scallops(P(0, 0, H), P(0, 6, H), 12, 4.5))
for zp in (0, 3, 6):
    out.append(line(P(0, zp, 0), P(0, zp, H), stroke="#7C8BA8", stroke_width="2.6", stroke_linecap="round"))
out.append(line(P(0, 3, H), P(0, 3, R), stroke="#7C8BA8", stroke_width="1.6"))

# pan de toit avant + coutures + faîtage
out.append(poly([P(-0.08, -0.1, H - .04), P(12.08, -0.1, H - .04), P(12.08, 3, R), P(-0.08, 3, R)], fill="url(#roofN)", **S))
for x in range(2, 12, 2):
    out.append(line(P(x, 0, H), P(x, 3, R), stroke="#DCE3EF", stroke_width="1"))
out.append(line(P(-0.08, 3, R), P(12.08, 3, R), stroke="#7C8BA8", stroke_width="2.6", stroke_linecap="round"))

# haubans
out.append(line(P(12, 0, H), P(13.2, -1.4, 0), stroke="#8E9BB5", stroke_width="1"))
out.append(line(P(0, 0, H), P(-1.2, -1.4, 0), stroke="#8E9BB5", stroke_width="1"))

# logo sur le pignon (coordonnées du logo d'origine)
c = P(0, 3, H + 0.55)
LOGO = "M107.3 82.7 L241.7 58.3 C252 100 285 130 325 133.3 L325 185 L223.3 256.7 L223.3 186.7 L215 186.5 C162 185 118 142 107.3 82.7 Z"
out.append(f'<path transform="translate({c[0]:.1f} {c[1]:.1f}) matrix(0.14 0.055 0 0.17 0 0) translate(-216 -157)" d="{LOGO}" fill="#2B59C3"/>')

# mât + drapeau
top = P(0, 3, R); mast = (top[0], top[1] - 52)
out.append(line(top, mast, stroke="#7C8BA8", stroke_width="2.5", stroke_linecap="round"))
fx, fy = mast[0] + 1, mast[1] + 2
out.append(f'<g class="flag"><path d="M{fx:.1f} {fy:.1f} C {fx+27:.1f} {fy-6:.1f} {fx+55:.1f} {fy+8:.1f} {fx+92:.1f} {fy:.1f} V {fy+25:.1f} C {fx+55:.1f} {fy+33:.1f} {fx+27:.1f} {fy+19:.1f} {fx:.1f} {fy+25:.1f} Z" fill="#2B59C3"/>'
           f'<text x="{fx+46:.1f}" y="{fy+16.5:.1f}" text-anchor="middle" font-family="Bricolage Grotesque, DM Sans, sans-serif" font-weight="700" font-size="11.5" fill="#fff" data-site="name">Chapiteau\'bel</text></g>')

defs = '''<defs>
  <linearGradient id="roofN" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#E4EAF5"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient>
  <linearGradient id="wallN" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#EDF1F8"/></linearGradient>
  <linearGradient id="glass" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#9DBDF0"/><stop offset="1" stop-color="#DCE8FC"/></linearGradient>
  <filter id="soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="5"/></filter>
</defs>'''
print(f'<svg viewBox="0 40 420 272" class="tent-svg" id="heroTent" role="img" aria-label="Chapiteau illustré : touchez-le pour ouvrir ou fermer l\'entrée">{defs}' + "".join(out) + "</svg>")
