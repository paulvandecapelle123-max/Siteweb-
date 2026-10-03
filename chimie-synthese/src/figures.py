"""Toutes les figures SVG de la synthèse."""
from chem import Mol, alkene, motif, INK, ACID, ALC, WAT, NEW, AMI, GREY, ELEC, rich_w

FG = '#0e7490'     # couleur « groupe fonctionnel » / chapitre 8
CH9 = '#b4471b'    # chapitre 9
LIGHT8 = '#e6f4f7'
LIGHT9 = '#fbeee7'

F = {}


# =====================================================================
#  CHAPITRE 8 — fonctions organiques
# =====================================================================

def group(kind):
    m = Mol(u=27, fs=14)
    c = FG
    if kind == 'alcool':
        m.a('r', 0, 0, 'R'); m.a('o', 1.3, 0, 'OH', c); m.b('r', 'o')
    elif kind == 'aldehyde':
        m.a('r', 0, 0, 'R'); m.a('c', 1.1, 0, 'C', c); m.a('o', 1.1, -1, 'O', c); m.a('h', 2.1, 0, 'H', c)
        m.b('r', 'c'); m.b('c', 'o', 2, c); m.b('c', 'h', 1, c)
    elif kind == 'cetone':
        m.a('r', 0, 0, 'R'); m.a('c', 1.1, 0, 'C', c); m.a('o', 1.1, -1, 'O', c); m.a('r2', 2.2, 0, "R'")
        m.b('r', 'c'); m.b('c', 'o', 2, c); m.b('c', 'r2')
    elif kind == 'acide':
        m.a('r', 0, 0, 'R'); m.a('c', 1.1, 0, 'C', c); m.a('o', 1.1, -1, 'O', c); m.a('oh', 2.35, 0, 'OH', c)
        m.b('r', 'c'); m.b('c', 'o', 2, c); m.b('c', 'oh', 1, c)
    elif kind == 'ester':
        m.a('r', 0, 0, 'R'); m.a('c', 1.1, 0, 'C', c); m.a('o', 1.1, -1, 'O', c); m.a('o2', 2.15, 0, 'O', c)
        m.a('r2', 3.2, 0, "R'"); m.b('r', 'c'); m.b('c', 'o', 2, c); m.b('c', 'o2', 1, c); m.b('o2', 'r2')
    elif kind == 'amine':
        m.a('r', 0, 0, 'R'); m.a('n', 1.4, 0, 'NH2', c); m.b('r', 'n')
    elif kind == 'amide':
        m.a('r', 0, 0, 'R'); m.a('c', 1.1, 0, 'C', c); m.a('o', 1.1, -1, 'O', c); m.a('n', 2.15, 0, 'N', c)
        m.a('h', 2.15, 1, 'H', c); m.a('r2', 3.2, 0, "R'")
        m.b('r', 'c'); m.b('c', 'o', 2, c); m.b('c', 'n', 1, c); m.b('n', 'h', 1, c); m.b('n', 'r2')
    elif kind == 'ether':
        m.a('r', 0, 0, 'R'); m.a('o', 1.1, 0, 'O', c); m.a('r2', 2.2, 0, "R'"); m.b('r', 'o'); m.b('o', 'r2')
    return m.svg(pad=3, title=kind)


for k in ['alcool', 'aldehyde', 'cetone', 'acide', 'ester', 'amine', 'amide', 'ether']:
    F['g_' + k] = group(k)


def ethanol_dev():
    m = Mol(u=28, fs=14)
    m.a('h0', 0, 0, 'H'); m.a('c1', 1, 0, 'C'); m.a('c2', 2, 0, 'C'); m.a('o', 3, 0, 'O', FG); m.a('h', 4, 0, 'H', FG)
    for i, c in ((1, 'c1'), (2, 'c2')):
        m.a(c + 'u', i, -1, 'H'); m.a(c + 'd', i, 1, 'H'); m.b(c, c + 'u'); m.b(c, c + 'd')
    m.b('h0', 'c1'); m.b('c1', 'c2'); m.b('c2', 'o', 1); m.b('o', 'h', 1, FG)
    return m.svg(pad=3, title='éthanol développé')


def ethanol_topo():
    m = Mol(u=28, fs=14)
    m.a('a', 0, 0.5, ''); m.a('b', 0.87, 0, ''); m.a('o', 1.8, 0.5, 'OH', FG)
    m.b('a', 'b'); m.b('b', 'o')
    return m.svg(pad=4, title='éthanol topologique')


def acetic_dev():
    m = Mol(u=28, fs=14)
    m.a('h0', 0, 0, 'H'); m.a('c1', 1, 0, 'C'); m.a('hu', 1, -1, 'H'); m.a('hd', 1, 1, 'H')
    m.a('c2', 2, 0, 'C', FG); m.a('o1', 2, -1, 'O', FG); m.a('o2', 3, 0, 'O', FG); m.a('h', 4, 0, 'H', FG)
    m.b('h0', 'c1'); m.b('c1', 'hu'); m.b('c1', 'hd'); m.b('c1', 'c2'); m.b('c2', 'o1', 2, FG); m.b('c2', 'o2', 1, FG)
    m.b('o2', 'h', 1, FG)
    return m.svg(pad=3, title='acide éthanoïque développé')


def acetic_topo():
    m = Mol(u=28, fs=14)
    m.a('a', 0, 0.5, ''); m.a('b', 0.87, 0, ''); m.a('o1', 0.87, -1, 'O', FG); m.a('o', 1.8, 0.5, 'OH', FG)
    m.b('a', 'b'); m.b('b', 'o1', 2, FG); m.b('b', 'o', 1, FG)
    return m.svg(pad=4, title='acide éthanoïque topologique')


F['ethanol_dev'] = ethanol_dev()
F['ethanol_topo'] = ethanol_topo()
F['acetic_dev'] = acetic_dev()
F['acetic_topo'] = acetic_topo()


def acide_gen():
    m = Mol(u=30, fs=15)
    m.a('r', 0, 0, 'R'); m.a('c', 1.1, 0, 'C', FG); m.a('o', 1.1, -1, 'O', FG); m.a('oh', 2.4, 0, 'OH', FG)
    m.b('r', 'c'); m.b('c', 'o', 2, FG); m.b('c', 'oh', 1, FG)
    m.t(1.1, 1.0, 'C n°1', col=FG, fs=11)
    return m.svg(pad=4)


F['acide_gen'] = acide_gen()


def ester_nom():
    m = Mol(u=30, fs=15)
    m.a('a', 0, 0, 'CH3', ACID); m.a('c', 1.45, 0, 'C', ACID); m.a('o1', 1.45, -1.05, 'O', ACID)
    m.a('o2', 2.6, 0, 'O', ACID); m.a('c3', 4.05, 0, 'CH2', ALC); m.a('c4', 5.65, 0, 'CH3', ALC)
    m.b('a', 'c', 1, ACID); m.b('c', 'o1', 2, ACID); m.b('c', 'o2', 1, ACID); m.b('o2', 'c3', 1, INK); m.b('c3', 'c4', 1, ALC)
    m.brace(-0.45, 2.85, 0.55, col=ACID, label='**éthanoate**\ncôté C=O : 2 C', fs=12)
    m.brace(3.5, 6.2, 0.55, col=ALC, label="**d'éthyle**\ngroupe ⟦R2⟧ : 2 C", fs=12)
    return m.svg(pad=4, title="éthanoate d'éthyle")


F['ester_nom'] = ester_nom()


def esterif_gen():
    m = Mol(u=30, fs=15)
    # acide
    m.a('r1', 0, 0, 'R1', ACID); m.a('c', 1.15, 0, 'C', ACID); m.a('o', 1.15, -1.05, 'O', ACID)
    m.a('oa', 2.25, 0, 'O', WAT); m.a('ha', 3.15, 0, 'H', WAT)
    m.b('r1', 'c', 1, ACID); m.b('c', 'o', 2, ACID); m.b('c', 'oa', 1, WAT, dash=True); m.b('oa', 'ha', 1, WAT)
    m.t(3.85, 0, '+', fs=20)
    # alcool
    m.a('hb', 4.55, 0, 'H', WAT); m.a('ob', 5.45, 0, 'O', ALC); m.a('r2', 6.45, 0, 'R2', ALC)
    m.b('hb', 'ob', 1, WAT, dash=True); m.b('ob', 'r2', 1, ALC)
    b1 = m.hl(['oa', 'ha'], WAT, pad=3)
    b2 = m.hl(['hb'], WAT, pad=3)
    # liaison « forment l'eau »
    u = m.u
    yb = 0.95 * u
    m._line((b1[0] + b1[2]) / 2, b1[3], (b1[0] + b1[2]) / 2, yb, WAT, 1.2)
    m._line((b2[0] + b2[2]) / 2, b2[3], (b2[0] + b2[2]) / 2, yb, WAT, 1.2)
    m._line((b1[0] + b1[2]) / 2, yb, (b2[0] + b2[2]) / 2, yb, WAT, 1.2)
    m.t(((b1[0] + b1[2]) / 2 + (b2[0] + b2[2]) / 2) / 2 / u, 1.38, 'forment ⟦H2O⟧', col=WAT, fs=12)
    m.t(0.6, 1.95, 'acide carboxylique', col=ACID, fs=12)
    m.t(5.7, 1.95, 'alcool', col=ALC, fs=12)
    # flèche d'équilibre
    m.eq(7.2, 9.3, 0, top='H⁺ (cat.), chauffage', fs=11.5)
    # ester
    m.a('pr1', 10.0, 0, 'R1', ACID); m.a('pc', 11.15, 0, 'C', ACID); m.a('po', 11.15, -1.05, 'O', ACID)
    m.a('po2', 12.3, 0, 'O', ALC); m.a('pr2', 13.3, 0, 'R2', ALC)
    m.b('pr1', 'pc', 1, ACID); m.b('pc', 'po', 2, ACID); m.b('pc', 'po2', 1, NEW, w=2.6); m.b('po2', 'pr2', 1, ALC)
    m.t(11.7, 1.95, 'ester', col=INK, fs=12)
    m.t(11.75, 0.62, 'nouvelle liaison', col=NEW, fs=10)
    m.t(14.1, 0, '+', fs=20)
    m.a('w', 15.05, 0, 'H2O', WAT, weight=600)
    m.t(15.05, 1.95, 'eau', col=WAT, fs=12)
    return m.svg(pad=5, title='réaction d’estérification')


F['esterif_gen'] = esterif_gen()


def amide_gen():
    m = Mol(u=30, fs=15)
    m.a('r1', 0, 0, 'R1', ACID); m.a('c', 1.15, 0, 'C', ACID); m.a('o', 1.15, -1.05, 'O', ACID)
    m.a('oa', 2.25, 0, 'O', WAT); m.a('ha', 3.15, 0, 'H', WAT)
    m.b('r1', 'c', 1, ACID); m.b('c', 'o', 2, ACID); m.b('c', 'oa', 1, WAT, dash=True); m.b('oa', 'ha', 1, WAT)
    m.hl(['oa', 'ha'], WAT, pad=3)
    m.t(3.85, 0, '+', fs=20)
    m.a('hb', 4.55, 0, 'H', WAT); m.a('n', 5.45, 0, 'N', AMI); m.a('hn', 5.45, 1.0, 'H', AMI); m.a('r2', 6.45, 0, 'R2', AMI)
    m.b('hb', 'n', 1, WAT, dash=True); m.b('n', 'hn', 1, AMI); m.b('n', 'r2', 1, AMI)
    m.hl(['hb'], WAT, pad=3)
    m.t(0.6, 1.5, 'acide carboxylique', col=ACID, fs=12)
    m.t(5.6, 1.85, 'amine', col=AMI, fs=12)
    m.arrow(7.2, 0, 9.2, 0, top='chauffage', fs=11.5)
    m.a('pr1', 9.9, 0, 'R1', ACID); m.a('pc', 11.05, 0, 'C', ACID); m.a('po', 11.05, -1.05, 'O', ACID)
    m.a('pn', 12.2, 0, 'N', AMI); m.a('phn', 12.2, 1.0, 'H', AMI); m.a('pr2', 13.2, 0, 'R2', AMI)
    m.b('pr1', 'pc', 1, ACID); m.b('pc', 'po', 2, ACID); m.b('pc', 'pn', 1, NEW, w=2.6); m.b('pn', 'phn', 1, AMI)
    m.b('pn', 'pr2', 1, AMI)
    m.hl(['pc', 'po', 'pn', 'phn'], NEW, pad=4)
    m.t(11.6, 2.0, 'amide (liaison –CO–NH–)', col=NEW, fs=12)
    m.t(14.0, 0, '+', fs=20)
    m.a('w', 14.95, 0, 'H2O', WAT, weight=600)
    return m.svg(pad=5, title='formation d’un amide')


F['amide_gen'] = amide_gen()


def reflux():
    """montage à reflux simplifié"""
    m = Mol(u=1, fs=12)
    s = []
    # chauffe-ballon
    s.append('<path d="M40,190 L130,190 L124,232 L46,232 Z" fill="#f1d9cf" stroke="#1f2430" stroke-width="1.3"/>')
    # ballon
    s.append('<circle cx="85" cy="175" r="30" fill="#fff" stroke="#1f2430" stroke-width="1.4"/>')
    s.append('<path d="M58,186 A30,30 0 0 0 112,186 Z" fill="#cfe8f3" stroke="none"/>')
    s.append('<rect x="78" y="128" width="14" height="20" fill="#fff" stroke="#1f2430" stroke-width="1.4"/>')
    # réfrigérant
    s.append('<rect x="72" y="20" width="26" height="108" rx="4" fill="#e3f1fb" stroke="#1f2430" stroke-width="1.4"/>')
    s.append('<rect x="80" y="8" width="10" height="126" fill="#fff" stroke="#1f2430" stroke-width="1.2"/>')
    # tubulures d'eau
    s.append('<path d="M98,112 L118,112" stroke="#1764ab" stroke-width="3"/><path d="M98,34 L118,34" stroke="#1764ab" stroke-width="3"/>')
    # gouttes / vapeurs
    s.append('<path d="M85,150 L85,60" stroke="#c45f00" stroke-width="1.4" stroke-dasharray="3 3"/>')
    s.append('<path d="M85,60 l-4,7 h8 z" fill="#c45f00"/>')
    s.append('<circle cx="83" cy="90" r="2.2" fill="#1764ab"/><circle cx="87" cy="110" r="2.2" fill="#1764ab"/>')
    m.raw(''.join(s), (36, 4, 132, 234))
    m.t(142, 112, '← entrée d’eau froide', anchor='start', fs=11)
    m.t(142, 34, '→ sortie d’eau', anchor='start', fs=11)
    m.t(142, 70, 'réfrigérant : les vapeurs', anchor='start', fs=11)
    m.t(142, 84, 'se condensent et retombent', anchor='start', fs=11)
    m.t(142, 170, 'ballon : acide + alcool', anchor='start', fs=11)
    m.t(142, 184, '+ quelques gouttes de ⟦H2SO4⟧', anchor='start', fs=11)
    m.t(142, 220, 'chauffe-ballon (accélère)', anchor='start', fs=11)
    return m.svg(pad=4, title='montage à reflux')


F['reflux'] = reflux()


# =====================================================================
#  Carte mentale (page 1)
# =====================================================================

def carte():
    m = Mol(u=1, fs=13)

    def pill(x, y, w, h, title, sub=None, col=FG, fill='#fff'):
        m.box(x, y, w, h, fill=fill, stroke=col, sw=1.4, r=8)
        if sub:
            m.t(x + w / 2, y + h / 2 - 8, title, col=col, fs=12.5, weight=700)
            m.t(x + w / 2, y + h / 2 + 8, sub, col=INK, fs=13)
        else:
            m.t(x + w / 2, y + h / 2, title, col=col, fs=13, weight=700)

    # bandeau chapitre 8
    m.box(0, 0, 700, 152, fill=LIGHT8, stroke=FG, sw=1.2, r=10)
    m.t(14, 16, 'CHAPITRE PRÉCÉDENT — UAA 8 : les fonctions organiques', col=FG, fs=12.5, weight=700, anchor='start')
    y = 32
    for (t2, s2, col2, prod_t, prod_s, lab) in [
        ('Alcool', '⟦HO–R2⟧', ALC, 'ESTER + eau', '⟦R1–COO–R2⟧ + ⟦H2O⟧', 'estérification'),
        ('Amine', '⟦H2N–R2⟧', AMI, 'AMIDE + eau', '⟦R1–CO–NH–R2⟧ + ⟦H2O⟧', 'condensation'),
    ]:
        pill(12, y, 170, 46, 'Acide carboxylique', '⟦R1–COOH⟧', ACID)
        m.t(197, y + 23, '+', fs=20)
        pill(212, y, 130, 46, t2, s2, col2)
        m.arrow(352, y + 23, 452, y + 23, top=lab, fs=11.5)
        pill(462, y, 226, 46, prod_t, prod_s, NEW)
        y += 58
    # grosse flèche
    m.raw('<path d="M320,156 L380,156 L380,182 L398,182 L350,214 L302,182 L320,182 Z" fill="#7a2db8" opacity="0.9"/>',
          (300, 156, 400, 214))
    m.t(412, 172, 'Et si chaque molécule a **2 fonctions** ?', anchor='start', fs=12.5, col=NEW)
    m.t(412, 189, '→ ça se répète des milliers de fois → **polymère** !', anchor='start', fs=12.5, col=NEW)
    m.t(14, 172, 'C’est la même réaction', anchor='start', fs=12, col=INK, italic=True)
    m.t(14, 188, 'mais répétée n fois.', anchor='start', fs=12, col=INK, italic=True)
    # bandeau chapitre 9
    m.box(0, 220, 700, 228, fill=LIGHT9, stroke=CH9, sw=1.2, r=10)
    m.t(14, 236, 'CE CHAPITRE — UAA 9 : les macromolécules (TEST)', col=CH9, fs=12.5, weight=700, anchor='start')
    # polycondensation
    m.box(12, 252, 404, 184, fill='#fff', stroke=CH9, sw=1.4, r=8)
    m.t(214, 268, 'POLYCONDENSATION', col=CH9, fs=14, weight=700)
    lines = [
        '• diacide + dialcool → **polyester** (PET) + ⟦2n H2O⟧',
        '• diacide + diamine → **polyamide** (nylon 6,6, Kevlar)',
        '• acides aminés → **protéines** (liaison peptidique)',
        '• glucose → **amidon, cellulose**  •  nucléotides → **ADN**',
        '• monomères **bifonctionnels** (2 fonctions chacun)',
        '• une **petite molécule est éliminée** (⟦H2O⟧ ou HCl)',
    ]
    for i, ln in enumerate(lines):
        m.t(24, 292 + i * 23, ln, anchor='start', fs=12.5)
    # polyaddition
    m.box(428, 252, 260, 184, fill='#fff', stroke=CH9, sw=1.4, r=8)
    m.t(558, 268, 'POLYADDITION', col=CH9, fs=14, weight=700)
    lines = [
        '• monomère = **alcène** (C=C)',
        '• **un seul** type de monomère',
        '• la double liaison **s’ouvre**',
        '• **rien n’est éliminé**',
        '• PE, PP, PVC, PS, PTFE…',
    ]
    for i, ln in enumerate(lines):
        m.t(440, 292 + i * 23, ln, anchor='start', fs=12.5)
    m.t(558, 424, 'nouveau : les alcènes (début UAA 9)', fs=11, col=GREY, italic=True)
    return m.svg(pad=2, title='carte mentale')


F['carte'] = carte()


# =====================================================================
#  CHAPITRE 9 — notions de base
# =====================================================================

def beads():
    m = Mol(u=1, fs=12)
    MON = '#f7c9a9'
    MON2 = '#b9d3f0'

    def pill(x, y, label, fill=MON, w=58, h=24):
        m.box(x, y, w, h, fill=fill, stroke='#7a5a44' if fill == MON else '#3d5f8a', sw=1.1, r=11, layer='mid')
        m.t(x + w / 2, y + h / 2, label, fs=11.5)

    # monomère isolé
    pill(0, 10, 'monomère')
    m.arrow(66, 22, 168, 22, top='polymérisation', bottom='(n fois)', fs=11.5)
    # chaîne
    x = 186
    m.t(x - 8, 22, '…', fs=16)
    xs = []
    for i in range(7):
        xi = x + i * 70
        xs.append(xi)
        if i:
            m._line(xi - 12, 22, xi, 22, INK, 2)
        pill(xi, 10, 'monomère')
    m.t(xs[-1] + 72, 22, '…', fs=16)
    # motif entouré
    m.box((xs[3] - 5), 3, 68, 38, fill='none', stroke=CH9, sw=1.6, r=4, dash=True, layer='fg')
    m.t(xs[3] + 29, -10, 'motif = unité constitutive (répété n fois)', col=CH9, fs=11.5, weight=600)
    m.t(xs[3] + 29, 56, 'polymère (macromolécule)', fs=12, weight=600)
    # homopolymère / copolymère
    y = 82
    m.t(0, y + 12, 'Homopolymère :', anchor='start', fs=12, weight=700)
    for i in range(6):
        xi = 110 + i * 64
        if i:
            m._line(xi - 10, y + 12, xi, y + 12, INK, 2)
        pill(xi, y, 'M1', w=54)
    m.t(500, y + 12, '1 seul type de monomère', anchor='start', fs=11.5, col=GREY)
    y = 118
    m.t(0, y + 12, 'Copolymère :', anchor='start', fs=12, weight=700)
    for i in range(6):
        xi = 110 + i * 64
        if i:
            m._line(xi - 10, y + 12, xi, y + 12, INK, 2)
        pill(xi, y, 'M1' if i % 2 == 0 else 'M2', fill=MON if i % 2 == 0 else MON2, w=54)
    m.t(500, y + 12, '2 types de monomères', anchor='start', fs=11.5, col=GREY)
    return m.svg(pad=3, title='monomères et polymère')


F['beads'] = beads()


def alc_dev(subs, title):
    m = Mol(u=28, fs=14)
    alkene(m, 'a', 0, 0, subs)
    return m.svg(pad=3, title=title)


F['ethene_dev'] = alc_dev(('H', 'H', 'H', 'H'), 'éthène')
F['propene_dev'] = alc_dev(('H', 'H', 'H', 'CH3'), 'propène')


# =====================================================================
#  POLYADDITION
# =====================================================================

def polyadd_steps():
    m = Mol(u=30, fs=14)
    X = [0.6, 3.6, 6.6]
    dx = 1.15
    rows = [0, 3.0, 6.0]
    labels = ['Départ', 'Étape 1', 'Étape 2']
    for r, lab in zip(rows, labels):
        m.t(-0.9, r, lab, anchor='end', fs=13, weight=700, col=CH9)
    # départ
    for i, x in enumerate(X):
        alkene(m, f'm{i}', x, 0, dx=dx, col2=WAT)
    m.t(-0.05, 0, '…', fs=15); m.t(X[-1] + dx + 0.6, 0, '…', fs=15)
    # étape 1
    for i, x in enumerate(X):
        p = f's{i}'
        m.a(p + 'c1', x, 3, 'C'); m.a(p + 'c2', x + dx, 3, 'C'); m.b(p + 'c1', p + 'c2')
        for j, (sx, sy, o) in enumerate([(x, 2, 'c1'), (x, 4, 'c1'), (x + dx, 2, 'c2'), (x + dx, 4, 'c2')]):
            m.a(p + f'h{j}', sx, sy, 'H'); m.b(p + o, p + f'h{j}')
        m.dot(x - 0.36, 3)
        m.dot(x + dx + 0.36, 3)
    m.t(-0.05, 3, '…', fs=15); m.t(X[-1] + dx + 0.6, 3, '…', fs=15)
    # étape 2 : chaîne
    prev = None
    m.a('e0', -0.1, 6, '')
    prev = 'e0'
    for i, x in enumerate(X):
        for k, xx in enumerate((x, x + dx)):
            nm = f'k{i}{k}'
            m.a(nm, xx, 6, 'C')
            m.a(nm + 'u', xx, 5, 'H'); m.a(nm + 'd', xx, 7, 'H')
            m.b(nm, nm + 'u'); m.b(nm, nm + 'd')
            if prev:
                newb = (k == 0)
                m.b(prev, nm, 1, NEW if newb else INK, w=2.6 if newb else 1.5)
            prev = nm
    m.a('e1', X[-1] + dx + 0.7, 6, '')
    m.b(prev, 'e1', 1, NEW, w=2.6)
    m.t(-0.45, 6, '…', fs=15); m.t(X[-1] + dx + 1.0, 6, '…', fs=15)
    # notes
    nx = 9.6
    m.t(nx, -0.35, 'Des molécules d’**éthène** (alcène) :', anchor='start', fs=12)
    m.t(nx, 0.3, 'la liaison en **rouge** va se casser.', anchor='start', fs=12, col=WAT)
    m.t(nx, 2.55, 'Une des 2 liaisons C–C se **casse**.', anchor='start', fs=12)
    m.t(nx, 3.2, 'Chaque C garde un **électron célibataire** (•).', anchor='start', fs=12, col='#077d7d')
    m.t(nx, 5.6, 'Deux électrons de **2 molécules**', anchor='start', fs=12)
    m.t(nx, 6.25, 'différentes s’unissent : **nouvelle liaison**', anchor='start', fs=12, col=NEW)
    m.t(nx, 6.9, 'covalente → **polyéthylène**.', anchor='start', fs=12, col=NEW)
    return m.svg(pad=5, title='étapes de la polyaddition')


F['polyadd_steps'] = polyadd_steps()


def polyadd_eq():
    m = Mol(u=30, fs=15)
    m.t(-0.65, 0, 'n', fs=17, weight=700, italic=True, col=CH9)
    alkene(m, 'a', 0, 0)
    m.t(0.58, 1.75, 'éthène (éthylène)', fs=12)
    m.t(0.58, 2.3, '= monomère', fs=12, col=GREY)
    m.arrow(2.1, 0, 4.1, 0, top='polyaddition', fs=11.5)
    motif(m, 'p', 5.45, 0)
    m.t(6.03, -1.95, 'motif', fs=12, col=CH9, weight=600)
    m.t(6.03, 1.75, 'polyéthylène (PE)', fs=12)
    m.t(6.03, 2.3, '= polymère', fs=12, col=GREY)
    m.t(9.0, -0.5, 'condensé :', anchor='start', fs=12, col=GREY)
    m.t(9.0, 0.25, '⟦–[CH2–CH2]n–⟧', anchor='start', fs=15)
    m.t(9.0, 1.15, 'n = degré de', anchor='start', fs=12, col=GREY)
    m.t(9.0, 1.7, 'polymérisation', anchor='start', fs=12, col=GREY)
    return m.svg(pad=4, title='équation de la polyaddition de l’éthène')


F['polyadd_eq'] = polyadd_eq()


def pvc_method():
    m = Mol(u=30, fs=14)
    alkene(m, 'a', 0, 0, ('H', 'H', 'Cl', 'H'), cols=[INK, INK, '#1f8a47', INK])
    m.t(0.58, 1.75, '1. le monomère', fs=11.5, weight=600)
    m.t(0.58, 2.25, '(C=C au centre)', fs=11, col=GREY)
    m.arrow(2.0, 0, 3.6, 0, col=GREY)
    # étape 2
    x = 5.0
    m.a('e1', x - 0.85, 0, ''); m.a('c1', x, 0, 'C'); m.a('c2', x + 1.15, 0, 'C'); m.a('e2', x + 2.0, 0, '')
    m.b('e1', 'c1', 1, NEW, w=2.2, dash=True); m.b('c1', 'c2'); m.b('c2', 'e2', 1, NEW, w=2.2, dash=True)
    for j, (sx, sy, o, lab) in enumerate([(x, -1, 'c1', 'H'), (x, 1, 'c1', 'H'), (x + 1.15, -1, 'c2', 'Cl'), (x + 1.15, 1, 'c2', 'H')]):
        m.a(f'h{j}', sx, sy, lab, '#1f8a47' if lab == 'Cl' else INK); m.b(o, f'h{j}')
    m.t(x + 0.58, 1.75, '2. C=C devient C–C', fs=11.5, weight=600)
    m.t(x + 0.58, 2.25, '+ un trait libre de chaque côté', fs=11, col=GREY)
    m.arrow(7.6, 0, 9.2, 0, col=GREY)
    motif(m, 'p', 10.6, 0, ('H', 'H', 'Cl', 'H'), cols=[INK, INK, '#1f8a47', INK])
    m.t(11.18, 1.75, '3. crochets + n', fs=11.5, weight=600)
    m.t(11.18, 2.25, 'PVC : ⟦–[CH2–CHCl]n–⟧', fs=11, col=GREY)
    return m.svg(pad=4, title='méthode : du monomère au polymère')


F['pvc_method'] = pvc_method()


def pp_cut():
    m = Mol(u=30, fs=14)
    xs = [0, 1.1, 2.2, 3.3, 4.4, 5.5]
    m.a('e0', -0.85, 0, ''); prev = 'e0'
    for i, x in enumerate(xs):
        nm = f'c{i}'
        m.a(nm, x, 0, 'C'); m.a(nm + 'u', x, -1, 'H')
        m.a(nm + 'd', x, 1, 'CH3' if i % 2 else 'H', '#1f8a47' if i % 2 else INK)
        m.b(nm, nm + 'u'); m.b(nm, nm + 'd'); m.b(prev, nm); prev = nm
    m.a('e1', 6.35, 0, ''); m.b(prev, 'e1')
    m.t(-1.2, 0, '…', fs=15); m.t(6.7, 0, '…', fs=15)
    for cx in (-0.48, 1.65, 3.85, 6.0):
        m.scissors(cx, -1.45, 1.5)
    m.t(0.55, 2.05, 'motif', fs=11.5, col=WAT, weight=600)
    m.t(2.75, 2.05, 'motif', fs=11.5, col=WAT, weight=600)
    m.t(4.95, 2.05, 'motif', fs=11.5, col=WAT, weight=600)
    m.arrow(7.3, 0, 9.3, 0, top='on garde 2 C', bottom='on remet C=C', fs=11)
    alkene(m, 'm', 10.2, 0, ('H', 'H', 'H', 'CH3'), cols=[INK, INK, INK, '#1f8a47'])
    m.t(10.78, 1.85, 'propène', fs=12, weight=600)
    return m.svg(pad=4, title='méthode : du polymère au monomère')


F['pp_cut'] = pp_cut()


ADD_TABLE = [
    # clé, sous-titres
    ('pe', ('H', 'H', 'H', 'H')),
    ('pp', ('H', 'H', 'H', 'CH3')),
    ('pvc', ('H', 'H', 'Cl', 'H')),
    ('ps', ('H', 'H', 'H', 'C6H5')),
    ('ptfe', ('F', 'F', 'F', 'F')),
    ('pbut', ('CH3', 'H', 'CH3', 'H')),
]
for key, subs in ADD_TABLE:
    m = Mol(u=26, fs=13)
    alkene(m, 'a', 0, 0, subs, dy=0.95)
    F['mono_' + key] = m.svg(pad=2, title='monomère ' + key)
    m = Mol(u=26, fs=13)
    motif(m, 'p', 0, 0, subs, dy=0.95, ext=0.9)
    F['motif_' + key] = m.svg(pad=2, title='motif ' + key)


# =====================================================================
#  POLYCONDENSATION
# =====================================================================

def bifonc():
    m = Mol(u=1, fs=12)
    BAR = '#5b6170'

    def tag(x, y, txt, col, w=None):
        w = w or (rich_w(txt, 11.5) + 12)
        m.box(x, y - 11, w, 22, fill='#fff', stroke=col, sw=1.5, r=9, layer='mid')
        m.t(x + w / 2, y, txt, col=col, fs=11.5, weight=700)
        return x + w

    def bar(x, y, w=44, lab=None):
        m.box(x, y - 7, w, 14, fill=BAR, stroke=BAR, sw=1, r=5, layer='mid')
        if lab:
            m.t(x + w / 2, y + 18, lab, fs=10.5, col=GREY)
        return x + w

    def link(x, y, txt):
        w = rich_w(txt, 11.5) + 10
        m.box(x, y - 10, w, 20, fill=NEW, stroke=NEW, sw=1, r=4, layer='mid')
        m.t(x + w / 2, y, txt, col='#fff', fs=11.5, weight=700)
        return x + w

    # Ligne A : monofonctionnels
    y = 20
    m.t(0, y - 26, 'Avec 1 seule fonction par molécule (chapitre 8) :', anchor='start', fs=12.5, weight=700)
    x = bar(0, y, 40, 'acide'); x = tag(x, y, 'COOH', ACID)
    m.t(x + 14, y, '+', fs=17)
    x = tag(x + 28, y, 'HO', ALC); x = bar(x, y, 40, 'alcool')
    m.arrow(x + 10, y, x + 60, y)
    x = bar(x + 72, y, 40); x = link(x, y, 'COO'); x = bar(x, y, 40)
    m.t(x + 14, y - 6, 'STOP : plus aucune fonction libre', anchor='start', fs=12, col=WAT, weight=700)
    m.t(x + 14, y + 10, '→ une seule petite molécule d’ester', anchor='start', fs=11.5, col=GREY)
    # Ligne B : bifonctionnels
    y = 88
    m.t(0, y - 26, 'Avec 2 fonctions par molécule (monomères bifonctionnels) :', anchor='start', fs=12.5, weight=700)
    x = tag(0, y, 'HOOC', ACID); x = bar(x, y, 36, 'diacide'); x = tag(x, y, 'COOH', ACID)
    m.t(x + 12, y, '+', fs=17)
    x = tag(x + 24, y, 'HO', ALC); x = bar(x, y, 36, 'dialcool'); x = tag(x, y, 'OH', ALC)
    m.arrow(x + 8, y, x + 50, y)
    x0 = x + 60
    x = tag(x0, y, 'HOOC', ACID); x = bar(x, y, 30); x = link(x, y, 'COO'); x = bar(x, y, 30); x = tag(x, y, 'OH', ALC)
    m.box(x0 - 4, y - 16, 41, 32, fill='none', stroke=AMI, sw=1.5, r=8, layer='fg', dash=True)
    m.box(x - 26, y - 16, 30, 32, fill='none', stroke=AMI, sw=1.5, r=8, layer='fg', dash=True)
    m.t((x0 + x) / 2, y + 26, 'encore une fonction libre à chaque bout → ça continue !', fs=11.5, col=AMI, weight=700)
    # Ligne C : polymère
    y = 160
    m.t(0, y, '… des milliers de fois :', anchor='start', fs=12.5, weight=700)
    x = 178
    m.t(x - 8, y, '…', fs=15)
    for i in range(5):
        x = bar(x, y, 34)
        x = link(x, y, 'COO')
    x = bar(x, y, 34)
    m.t(x + 10, y, '…', fs=15)
    m.t(x + 30, y, '= **polyester** !', anchor='start', fs=13, col=NEW)
    return m.svg(pad=4, title='pourquoi des monomères bifonctionnels')


F['bifonc'] = bifonc()


def polycond_steps():
    m = Mol(u=30, fs=14)
    rows = [0, 2.4, 4.8, 7.2]
    for r, lab in zip(rows, ['Départ', 'Étape 1', 'Étape 2', 'Étape 3']):
        m.t(-0.85, r, lab, anchor='end', fs=13, weight=700, col=CH9)
    # Départ
    y = 0
    m.a('r1', 0, y, '⋯', fs=16); m.a('c', 1.1, y, 'C', ACID); m.a('o', 1.1, y - 1.0, 'O', ACID)
    m.a('oa', 2.2, y, 'O', WAT); m.a('ha', 3.1, y, 'H', WAT)
    m.b('r1', 'c', 1, ACID); m.b('c', 'o', 2, ACID); m.b('c', 'oa', 1, WAT, dash=True); m.b('oa', 'ha', 1, WAT)
    m.a('hb', 4.6, y, 'H', WAT); m.a('ob', 5.5, y, 'O', ALC); m.a('r2', 6.5, y, '⋯', fs=16)
    m.b('hb', 'ob', 1, WAT, dash=True); m.b('ob', 'r2', 1, ALC)
    m.t(1.0, 0.75, 'diacide', fs=11, col=ACID)
    m.t(5.6, 0.75, 'dialcool', fs=11, col=ALC)
    # Étape 1
    y = 2.4
    m.a('r1b', 0, y, '⋯', fs=16); m.a('cb', 1.1, y, 'C', ACID); m.a('obb', 1.1, y - 1.0, 'O', ACID)
    m.b('r1b', 'cb', 1, ACID); m.b('cb', 'obb', 2, ACID); m.dot(1.48, y)
    m.dot(2.2, y); m.a('oa2', 2.55, y, 'O', WAT); m.a('ha2', 3.45, y, 'H', WAT); m.b('oa2', 'ha2', 1, WAT)
    m.a('hb2', 4.35, y, 'H', WAT); m.dot(4.7, y)
    m.dot(5.15, y); m.a('ob2', 5.5, y, 'O', ALC); m.a('r2b', 6.5, y, '⋯', fs=16); m.b('ob2', 'r2b', 1, ALC)
    # Étape 2
    y = 4.8
    m.a('r1c', 0, y, '⋯', fs=16); m.a('cc', 1.1, y, 'C', ACID); m.a('occ', 1.1, y - 1.0, 'O', ACID)
    m.a('oc', 2.2, y, 'O', ALC); m.a('r2c', 3.2, y, '⋯', fs=16)
    m.b('r1c', 'cc', 1, ACID); m.b('cc', 'occ', 2, ACID); m.b('cc', 'oc', 1, NEW, w=2.6); m.b('oc', 'r2c', 1, ALC)
    m.hl(['cc', 'occ', 'oc'], AMI, pad=4)
    m.t(1.55, 5.62, 'ester', fs=11, col=AMI, weight=700)
    m.dot(4.3, y); m.a('oa3', 4.65, y, 'O', WAT); m.a('ha3', 5.55, y, 'H', WAT); m.b('oa3', 'ha3', 1, WAT)
    m.a('hb3', 6.3, y, 'H', WAT); m.dot(6.65, y)
    # Étape 3
    y = 7.2
    m.a('r1d', 0, y, '⋯', fs=16); m.a('cd', 1.1, y, 'C', ACID); m.a('odd', 1.1, y - 1.0, 'O', ACID)
    m.a('od', 2.2, y, 'O', ALC); m.a('r2d', 3.2, y, '⋯', fs=16)
    m.b('r1d', 'cd', 1, ACID); m.b('cd', 'odd', 2, ACID); m.b('cd', 'od', 1, NEW, w=2.6); m.b('od', 'r2d', 1, ALC)
    m.t(3.95, y, '+', fs=18)
    m.a('wh1', 4.6, y, 'H', WAT); m.a('wo', 5.5, y, 'O', WAT); m.a('wh2', 6.4, y, 'H', WAT)
    m.b('wh1', 'wo', 1, WAT); m.b('wo', 'wh2', 1, NEW, w=2.2)
    # notes
    nx = 7.6
    m.t(nx, -0.3, 'Le groupe acide (–COOH) d’un monomère', anchor='start', fs=12)
    m.t(nx, 0.35, 'rencontre le groupe alcool (–OH) d’un autre.', anchor='start', fs=12)
    m.t(nx, 2.1, 'La liaison **C–O de l’acide** et la liaison', anchor='start', fs=12)
    m.t(nx, 2.75, '**O–H de l’alcool** se cassent → électrons •', anchor='start', fs=12, col='#077d7d')
    m.t(nx, 4.5, 'Le **C** et le **O** mettent leurs électrons', anchor='start', fs=12)
    m.t(nx, 5.15, 'en commun → **liaison ester** → polyester.', anchor='start', fs=12, col=NEW)
    m.t(nx, 6.9, '**H•** et **•OH** s’unissent à leur tour', anchor='start', fs=12)
    m.t(nx, 7.55, '→ une molécule d’**eau** est éliminée.', anchor='start', fs=12, col=WAT)
    return m.svg(pad=5, title='étapes de la polycondensation')


F['polycond_steps'] = polycond_steps()


def pet_eq():
    m = Mol(u=28, fs=14)
    y = 0
    m.t(-0.75, y, 'n', fs=16, weight=700, italic=True, col=CH9)
    m.a('ho', 0, y, 'HO', WAT); m.a('c1', 1.25, y, 'C', ACID); m.a('o1', 1.25, y - 1.05, 'O', ACID)
    m.ring('r', 3.05, y, 0.8, ACID)
    m.a('c2', 4.85, y, 'C', ACID); m.a('o2', 4.85, y - 1.05, 'O', ACID); m.a('oh', 6.1, y, 'OH', WAT)
    m.b('ho', 'c1', 1, ACID); m.b('c1', 'o1', 2, ACID); m.b('c1', 'r3', 1, ACID); m.b('r0', 'c2', 1, ACID)
    m.b('c2', 'o2', 2, ACID); m.b('c2', 'oh', 1, ACID)
    m.t(3.05, 1.35, 'acide téréphtalique (diacide)', fs=11, col=ACID)
    m.t(6.95, y, '+', fs=18)
    m.t(7.55, y, 'n', fs=16, weight=700, italic=True, col=CH9)
    m.a('h1', 8.15, y, 'H', WAT); m.a('oa', 9.05, y, 'O', ALC); m.a('k1', 10.45, y, 'CH2', ALC); m.a('k2', 11.95, y, 'CH2', ALC)
    m.a('ob', 13.35, y, 'O', ALC); m.a('h2', 14.25, y, 'H', WAT)
    m.b('h1', 'oa', 1, ALC); m.b('oa', 'k1', 1, ALC); m.b('k1', 'k2', 1, ALC); m.b('k2', 'ob', 1, ALC); m.b('ob', 'h2', 1, ALC)
    m.t(11.2, 1.35, 'éthane-1,2-diol = éthylène glycol (dialcool)', fs=11, col=ALC)
    # ligne 2
    y = 4.3
    m.arrow(-1.0, y, 0.6, y)
    m.a('e1', 1.0, y, ''); m.a('pc1', 2.0, y, 'C', ACID); m.a('po1', 2.0, y - 1.05, 'O', ACID)
    m.ring('q', 3.8, y, 0.8, ACID)
    m.a('pc2', 5.6, y, 'C', ACID); m.a('po2', 5.6, y - 1.05, 'O', ACID)
    m.a('pa', 6.7, y, 'O', ALC); m.a('pk1', 8.1, y, 'CH2', ALC); m.a('pk2', 9.6, y, 'CH2', ALC); m.a('pb', 11.0, y, 'O', ALC)
    m.a('e2', 11.9, y, '')
    m.b('e1', 'pc1', 1, NEW, w=2.4); m.b('pc1', 'po1', 2, ACID); m.b('pc1', 'q3', 1, ACID); m.b('q0', 'pc2', 1, ACID)
    m.b('pc2', 'po2', 2, ACID); m.b('pc2', 'pa', 1, NEW, w=2.4); m.b('pa', 'pk1', 1, ALC); m.b('pk1', 'pk2', 1, ALC)
    m.b('pk2', 'pb', 1, ALC); m.b('pb', 'e2', 1, NEW, w=2.4)
    m.br(1.45, 11.5, y, h=1.5)
    m.hl(['pc2', 'po2', 'pa'], AMI, pad=3)
    m.t(6.1, y - 2.05, 'ester', fs=11.5, col=AMI, weight=700)
    m.t(6.4, y + 1.95, 'PET = polyéthylène téréphtalate (polyester)', fs=11.5, weight=600)
    m.t(12.75, y, '+', fs=18)
    m.t(13.3, y, '⟦2n H2O⟧', anchor='start', fs=15, col=WAT, weight=700)
    return m.svg(pad=5, title='polycondensation du PET')


F['pet_eq'] = pet_eq()


def nylon_eq():
    m = Mol(u=28, fs=14)
    y = 0
    m.t(-0.75, y, 'n', fs=16, weight=700, italic=True, col=CH9)
    m.a('ho', 0, y, 'HO', WAT); m.a('c1', 1.25, y, 'C', ACID); m.a('o1', 1.25, y - 1.05, 'O', ACID)
    m.a('ch', 3.05, y, '(CH2)4', ACID)
    m.a('c2', 4.85, y, 'C', ACID); m.a('o2', 4.85, y - 1.05, 'O', ACID); m.a('oh', 6.1, y, 'OH', WAT)
    m.b('ho', 'c1', 1, ACID); m.b('c1', 'o1', 2, ACID); m.b('c1', 'ch', 1, ACID); m.b('ch', 'c2', 1, ACID)
    m.b('c2', 'o2', 2, ACID); m.b('c2', 'oh', 1, ACID)
    m.t(3.05, 1.35, 'acide hexanedioïque (6 C)', fs=11, col=ACID)
    m.t(6.95, y, '+', fs=18)
    m.t(7.55, y, 'n', fs=16, weight=700, italic=True, col=CH9)
    m.a('h1', 8.15, y, 'H', WAT); m.a('n1', 9.05, y, 'N', AMI); m.a('n1h', 9.05, y + 1.0, 'H', AMI)
    m.a('ch2', 10.85, y, '(CH2)6', AMI); m.a('n2', 12.65, y, 'N', AMI); m.a('n2h', 12.65, y + 1.0, 'H', AMI)
    m.a('h2', 13.55, y, 'H', WAT)
    m.b('h1', 'n1', 1, AMI); m.b('n1', 'n1h', 1, AMI); m.b('n1', 'ch2', 1, AMI); m.b('ch2', 'n2', 1, AMI)
    m.b('n2', 'n2h', 1, AMI); m.b('n2', 'h2', 1, AMI)
    m.t(10.85, 1.9, 'hexane-1,6-diamine (6 C)', fs=11, col=AMI)
    y = 4.8
    m.arrow(-1.0, y, 0.6, y)
    m.a('e1', 1.0, y, ''); m.a('pc1', 2.0, y, 'C', ACID); m.a('po1', 2.0, y - 1.05, 'O', ACID)
    m.a('pch', 3.8, y, '(CH2)4', ACID); m.a('pc2', 5.6, y, 'C', ACID); m.a('po2', 5.6, y - 1.05, 'O', ACID)
    m.a('pn1', 6.7, y, 'N', AMI); m.a('pn1h', 6.7, y + 1.0, 'H', AMI); m.a('pch2', 8.5, y, '(CH2)6', AMI)
    m.a('pn2', 10.3, y, 'N', AMI); m.a('pn2h', 10.3, y + 1.0, 'H', AMI); m.a('e2', 11.2, y, '')
    m.b('e1', 'pc1', 1, NEW, w=2.4); m.b('pc1', 'po1', 2, ACID); m.b('pc1', 'pch', 1, ACID); m.b('pch', 'pc2', 1, ACID)
    m.b('pc2', 'po2', 2, ACID); m.b('pc2', 'pn1', 1, NEW, w=2.4); m.b('pn1', 'pn1h', 1, AMI); m.b('pn1', 'pch2', 1, AMI)
    m.b('pch2', 'pn2', 1, AMI); m.b('pn2', 'pn2h', 1, AMI); m.b('pn2', 'e2', 1, NEW, w=2.4)
    m.br(1.45, 10.8, y, h=1.6)
    m.hl(['pc2', 'po2', 'pn1', 'pn1h'], AMI, pad=3)
    m.t(6.15, y - 2.15, 'amide', fs=11.5, col=AMI, weight=700)
    m.t(6.0, y + 2.25, 'polyamide 6,6 = nylon 6,6', fs=11.5, weight=600)
    m.t(12.05, y, '+', fs=18)
    m.t(12.6, y, '⟦2n H2O⟧', anchor='start', fs=15, col=WAT, weight=700)
    return m.svg(pad=5, title='polycondensation du nylon 6,6')


F['nylon_eq'] = nylon_eq()


def cut_method():
    m = Mol(u=30, fs=14)
    y = 0
    m.a('e0', -0.8, y, ''); m.a('o0', 0.2, y, 'O', ALC); m.a('c1', 1.3, y, 'C', ACID); m.a('k1', 1.3, y - 1.0, 'O', ACID)
    m.a('r1', 2.4, y, 'R1', ACID); m.a('c2', 3.5, y, 'C', ACID); m.a('k2', 3.5, y - 1.0, 'O', ACID)
    m.a('o1', 4.6, y, 'O', ALC); m.a('r2', 5.7, y, 'R2', ALC); m.a('o2', 6.8, y, 'O', ALC); m.a('c3', 7.9, y, 'C', ACID)
    m.a('k3', 7.9, y - 1.0, 'O', ACID); m.a('e1', 8.8, y, '')
    m.b('e0', 'o0', 1, ALC); m.b('o0', 'c1'); m.b('c1', 'k1', 2, ACID); m.b('c1', 'r1', 1, ACID); m.b('r1', 'c2', 1, ACID)
    m.b('c2', 'k2', 2, ACID); m.b('c2', 'o1'); m.b('o1', 'r2', 1, ALC); m.b('r2', 'o2', 1, ALC); m.b('o2', 'c3')
    m.b('c3', 'k3', 2, ACID); m.b('c3', 'e1', 1, ACID)
    m.t(-1.15, y, '…', fs=15); m.t(9.15, y, '…', fs=15)
    for cx in (0.75, 4.05, 7.35):
        m.scissors(cx, -1.5, 0.75)
    m.t(4.05, 1.25, 'on coupe chaque liaison ester entre C(=O) et O', fs=11.5, col=WAT)
    # résultats
    y = 3.6
    m.a('a0', 0, y, 'HO', WAT, weight=700); m.a('ac1', 1.25, y, 'C', ACID); m.a('ak1', 1.25, y - 1.0, 'O', ACID)
    m.a('ar', 2.35, y, 'R1', ACID); m.a('ac2', 3.45, y, 'C', ACID); m.a('ak2', 3.45, y - 1.0, 'O', ACID)
    m.a('a3', 4.7, y, 'OH', WAT, weight=700)
    m.b('a0', 'ac1', 1, WAT); m.b('ac1', 'ak1', 2, ACID); m.b('ac1', 'ar', 1, ACID); m.b('ar', 'ac2', 1, ACID)
    m.b('ac2', 'ak2', 2, ACID); m.b('ac2', 'a3', 1, WAT)
    m.t(2.35, y + 0.95, 'diacide : on ajoute **OH** sur le C=O', fs=11.5, col=ACID)
    m.a('bh', 6.3, y, 'H', WAT, weight=700); m.a('bo', 7.2, y, 'O', ALC); m.a('br', 8.3, y, 'R2', ALC); m.a('bo2', 9.4, y, 'O', ALC)
    m.a('bh2', 10.3, y, 'H', WAT, weight=700)
    m.b('bh', 'bo', 1, WAT); m.b('bo', 'br', 1, ALC); m.b('br', 'bo2', 1, ALC); m.b('bo2', 'bh2', 1, WAT)
    m.t(8.3, y + 0.95, 'dialcool : on ajoute **H** sur le O', fs=11.5, col=ALC)
    m.arrow(4.05, 1.65, 4.05, 2.35, col=GREY)
    return m.svg(pad=5, title='méthode : retrouver les monomères d’un polyester')


F['cut_method'] = cut_method()


# =====================================================================
#  Macromolécules biologiques
# =====================================================================

def bio_beads():
    m = Mol(u=1, fs=12)
    rows = [
        ('Polysaccharide', 'monosaccharide (ex. glucose)', '#cfe9c4', '#4f8a3a', 'amidon, cellulose, glycogène'),
        ('Acide nucléique', 'nucléotide', '#f5d0d6', '#a23a4f', 'ADN, ARN'),
        ('Protéine', 'acide aminé', '#d9d2f2', '#5a46a8', 'kératine, enzymes, hémoglobine…'),
    ]
    for r, (poly, mono, fill, stroke, ex) in enumerate(rows):
        y = r * 44
        m.t(0, y + 11, poly, anchor='start', fs=12.5, weight=700, col=stroke)
        x = 128
        for i in range(5):
            if i:
                m._line(x - 8, y + 11, x, y + 11, INK, 1.8)
            m.box(x, y, 64, 22, fill=fill, stroke=stroke, sw=1.1, r=10, layer='mid')
            x += 72
        m.t(128 + 2 * 72 + 32, y + 11, '', fs=10)
        m.t(128 + 180, y + 31, '1 bille = ' + mono, fs=10.5, col=GREY)
        m.t(500, y + 11, '→ ' + ex, anchor='start', fs=11.5)
    return m.svg(pad=3, title='macromolécules biologiques')


F['bio_beads'] = bio_beads()


def glucose_cond():
    m = Mol(u=1, fs=12)
    GL = '#e3f2dc'
    STK = '#4f8a3a'

    def hexa(cx, cy, r=17):
        import math
        pts = ' '.join(f'{cx + r * math.cos(math.radians(60 * i + 30)):.1f},{cy + r * math.sin(math.radians(60 * i + 30)):.1f}' for i in range(6))
        m.raw(f'<polygon points="{pts}" fill="{GL}" stroke="{STK}" stroke-width="1.4"/>', (cx - r, cy - r, cx + r, cy + r))
        m.t(cx, cy, 'G', fs=11, col=STK, weight=700)

    y = 20
    x = 0
    for i in range(3):
        m.t(x + 10, y, 'HO', fs=12, col=WAT if i else INK)
        m._line(x + 22, y, x + 30, y, INK, 1.4)
        hexa(x + 47, y)
        m._line(x + 64, y, x + 72, y, INK, 1.4)
        m.t(x + 84, y, 'OH', fs=12, col=WAT if i < 2 else INK)
        x += 110
        if i < 2:
            m.t(x - 9, y, '+', fs=16)
    m.arrow(x - 4, y, x + 36, y)
    x += 46
    m.t(x + 10, y, 'HO', fs=12)
    m._line(x + 22, y, x + 30, y, INK, 1.4)
    for i in range(3):
        hexa(x + 47, y)
        if i < 2:
            m._line(x + 64, y, x + 74, y, NEW, 2.4)
            m.t(x + 82, y, 'O', fs=12, col=NEW, weight=700)
            m._line(x + 90, y, x + 100, y, NEW, 2.4)
            x += 70
    m._line(x + 64, y, x + 72, y, INK, 1.4)
    m.t(x + 84, y, 'OH', fs=12)
    m.t(x + 100, y, '+ ⟦2 H2O⟧', anchor='start', fs=13, col=WAT, weight=700)
    m.t(0, y + 34, 'G = glucose ⟦C6H12O6⟧ : chaque liaison entre 2 glucoses élimine une molécule d’eau (comme un polyester !)',
        anchor='start', fs=11, col=GREY)
    return m.svg(pad=3, title='polycondensation du glucose')


F['glucose_cond'] = glucose_cond()


def aa_general():
    m = Mol(u=30, fs=15)
    m.a('n', 0, 0, 'H2N', AMI); m.a('c', 1.45, 0, 'C'); m.a('h', 1.45, -1.0, 'H'); m.a('r', 1.45, 1.05, 'R', NEW, weight=700)
    m.a('c2', 2.65, 0, 'C', ACID); m.a('o', 2.65, -1.05, 'O', ACID); m.a('oh', 3.9, 0, 'OH', ACID)
    m.b('n', 'c', 1, AMI); m.b('c', 'h'); m.b('c', 'r'); m.b('c', 'c2', 1, ACID); m.b('c2', 'o', 2, ACID); m.b('c2', 'oh', 1, ACID)
    m.hl(['n'], AMI, pad=3)
    m.hl(['c2', 'o', 'oh'], ACID, pad=3)
    m.t(-0.1, -1.45, 'groupe', fs=11.5, col=AMI, weight=700)
    m.t(-0.1, -0.95, 'amine', fs=11.5, col=AMI, weight=700)
    m.t(5.0, -0.85, 'groupe acide', anchor='start', fs=11.5, col=ACID, weight=700)
    m.t(5.0, -0.35, 'carboxylique', anchor='start', fs=11.5, col=ACID, weight=700)
    m.t(2.05, 1.65, 'R = radical (chaîne latérale) : différent', anchor='start', fs=11.5, col=NEW)
    m.t(2.05, 2.15, 'pour chacun des 20 acides aminés', anchor='start', fs=11.5, col=NEW)
    return m.svg(pad=4, title='acide aminé')


F['aa_general'] = aa_general()


def peptide():
    m = Mol(u=28, fs=14)
    y = 0
    m.a('n', 0, y, 'H2N', AMI); m.a('c', 1.4, y, 'C'); m.a('h', 1.4, y - 1, 'H'); m.a('r', 1.4, y + 1, 'R1', NEW)
    m.a('k', 2.6, y, 'C', ACID); m.a('o', 2.6, y - 1.05, 'O', ACID); m.a('oh', 3.8, y, 'OH', WAT)
    m.b('n', 'c', 1, AMI); m.b('c', 'h'); m.b('c', 'r'); m.b('c', 'k', 1, ACID); m.b('k', 'o', 2, ACID); m.b('k', 'oh', 1, WAT, dash=True)
    m.hl(['oh'], WAT, pad=2.5)
    m.t(1.6, 2.0, 'acide aminé 1', fs=11, col=GREY)
    m.t(4.65, y, '+', fs=18)
    m.a('hh', 5.35, y, 'H', WAT); m.a('n2', 6.25, y, 'N', AMI); m.a('n2h', 6.25, y + 1, 'H', AMI)
    m.a('c3', 7.45, y, 'C'); m.a('h3', 7.45, y - 1, 'H'); m.a('r2', 7.45, y + 1, 'R2', NEW)
    m.a('k2', 8.65, y, 'C', ACID); m.a('o2', 8.65, y - 1.05, 'O', ACID); m.a('oh2', 9.85, y, 'OH', ACID)
    m.b('hh', 'n2', 1, WAT, dash=True); m.b('n2', 'n2h', 1, AMI); m.b('n2', 'c3', 1, AMI); m.b('c3', 'h3'); m.b('c3', 'r2')
    m.b('c3', 'k2', 1, ACID); m.b('k2', 'o2', 2, ACID); m.b('k2', 'oh2', 1, ACID)
    m.hl(['hh'], WAT, pad=2.5)
    m.t(7.6, 2.0, 'acide aminé 2', fs=11, col=GREY)
    y = 4.6
    m.arrow(-1.0, y, 0.4, y)
    m.a('pn', 1.1, y, 'H2N', AMI); m.a('pc', 2.5, y, 'C'); m.a('ph', 2.5, y - 1, 'H'); m.a('pr', 2.5, y + 1, 'R1', NEW)
    m.a('pk', 3.7, y, 'C', ACID); m.a('po', 3.7, y - 1.05, 'O', ACID); m.a('pn2', 4.85, y, 'N', AMI); m.a('pn2h', 4.85, y + 1, 'H', AMI)
    m.a('pc3', 6.05, y, 'C'); m.a('ph3', 6.05, y - 1, 'H'); m.a('pr2', 6.05, y + 1, 'R2', NEW)
    m.a('pk2', 7.25, y, 'C', ACID); m.a('po2', 7.25, y - 1.05, 'O', ACID); m.a('poh2', 8.45, y, 'OH', ACID)
    m.b('pn', 'pc', 1, AMI); m.b('pc', 'ph'); m.b('pc', 'pr'); m.b('pc', 'pk', 1, ACID); m.b('pk', 'po', 2, ACID)
    m.b('pk', 'pn2', 1, NEW, w=2.6); m.b('pn2', 'pn2h', 1, AMI); m.b('pn2', 'pc3', 1, AMI); m.b('pc3', 'ph3'); m.b('pc3', 'pr2')
    m.b('pc3', 'pk2', 1, ACID); m.b('pk2', 'po2', 2, ACID); m.b('pk2', 'poh2', 1, ACID)
    m.hl(['pk', 'po', 'pn2', 'pn2h'], NEW, pad=3.5)
    m.t(4.3, y + 2.05, 'liaison peptidique (= liaison amide –CO–NH–)', fs=11.5, col=NEW, weight=700)
    m.t(9.3, y, '+', fs=18)
    m.a('w', 10.2, y, 'H2O', WAT, weight=700)
    m.t(4.3, y + 2.6, 'dipeptide : il reste un groupe amine à gauche et un groupe acide à droite → la chaîne peut continuer',
        fs=11, col=GREY)
    return m.svg(pad=5, title='formation d’un dipeptide')


F['peptide'] = peptide()


# =====================================================================
#  Résumé / propriétés / recyclage
# =====================================================================

def resume_tree():
    m = Mol(u=1, fs=12)

    def node(x, y, w, h, title, lines, col, fill='#fff'):
        m.box(x, y, w, h, fill=fill, stroke=col, sw=1.4, r=8)
        m.t(x + w / 2, y + 14, title, col=col, fs=12.5, weight=700)
        for i, ln in enumerate(lines):
            m.t(x + w / 2, y + 33 + i * 16, ln, fs=11.3)

    node(250, 0, 200, 30, 'POLYMÉRISATION', [], CH9, LIGHT9)
    m._line(350, 30, 350, 44, INK, 1.4)
    m._line(115, 44, 520, 44, INK, 1.4)
    m.arrow(115, 44, 115, 60)
    m.arrow(520, 44, 520, 60)
    node(0, 60, 230, 138, 'POLYADDITION', [
        'monomère : **alcène** (C=C)',
        '**un seul** type de monomère',
        'la double liaison s’ouvre',
        '**aucun** sous-produit',
        'ex. PE, PP, PVC, PS, PTFE',
        '⟦n CH2=CH2 → –[CH2–CH2]n–⟧',
    ], ACID)
    node(300, 60, 400, 70, 'POLYCONDENSATION', [
        'monomères **bifonctionnels** (2 fonctions chacun)',
        'élimination d’une petite molécule : ⟦H2O⟧ (ou HCl)',
    ], NEW)
    m._line(500, 130, 500, 142, INK, 1.4)
    m._line(370, 142, 640, 142, INK, 1.4)
    for x in (370, 500, 640):
        m.arrow(x, 142, x, 156)
    node(300, 156, 136, 100, 'POLYESTERS', ['diacide', '+ dialcool', '→ liaison **ester**', 'ex. PET'], ALC)
    node(440, 156, 120, 100, 'POLYAMIDES', ['diacide', '+ diamine', '→ liaison **amide**', 'ex. nylon, Kevlar'], AMI)
    node(564, 156, 136, 100, 'BIOLOGIQUES', ['protéines (AA)', 'polysaccharides', '(glucose)', 'ADN (nucléotides)'], '#5a46a8')
    return m.svg(pad=3, title='résumé des polymérisations')


F['resume_tree'] = resume_tree()


def wavy(x0, y0, length, amp=4, k=0.14, phase=0.0, step=4):
    import math
    pts = []
    x = 0
    while x <= length:
        pts.append(f'{x0 + x:.1f},{y0 + amp * math.sin(k * x + phase):.1f}')
        x += step
    return pts


def structures():
    import math
    m = Mol(u=1, fs=12)
    C1 = '#3d5f8a'
    # Panneau 1 : thermoplastique
    m.box(0, 0, 216, 118, fill='#f4f8fc', stroke='#c9d6e6', sw=1, r=8)
    for i in range(5):
        pts = wavy(16, 17 + i * 21, 184, amp=5, phase=i * 1.3)
        m.raw(f'<polyline points="{" ".join(pts)}" fill="none" stroke="{C1}" stroke-width="2.2" stroke-linecap="round"/>', (0, 0, 216, 118))
    m.t(108, 132, '**Thermoplastique**', fs=13, col=C1)
    m.t(108, 149, 'chaînes **séparées** (pas de liaisons', fs=11.3)
    m.t(108, 164, 'covalentes entre elles) → glissent', fs=11.3)
    m.t(108, 179, 'à la chaleur : **fond**, se remodèle', fs=11.3)
    m.t(108, 194, '→ **recyclable** (PE, PET, PVC, PP, PS)', fs=11.3)
    # Panneau 2 : thermodurcissable
    ox = 240
    m.box(ox, 0, 216, 118, fill='#fbf2ee', stroke='#ead2c6', sw=1, r=8)
    ys = [17 + i * 21 for i in range(5)]
    for i, y in enumerate(ys):
        pts = wavy(ox + 16, y, 184, amp=5, phase=i * 1.3)
        m.raw(f'<polyline points="{" ".join(pts)}" fill="none" stroke="{C1}" stroke-width="2.2" stroke-linecap="round"/>', (ox, 0, ox + 216, 118))
    for i in range(4):
        for j, xx in enumerate(range(30 + (i % 2) * 18, 196, 36)):
            y1 = ys[i] + 5 * math.sin(0.14 * xx + i * 1.3)
            y2 = ys[i + 1] + 5 * math.sin(0.14 * xx + (i + 1) * 1.3)
            m._line(ox + 16 + xx, y1, ox + 16 + xx, y2, WAT, 2.2)
    m.t(ox + 108, 132, '**Thermodurcissable**', fs=13, col=WAT)
    m.t(ox + 108, 149, 'chaînes reliées par des **liaisons**', fs=11.3)
    m.t(ox + 108, 164, '**covalentes** → réseau 3D rigide', fs=11.3)
    m.t(ox + 108, 179, 'à la chaleur : **ne fond pas**, brûle', fs=11.3)
    m.t(ox + 108, 194, '→ **non recyclable** (ex. bakélite)', fs=11.3)
    # Panneau 3 : élastomère
    ox = 480
    m.box(ox, 0, 216, 118, fill='#f5f3fb', stroke='#d8d2ee', sw=1, r=8)
    cent = []
    for i in range(3):
        pts = []
        cy = 24 + i * 35
        for s in range(0, 300, 2):
            t = s / 7.0 + i
            pts.append(f'{ox + 22 + s * 0.57 + 11 * math.cos(t):.1f},{cy + 10 * math.sin(t):.1f}')
        cent.append(cy)
        m.raw(f'<polyline points="{" ".join(pts)}" fill="none" stroke="{C1}" stroke-width="2" stroke-linecap="round"/>', (ox, 0, ox + 216, 118))
    for (xx, i) in ((62, 0), (150, 1), (128, 0), (44, 1)):
        m._line(ox + xx, cent[i] + 10, ox + xx, cent[i + 1] - 10, WAT, 2.4)
    m.t(ox + 108, 132, '**Élastomère** (pour info)', fs=13, col='#5a46a8')
    m.t(ox + 108, 149, 'chaînes **enroulées** avec quelques', fs=11.3)
    m.t(ox + 108, 164, 'ponts → s’étirent puis reprennent', fs=11.3)
    m.t(ox + 108, 179, 'leur forme (caoutchouc des pneus)', fs=11.3)
    m.t(ox + 300, 194, '', fs=11.3)
    return m.svg(pad=3, title='structure et propriétés')


F['structures'] = structures()


def code_svg(num, col='#1f2430'):
    import math
    m = Mol(u=1, fs=12)
    # triangle de flèches
    R = 25
    cx, cy = 27, 28
    P = [(cx + R * math.cos(math.radians(a)), cy + R * math.sin(math.radians(a))) for a in (-90, 30, 150)]
    for i in range(3):
        (x1, y1), (x2, y2) = P[i], P[(i + 1) % 3]
        # raccourcir
        sx, sy = x1 + (x2 - x1) * 0.14, y1 + (y2 - y1) * 0.14
        ex, ey = x1 + (x2 - x1) * 0.80, y1 + (y2 - y1) * 0.80
        m._line(sx, sy, ex, ey, col, 3.2, cap='butt')
        L = math.hypot(ex - sx, ey - sy)
        ux, uy = (ex - sx) / L, (ey - sy) / L
        hx, hy = ex + ux * 6, ey + uy * 6
        px, py = -uy * 4.6, ux * 4.6
        m.raw(f'<path d="M{hx:.1f},{hy:.1f} L{ex + px:.1f},{ey + py:.1f} L{ex - px:.1f},{ey - py:.1f} Z" fill="{col}"/>',
              (hx - 6, hy - 6, hx + 6, hy + 6))
    m.t(cx, cy + 1.5, str(num), fs=13, weight=700, col=col)
    return m.svg(pad=2, title=f'code {num}')


for i in range(1, 8):
    F[f'code{i}'] = code_svg(i)


def valorisation():
    m = Mol(u=1, fs=12)
    m.box(0, 63, 150, 50, fill='#fff', stroke=INK, sw=1.4, r=8)
    m.t(75, 81, '**Déchet plastique**', fs=13)
    m.t(75, 98, 'trié (sac PMC)', fs=11.5, col=GREY)
    boxes = [
        (0, '1. Valorisation de MATIÈRE', ['objet usagé → **nouvel objet** en plastique',
                                          'broyer, laver, fondre (≈ 250 °C), granulés',
                                          'seulement les **thermoplastiques** (PE, PET, PVC)',
                                          'ex. 27 bouteilles PET → 1 pull polaire'], ACID),
        (1, '2. Valorisation CHIMIQUE', ['objet usagé → **monomères**, combustibles ou gaz',
                                         'ex. PS → styrène → PS neuf',
                                         'chaînes cassées (sans air) → hydrocarbures',
                                         'très haute T° → mélange CO + ⟦H2⟧ (combustible)'], AMI),
        (2, '3. Valorisation ÉNERGÉTIQUE', ['on **brûle** le plastique dans un incinérateur',
                                            'pouvoir calorifique ≈ celui du gazole',
                                            '→ chaleur → **électricité** + chauffage',
                                            'ex. Uvélia (Intradel, Herstal)'], WAT),
    ]
    for i, title, lines, col in boxes:
        y = i * 68 - 4
        m.box(210, y, 470, 63, fill='#fff', stroke=col, sw=1.5, r=8)
        m.t(222, y + 12, title, anchor='start', fs=12.5, weight=700, col=col)
        m.t(222, y + 28, lines[0] + '  •  ' + lines[1], anchor='start', fs=11.2)
        m.t(222, y + 42, lines[2], anchor='start', fs=11.2)
        m.t(222, y + 55, lines[3], anchor='start', fs=11.2, col=GREY)
        m.arrow(150, 88, 208, y + 31, col=col)
    return m.svg(pad=3, title='3 valorisations des plastiques')


F['valorisation'] = valorisation()
