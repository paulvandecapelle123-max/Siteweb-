/* Simulateur IA · grands favoris — tableau de bord. Aucune dépendance, marche aussi en double-cliquant index.html. */
(() => {
  'use strict';

  const H = window.HISTORIQUE || null;   // vrais matchs passés (tools/historique.py)
  const J = window.JOURNAL || null;      // paris de l'IA en direct (tools/live.py)
  const $ = (id) => document.getElementById(id);
  const SVG = 'http://www.w3.org/2000/svg';

  // ------------------------------------------------------------ outils d'affichage
  function el(tag, props, ...enfants) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'style') n.style.cssText = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const e of enfants.flat()) {
      if (e == null || e === false) continue;
      n.append(e instanceof Node ? e : document.createTextNode(String(e)));
    }
    return n;
  }
  function s(tag, attrs, ...enfants) {
    const n = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null) n.setAttribute(k, v);
    for (const e of enfants) if (e != null) n.append(e instanceof Node ? e : document.createTextNode(String(e)));
    return n;
  }

  const nf0 = new Intl.NumberFormat('fr-BE', { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const compact = new Intl.NumberFormat('fr-BE', { notation: 'compact', maximumFractionDigits: 1 });
  const euros = (x) => (Math.abs(x) >= 1e6 ? compact.format(x) : nf0.format(Math.round(x))) + ' €';
  const eurosC = (x) => nf2.format(x) + ' €';
  const sgn = (x) => (x > 0 ? '+' : x < 0 ? '−' : '');
  const signe = (x, f = euros) => sgn(x) + f(Math.abs(x));
  const pct = (x, d = 1) => (!Number.isFinite(x) ? '–' : (x * 100).toLocaleString('fr-BE', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' %');
  const pctSigne = (x, d = 1) => sgn(x) + pct(Math.abs(x), d);
  const cote = (x) => (x == null ? '–' : x.toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 3 }));
  const depuisEntier = (d) => new Date(Math.floor(d / 10000), (Math.floor(d / 100) % 100) - 1, d % 100);
  const dateCourte = (dt) => dt.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' });
  const dateHeure = (iso) => new Date(iso).toLocaleString('fr-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  function tuile(label, valeur, aide) {
    return el('div', { class: 'tuile' },
      el('div', { class: 'label', text: label }),
      el('div', { class: 'valeur', text: valeur }),
      aide ? el('div', { class: 'aide', text: aide }) : null);
  }

  function tableau(hote, colonnes, lignes, messageVide) {
    hote.replaceChildren();
    if (!lignes.length) { hote.append(el('div', { class: 'vide', text: messageVide || 'Rien à afficher.' })); return; }
    const thead = el('thead', null, el('tr', null, colonnes.map((c) => el('th', { class: c.n ? 'n' : null, scope: 'col', text: c.t }))));
    const tbody = el('tbody', null, lignes.map((l) => el('tr', null, l.map((v, i) => el('td', { class: colonnes[i].n ? 'n' : null }, v)))));
    hote.append(el('table', null, thead, tbody));
  }

  const statut = (st) => el('span', { class: 'statut ' + st, text: { gagne: 'Gagné', perdu: 'Perdu', en_cours: 'En cours', annule: 'Remboursé' }[st] || st });
  const montant = (g, f = eurosC) => (g == null ? '–' : el('span', { class: g > 0 ? 'positif' : g < 0 ? 'negatif' : null, text: signe(g, f) }));

  // ------------------------------------------------------------ graphiques (SVG à la main)
  function graduations(min, max, n) {
    const etendue = max - min || Math.abs(max) || 1;
    const brut = etendue / n;
    const mag = 10 ** Math.floor(Math.log10(brut));
    const r = brut / mag;
    const pas = (r >= 7.5 ? 10 : r >= 3.5 ? 5 : r >= 1.5 ? 2 : 1) * mag;
    const out = [];
    for (let v = Math.floor(min / pas) * pas; v <= Math.ceil(max / pas) * pas + pas / 2; v += pas) out.push(+v.toFixed(10));
    return out;
  }

  function bulle(hote) {
    const b = el('div', { class: 'bulle', role: 'status' });
    hote.append(b);
    return {
      montrer(x, y, lignes) {
        b.replaceChildren(...lignes);
        b.classList.add('visible');
        const w = b.offsetWidth, hh = b.offsetHeight, W = hote.clientWidth;
        b.style.left = (x + 14 + w > W ? Math.max(0, x - w - 14) : x + 14) + 'px';
        b.style.top = Math.max(0, y - hh - 10) + 'px';
      },
      cacher() { b.classList.remove('visible'); },
    };
  }

  // Courbe du capital : une série, ligne de 2 px, lavis à 10 %, réticule + bulle au survol et au clavier.
  function courbe(hote, pts, depart, unite = 'jour') {
    hote.replaceChildren();
    if (pts.length < 2) { hote.append(el('div', { class: 'vide', text: 'Pas encore assez de paris réglés pour tracer la courbe.' })); return; }
    const W = Math.max(300, Math.round(hote.clientWidth)), Ht = W < 560 ? 220 : 280;
    const m = { t: 14, r: W < 560 ? 12 : 84, b: 28, l: 68 };
    const pw = W - m.l - m.r, ph = Ht - m.t - m.b;
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const x0 = xs[0], x1 = xs[xs.length - 1] === x0 ? x0 + 864e5 : xs[xs.length - 1];
    const ticks = graduations(Math.min(depart, ...ys), Math.max(depart, ...ys), 4);
    const y0 = ticks[0], y1 = ticks[ticks.length - 1];
    const X = (v) => m.l + ((v - x0) / (x1 - x0)) * pw;
    const Y = (v) => m.t + ph - ((v - y0) / (y1 - y0 || 1)) * ph;

    const svg = s('svg', { viewBox: `0 0 ${W} ${Ht}`, role: 'img', tabindex: '0',
      'aria-label': `Capital de ${euros(pts[0].y)} à ${euros(pts[pts.length - 1].y)}. Flèches gauche et droite pour parcourir.` });
    const grille = s('g', { class: 'grille' }), axe = s('g', { class: 'axe' });
    for (const t of ticks) {
      grille.append(s('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t) }));
      axe.append(s('text', { x: m.l - 8, y: Y(t) + 4, 'text-anchor': 'end' }, euros(t)));
    }
    // graduations du temps : années, ou mois si la période est courte
    const dA = new Date(x0), dB = new Date(x1), ans = dB.getFullYear() - dA.getFullYear();
    const marques = [];
    if (ans >= 2) {
      const pas = Math.ceil((ans + 1) / Math.max(2, Math.floor(pw / 70)));
      for (let a = dA.getFullYear() + 1; a <= dB.getFullYear(); a += pas) marques.push([new Date(a, 0, 1).getTime(), String(a)]);
    } else {
      const mois = (dB.getFullYear() - dA.getFullYear()) * 12 + dB.getMonth() - dA.getMonth();
      const pas = Math.max(1, Math.ceil(mois / Math.max(2, Math.floor(pw / 80))));
      for (let k = 1; k <= mois; k += pas) {
        const d = new Date(dA.getFullYear(), dA.getMonth() + k, 1);
        marques.push([d.getTime(), d.toLocaleDateString('fr-BE', { month: 'short', year: 'numeric' })]);
      }
      if (!marques.length) marques.push([x0, dateCourte(dA)]);
    }
    for (const [t, txt] of marques) axe.append(s('text', { x: X(t), y: Ht - 8, 'text-anchor': 'middle' }, txt));
    svg.append(grille, s('line', { class: 'base', x1: m.l, x2: W - m.r, y1: m.t + ph, y2: m.t + ph }), axe);

    // référence : capital de départ
    svg.append(s('line', { class: 'reference', x1: m.l, x2: W - m.r, y1: Y(depart), y2: Y(depart) }));
    svg.append(s('text', { class: 'etiquette halo', x: m.l + 6, y: Y(depart) - 6 }, `Départ ${euros(depart)}`));

    let d = '';
    pts.forEach((p, i) => { d += `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`; });
    svg.append(s('path', { class: 'aire', d: `${d}L${X(x1)},${m.t + ph}L${X(x0)},${m.t + ph}Z` }));
    svg.append(s('path', { class: 'ligne', d }));
    const fin = pts[pts.length - 1];
    svg.append(s('circle', { class: 'point', cx: X(fin.x), cy: Y(fin.y), r: 4 }));
    if (m.r > 40) svg.append(s('text', { class: 'valeur-fin', x: X(fin.x) + 8, y: Y(fin.y) + 4 }, euros(fin.y)));

    const croix = s('line', { class: 'croix', y1: m.t, y2: m.t + ph, visibility: 'hidden' });
    const curseur = s('circle', { class: 'point', r: 4, visibility: 'hidden' });
    const zone = s('rect', { x: m.l, y: m.t, width: pw, height: ph, fill: 'transparent' });
    svg.append(croix, curseur, zone);
    hote.append(svg);
    const b = bulle(hote);

    let actuel = -1;
    function viser(i) {
      i = Math.max(0, Math.min(pts.length - 1, i));
      actuel = i;
      const p = pts[i], px = X(p.x), py = Y(p.y);
      croix.setAttribute('x1', px); croix.setAttribute('x2', px); croix.setAttribute('visibility', 'visible');
      curseur.setAttribute('cx', px); curseur.setAttribute('cy', py); curseur.setAttribute('visibility', 'visible');
      const k = svg.getBoundingClientRect().width / W;
      b.montrer(px * k, py * k, [
        el('div', { class: 'fort' }, el('span', { class: 'ligne-cle' }), euros(p.y)),
        el('div', { class: 'sec', text: dateCourte(new Date(p.x)) }),
        p.n ? el('div', { class: 'sec', text: `${p.n} pari${p.n > 1 ? 's' : ''} ce ${unite} : ${signe(p.g, eurosC)}` }) : null,
      ]);
    }
    function proche(clientX) {
      const r = svg.getBoundingClientRect();
      const t = x0 + (((clientX - r.left) * (W / r.width) - m.l) / pw) * (x1 - x0);
      let lo = 0, hi = pts.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (pts[mid].x < t) lo = mid; else hi = mid; }
      return t - pts[lo].x < pts[hi].x - t ? lo : hi;
    }
    function cacher() { croix.setAttribute('visibility', 'hidden'); curseur.setAttribute('visibility', 'hidden'); b.cacher(); }
    zone.addEventListener('pointermove', (e) => viser(proche(e.clientX)));
    zone.addEventListener('pointerleave', cacher);
    svg.addEventListener('blur', cacher);
    svg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const pas = e.shiftKey ? Math.ceil(pts.length / 20) : 1;
        viser(actuel < 0 ? pts.length - 1 : actuel + (e.key === 'ArrowRight' ? pas : -pas));
      } else if (e.key === 'Escape') cacher();
    });
  }

  function cheminBarre(x, yBase, yFin, w, r) {
    const h = Math.abs(yFin - yBase);
    r = Math.min(r, h, w / 2);
    const haut = yFin < yBase, e = haut ? r : -r;
    return `M${x},${yBase}V${yFin + e}Q${x},${yFin} ${x + r},${yFin}H${x + w - r}Q${x + w},${yFin} ${x + w},${yFin + e}V${yBase}Z`;
  }

  // Colonnes autour de zéro : bleu = gain, rouge = perte ; la zone du filtre actuel est grisée.
  function colonnes(hote, items) {
    hote.replaceChildren();
    const W = Math.max(300, Math.round(hote.clientWidth)), Ht = 250;
    const m = { t: 22, r: 8, b: 42, l: 52 };
    const pw = W - m.l - m.r, ph = Ht - m.t - m.b;
    const vals = items.filter((i) => i.n).map((i) => i.v);
    // marge sous la barre la plus basse pour que son étiquette ne touche pas l'axe
    const ticks = graduations(Math.min(0, ...vals, -0.02) * 1.25, Math.max(0, ...vals, 0.02) * 1.25, 4);
    const y0 = ticks[0], y1 = ticks[ticks.length - 1];
    const Y = (v) => m.t + ph - ((v - y0) / (y1 - y0)) * ph;
    const bande = pw / items.length, bw = Math.min(24, bande * 0.55);
    const etroit = bande < 64;   // téléphone : étiquettes courtes, valeurs dans la bulle et le tableau
    const svg = s('svg', { viewBox: `0 0 ${W} ${Ht}`, role: 'img', 'aria-label': 'Rendement par niveau de favori (détail dans le tableau en dessous)' });
    items.forEach((it, i) => { if (it.zone) svg.append(s('rect', { class: 'seuil', x: m.l + i * bande, y: m.t, width: bande, height: ph })); });
    const grille = s('g', { class: 'grille' }), axe = s('g', { class: 'axe' });
    for (const t of ticks) {
      grille.append(s('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t) }));
      axe.append(s('text', { x: m.l - 8, y: Y(t) + 4, 'text-anchor': 'end' }, pctSigne(t, 0)));
    }
    svg.append(grille, axe, s('line', { class: 'base', x1: m.l, x2: W - m.r, y1: Y(0), y2: Y(0) }));
    hote.append(svg);
    const b = bulle(hote);
    items.forEach((it, i) => {
      const cx = m.l + i * bande + bande / 2;
      svg.append(s('text', { class: 'etiquette', x: cx, y: Ht - 22, 'text-anchor': 'middle' }, etroit ? it.court : it.label));
      if (!it.n) { svg.append(s('text', { class: 'etiquette', x: cx, y: Y(0) - 6, 'text-anchor': 'middle' }, '–')); return; }
      const g = s('g', { class: 'barre ' + (it.v >= 0 ? 'pos' : 'neg'), tabindex: '0', role: 'img',
        'aria-label': `${it.label} : rendement ${pctSigne(it.v)}, ${it.n} paris` });
      g.append(s('rect', { class: 'cible', x: m.l + i * bande, y: m.t, width: bande, height: ph }));
      const yv = Y(it.v), yz = Y(0);
      g.append(s('path', { d: Math.abs(yv - yz) < 1 ? `M${cx - bw / 2},${yz - 0.5}h${bw}v1h${-bw}Z` : cheminBarre(cx - bw / 2, yz, yv, bw, 4) }));
      const ty = it.v >= 0 ? yv - 6 : yv + 14;
      if (!etroit) g.append(s('text', { class: 'valeur-fin', x: cx, y: ty, 'text-anchor': 'middle' }, pctSigne(it.v, 1)));
      const montrer = () => {
        const k = svg.getBoundingClientRect().width / W;
        b.montrer(cx * k, Math.min(yv, yz) * k, [
          el('div', { class: 'fort', text: `Rendement ${pctSigne(it.v)}` }),
          el('div', { class: 'sec', text: `Favoris à ${it.label} de chances` }),
          el('div', { class: 'sec', text: `${nf0.format(it.n)} paris · réussite ${pct(it.reel)} (promis ${pct(it.promis)})` }),
        ]);
      };
      g.addEventListener('pointerenter', montrer);
      g.addEventListener('focus', montrer);
      g.addEventListener('pointerleave', () => b.cacher());
      g.addEventListener('blur', () => b.cacher());
      svg.append(g);
    });
    svg.append(s('text', { class: 'etiquette', x: m.l + pw / 2, y: Ht - 4, 'text-anchor': 'middle' },
      etroit ? 'Chances du favori (en %, à partir de)' : 'Chances du favori selon les cotes'));
  }

  // ------------------------------------------------------------ onglets
  const onglets = [...document.querySelectorAll('[role="tab"]')];
  const dessins = { passe: null, direct: null };   // pour redessiner au redimensionnement
  function ouvrir(btn, memoriser = true) {
    for (const o of onglets) {
      const actif = o === btn;
      o.setAttribute('aria-selected', String(actif));
      o.tabIndex = actif ? 0 : -1;
      $(o.getAttribute('aria-controls')).hidden = !actif;
    }
    if (memoriser) try { localStorage.setItem('simulateur-onglet', btn.id); } catch (e) { /* stockage indisponible */ }
    const f = dessins[btn.getAttribute('aria-controls')];
    if (f) f();
  }
  onglets.forEach((o, i) => {
    o.addEventListener('click', () => ouvrir(o));
    o.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const n = onglets[(i + (e.key === 'ArrowRight' ? 1 : onglets.length - 1)) % onglets.length];
      n.focus(); ouvrir(n);
    });
  });

  // ------------------------------------------------------------ TEST SUR LE PASSÉ
  // colonnes : date, sport, compétition, favori, outsider, proba, cote Bet365, cote moyenne, cote max, favori gagné
  const NIVEAUX = [0.80, 0.85, 0.90, 0.93, 0.95, 0.96, 0.97, 0.98, 0.99, 1.0001];

  function reglages() {
    const sports = new Set([...document.querySelectorAll('#f-sports input:checked')].map((i) => +i.value));
    return {
      capital: Math.max(1, +$('f-capital').value || 10000),
      pmin: +$('f-proba').value / 100,
      mise: $('f-mise').value,
      cote: $('f-cote').value,
      strat: $('f-strat').value,
      debut: +$('f-debut').value * 10000,
      fin: +$('f-fin').value * 10000 + 1231,
      sports,
    };
  }

  function prix(m, mode) {
    const v = mode === 'b365' ? m[6] : mode === 'max' ? m[8] : m[7];
    return { c: v || m[7], remplace: !v };
  }

  function simuler(r) {
    const choisis = [];
    let remplaces = 0;
    for (const m of H.matchs) {
      if (m[0] < r.debut || m[0] > r.fin || !r.sports.has(m[1]) || m[5] < r.pmin) continue;
      const p = prix(m, r.cote);
      if (!p.c || p.c <= 1) continue;
      if (r.strat === 'valeur' && m[5] * p.c <= 1) continue;
      if (p.remplace) remplaces++;
      choisis.push([m, p.c]);
    }
    let capital = r.capital, sommet = capital, chute = 0, mises = 0, gagnes = 0, promis = 0, sommeCotes = 0, ruine = null;
    const paris = [], points = [];
    if (choisis.length) points.push({ x: depuisEntier(choisis[0][0][0]).getTime() - 864e5, y: capital });
    for (let i = 0; i < choisis.length;) {
      const jour = choisis[i][0][0];
      let k = i;
      while (k < choisis.length && choisis[k][0][0] === jour) k++;
      const n = k - i;
      let mise = r.mise[0] === 'p' ? (capital * +r.mise.slice(1)) / 100 : +r.mise.slice(1);
      if (mise * n > capital) mise = capital / n;     // on ne mise jamais plus que ce qu'on a
      if (mise < 0.01) { ruine = depuisEntier(jour); break; }
      let g = 0;
      for (let t = i; t < k; t++) {
        const [m, c] = choisis[t];
        const gain = m[9] ? mise * (c - 1) : -mise;
        g += gain; mises += mise; promis += m[5]; sommeCotes += c;
        if (m[9]) gagnes++;
        paris.push({ m, c, mise, gain });
      }
      capital += g;
      sommet = Math.max(sommet, capital);
      chute = Math.max(chute, (sommet - capital) / sommet);
      points.push({ x: depuisEntier(jour).getTime(), y: capital, n, g });
      i = k;
    }
    return { paris, points, capital, mises, gagnes, promis, sommeCotes, chute, ruine, remplaces };
  }

  function parNiveau(r) {
    const stats = NIVEAUX.slice(0, -1).map((bas, i) => ({ bas, haut: NIVEAUX[i + 1], n: 0, gagnes: 0, promis: 0, profit: 0, cotes: 0 }));
    for (const m of H.matchs) {
      if (m[0] < r.debut || m[0] > r.fin || !r.sports.has(m[1])) continue;
      const c = prix(m, r.cote).c;
      if (!c || c <= 1) continue;
      const b = stats.find((x) => m[5] >= x.bas && m[5] < x.haut);
      if (!b) continue;
      b.n++; b.promis += m[5]; b.cotes += c;
      if (m[9]) { b.gagnes++; b.profit += c - 1; } else b.profit -= 1;
    }
    return stats.map((b) => ({
      label: b.haut > 1 ? `${Math.round(b.bas * 100)}+ %` : `${Math.round(b.bas * 100)}–${Math.round(b.haut * 100)} %`,
      court: b.haut > 1 ? `${Math.round(b.bas * 100)}+` : String(Math.round(b.bas * 100)),
      n: b.n, v: b.n ? b.profit / b.n : 0, reel: b.n ? b.gagnes / b.n : 0, promis: b.n ? b.promis / b.n : 0,
      coteMoy: b.n ? b.cotes / b.n : 0, zone: b.bas >= r.pmin - 1e-9 || (r.pmin > b.bas && r.pmin < b.haut),
    }));
  }

  function dessinerPasse() {
    const r = reglages();
    $('o-proba').textContent = pct(r.pmin, +$('f-proba').value % 1 ? 1 : 0);
    const res = simuler(r);
    const n = res.paris.length, profit = res.capital - r.capital;

    $('r-final').textContent = euros(res.capital);
    const delta = $('r-delta');
    delta.textContent = n ? `${signe(profit)} (${pctSigne(profit / r.capital)})` : '';
    delta.className = 'delta ' + (profit > 0 ? 'up' : profit < 0 ? 'down' : '');
    const debutTxt = n ? dateCourte(depuisEntier(res.paris[0].m[0])) : '';
    const finTxt = n ? dateCourte(depuisEntier(res.paris[n - 1].m[0])) : '';
    $('r-phrase').textContent = !n
      ? 'Aucun match ne passe ce filtre. Baisse les chances minimum, ou ajoute des sports et des années.'
      : `Sur ${nf0.format(n)} vrais paris entre le ${debutTxt} et le ${finTxt}, ${euros(r.capital)} seraient devenus ${euros(res.capital)}. ` +
        (res.mises ? `Chaque euro misé a ${profit >= 0 ? 'rapporté' : 'coûté'} en moyenne ${nf2.format(Math.abs(profit / res.mises) * 100)} centimes.` : '');

    const perdus = n - res.gagnes, coteMoy = n ? res.sommeCotes / n : 0;
    $('r-tuiles').replaceChildren(
      tuile('Paris simulés', nf0.format(n), `parmi ${nf0.format(H.matchs_analyses)} matchs réels analysés`),
      tuile('Réussite réelle', n ? pct(res.gagnes / n) : '–', n ? `les cotes promettaient ${pct(res.promis / n)}` : null),
      tuile('Rendement par euro misé', res.mises ? pctSigne(profit / res.mises, 2) : '–', res.mises ? `${euros(res.mises)} misés au total` : null),
      tuile('Favoris battus', nf0.format(perdus), n ? `1 pari sur ${nf0.format(Math.round(n / Math.max(1, perdus)))}` : null),
      tuile('Une défaite efface', coteMoy > 1 ? `${nf0.format(Math.round(1 / (coteMoy - 1)))} victoires` : '–', coteMoy ? `cote moyenne ${cote(coteMoy)}` : null),
      tuile('Pire chute', n ? pct(res.chute) : '–', 'depuis le plus haut du capital'),
    );

    const alertes = [];
    if (n && n < 150) alertes.push(`Seulement ${n} paris : c'est trop peu pour conclure, un seul favori battu change tout. Baisse un peu les chances minimum (par exemple 95 %) pour avoir plus de matchs.`);
    if (res.ruine) alertes.push(`Le capital a été entièrement perdu le ${dateCourte(res.ruine)}.`);
    if (res.remplaces && r.cote !== 'moy') alertes.push(`${nf0.format(res.remplaces)} paris n'avaient pas de cote ${r.cote === 'b365' ? 'Bet365' : 'maximum'} dans les données : la cote moyenne du marché est utilisée à la place.`);
    $('r-alerte').replaceChildren(...alertes.map((a) => el('div', { class: 'alerte' }, el('span', { class: 'icone', 'aria-hidden': 'true', text: '!' }), el('span', { text: a }))));

    courbe($('g-capital'), res.points, r.capital);

    const niveaux = parNiveau(r);
    colonnes($('g-niveaux'), niveaux);
    tableau($('t-niveaux'),
      [{ t: 'Chances du favori' }, { t: 'Matchs', n: 1 }, { t: 'Cote moyenne', n: 1 }, { t: 'Les cotes promettaient', n: 1 }, { t: 'Réellement gagnés', n: 1 }, { t: 'Rendement', n: 1 }],
      niveaux.filter((x) => x.n).map((x) => [x.label, nf0.format(x.n), cote(x.coteMoy), pct(x.promis), pct(x.reel), montant(x.v, (v) => pct(v, 2))]));

    const sports = new Map();
    for (const p of res.paris) {
      const k = p.m[1];
      if (!sports.has(k)) sports.set(k, { n: 0, g: 0, promis: 0, mises: 0, profit: 0 });
      const st = sports.get(k);
      st.n++; st.promis += p.m[5]; st.mises += p.mise; st.profit += p.gain;
      if (p.m[9]) st.g++;
    }
    tableau($('t-sports'),
      [{ t: 'Sport' }, { t: 'Paris', n: 1 }, { t: 'Réussite', n: 1 }, { t: 'Promis', n: 1 }, { t: 'Gain', n: 1 }],
      [...sports.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, st]) =>
        [H.sports[k], nf0.format(st.n), pct(st.g / st.n), pct(st.promis / st.n), montant(st.profit, euros)]),
      'Aucun pari avec ces réglages.');

    const surprises = res.paris.filter((p) => !p.m[9]).sort((a, b) => b.m[5] - a.m[5]).slice(0, 25);
    tableau($('t-surprises'),
      [{ t: 'Date' }, { t: 'Favori battu' }, { t: 'Cote', n: 1 }, { t: 'Chances', n: 1 }],
      surprises.map((p) => [
        dateCourte(depuisEntier(p.m[0])),
        el('span', null, el('span', { class: 'fav', text: p.m[3] }), ' contre ', p.m[4], el('br'), el('span', { class: 'small muted', text: `${H.sports[p.m[1]]} · ${H.competitions[p.m[2]]}` })),
        cote(p.c), pct(p.m[5])]),
      'Aucun favori battu avec ces réglages.');

    tableau($('t-paris'),
      [{ t: 'Date' }, { t: 'Sport' }, { t: 'Pari sur' }, { t: 'Cote', n: 1 }, { t: 'Chances', n: 1 }, { t: 'Mise', n: 1 }, { t: 'Résultat' }, { t: 'Gain', n: 1 }],
      res.paris.slice(-100).reverse().map((p) => [
        dateCourte(depuisEntier(p.m[0])),
        el('span', null, H.sports[p.m[1]], el('br'), el('span', { class: 'small muted', text: H.competitions[p.m[2]] })),
        el('span', null, el('span', { class: 'fav', text: p.m[3] }), ' contre ', p.m[4]),
        cote(p.c), pct(p.m[5]), eurosC(p.mise), statut(p.m[9] ? 'gagne' : 'perdu'), montant(p.gain)]),
      'Aucun pari avec ces réglages.');
  }

  function initPasse() {
    if (!H || !H.matchs || !H.matchs.length) {
      $('passe-absent').hidden = false;
      $('passe-contenu').hidden = true;
      return;
    }
    const a0 = Math.floor(H.matchs[0][0] / 10000), a1 = Math.floor(H.matchs[H.matchs.length - 1][0] / 10000);
    for (const id of ['f-debut', 'f-fin']) {
      for (let a = a0; a <= a1; a++) $(id).append(el('option', { value: a, text: a }));
    }
    $('f-debut').value = a0;
    $('f-fin').value = a1;
    const compte = H.sports.map(() => 0);
    for (const m of H.matchs) compte[m[1]]++;
    H.sports.forEach((nom, i) => {
      $('f-sports').append(el('label', { class: 'puce' }, el('input', { type: 'checkbox', value: i, checked: true }), `${nom} (${nf0.format(compte[i])})`));
    });

    const ok = H.sources.filter((x) => !x.erreur);
    $('sources-resume').textContent =
      `${nf0.format(H.matchs_analyses)} vrais matchs analysés dans ${H.sports.length} disciplines, dont ${nf0.format(H.matchs.length)} ` +
      `avec un favori à ${pct(H.seuil_inclusion, 0)} ou plus. ${ok.length} fichiers téléchargés le ${dateCourte(new Date(H.genere_le))} ` +
      'depuis tennis-data.co.uk, football-data.co.uk et aussportsbetting.com (cotes d\'avant-match et résultats officiels).';
    tableau($('t-sources'), [{ t: 'Fichier' }, { t: 'Matchs', n: 1 }, { t: 'Gardés', n: 1 }, { t: 'État' }],
      [...H.sources].sort((a, b) => (!!a.erreur - !!b.erreur)).map((x) => [x.nom, nf0.format(x.matchs_analyses), nf0.format(x.matchs_gardes), x.erreur ? 'Non disponible' : 'OK']));

    let attente = 0;
    const planifier = () => { cancelAnimationFrame(attente); attente = requestAnimationFrame(dessinerPasse); };
    $('filtres').addEventListener('input', planifier);
    $('filtres').addEventListener('change', planifier);
    dessins.passe = dessinerPasse;
  }

  // ------------------------------------------------------------ EN DIRECT
  function dessinerDirect() {
    const paris = J.paris || [];
    const regles = paris.filter((p) => p.statut !== 'en_cours');
    const enCours = paris.filter((p) => p.statut === 'en_cours');
    const gagnes = regles.filter((p) => p.statut === 'gagne').length;
    const perdus = regles.filter((p) => p.statut === 'perdu').length;
    const profit = regles.reduce((a, p) => a + (p.gain || 0), 0);
    const misesReglees = regles.filter((p) => p.statut !== 'annule').reduce((a, p) => a + p.mise, 0);
    const capital = J.capital_depart + profit;
    const avecIa = regles.filter((p) => p.proba_ia != null && p.statut !== 'annule');

    $('d-capital').textContent = euros(capital);
    const delta = $('d-delta');
    delta.textContent = regles.length ? `${signe(profit, eurosC)} (${pctSigne(profit / J.capital_depart, 2)})` : 'Aucun pari réglé pour l\'instant';
    delta.className = 'delta ' + (profit > 0 ? 'up' : profit < 0 ? 'down' : '');
    $('d-phrase').textContent = `Départ avec ${euros(J.capital_depart)} fictifs. Dernier passage du robot : ${J.maj ? dateHeure(J.maj) : '–'}.`;

    $('d-tuiles').replaceChildren(
      tuile('Paris placés', nf0.format(paris.length), `${enCours.length} en cours · ${eurosC(enCours.reduce((a, p) => a + p.mise, 0))} misés`),
      tuile('Réussite', gagnes + perdus ? pct(gagnes / (gagnes + perdus)) : '–', `${gagnes} gagnés · ${perdus} perdus`),
      tuile('Rendement par euro misé', misesReglees ? pctSigne(profit / misesReglees, 2) : '–', misesReglees ? `${eurosC(misesReglees)} misés et réglés` : null),
      tuile('Claude estimait', avecIa.length ? pct(avecIa.reduce((a, p) => a + p.proba_ia, 0) / avecIa.length) : '–', 'de réussite en moyenne'),
      tuile('Matchs écartés par l\'IA', nf0.format((J.refus || []).length), 'malgré des cotes à 97 %'),
      tuile('Crédits The Odds API', J.credits_odds_api == null ? '–' : nf0.format(J.credits_odds_api), 'restants ce mois-ci'),
    );

    const tries = [...regles].sort((a, b) => (a.regle_le || '').localeCompare(b.regle_le || ''));
    const pts = [];
    let c = J.capital_depart;
    if (tries.length) pts.push({ x: new Date(tries[0].regle_le).getTime() - 36e5, y: c });
    for (const p of tries) { c += p.gain || 0; pts.push({ x: new Date(p.regle_le).getTime(), y: c, n: 1, g: p.gain || 0 }); }
    courbe($('g-direct'), pts, J.capital_depart, 'pari');

    const ordre = [...enCours.sort((a, b) => a.debut.localeCompare(b.debut)), ...regles.sort((a, b) => b.debut.localeCompare(a.debut))];
    tableau($('t-direct'),
      [{ t: 'Match' }, { t: 'Sport' }, { t: 'Pari sur' }, { t: 'Cote', n: 1 }, { t: 'Marché', n: 1 }, { t: 'Claude', n: 1 }, { t: 'Mise', n: 1 }, { t: 'Statut' }, { t: 'Gain', n: 1 }, { t: 'Pourquoi' }],
      ordre.map((p) => [
        dateHeure(p.debut),
        el('span', null, p.sport, el('br'), el('span', { class: 'small muted', text: p.competition })),
        el('span', null, el('span', { class: 'fav', text: p.favori }), ' contre ', p.adversaire, p.score ? el('div', { class: 'small muted', text: `Score : ${p.score}` }) : null),
        cote(p.cote), pct(p.proba_marche), p.proba_ia == null ? '–' : pct(p.proba_ia), eurosC(p.mise), statut(p.statut), montant(p.gain),
        el('div', { class: 'raison' }, p.raison_ia || '', p.note_reglement ? el('div', { class: 'small muted', text: p.note_reglement }) : null)]),
      'Aucun pari pour l\'instant : aucun favori à 97 % dans les matchs scannés.');

    // Le flair de Claude : les favoris qu'il a écartés ont-ils perdu plus souvent que prévu ?
    const ecartes = (J.refus || []).filter((r) => r.motif_refus !== 'capital');
    const verifies = ecartes.filter((r) => r.statut === 'gagne' || r.statut === 'perdu');
    const battus = verifies.filter((r) => r.statut === 'perdu').length;
    const prevu = verifies.length ? verifies.reduce((a, r) => a + (1 - r.proba_marche), 0) / verifies.length : 0;
    const tauxBattus = verifies.length ? battus / verifies.length : 0;
    const tauxParis = gagnes + perdus ? perdus / (gagnes + perdus) : 0;
    const economie = verifies.reduce((a, r) => a + (r.statut === 'perdu' ? 100 : -(r.cote - 1) * 100), 0);
    $('d-flair').replaceChildren(
      tuile('Matchs écartés vérifiés', nf0.format(verifies.length), `${ecartes.filter((r) => r.statut === 'en_attente').length} en attente du résultat`),
      tuile('Favori battu', verifies.length ? `${battus} (${pct(tauxBattus)})` : '–', verifies.length ? `les cotes en prévoyaient ${pct(prevu)}` : null),
      tuile('Avec 100 € sur chacun', verifies.length ? signe(-economie, eurosC) : '–', verifies.length ? (economie >= 0 ? 'perte évitée grâce à Claude' : 'gain manqué à cause de Claude') : null),
    );
    $('d-verdict').textContent = !verifies.length ? ''
      : verifies.length < 30
        ? `Seulement ${verifies.length} match${verifies.length > 1 ? 's' : ''} écarté${verifies.length > 1 ? 's' : ''} vérifié${verifies.length > 1 ? 's' : ''} : trop tôt pour juger, il en faut au moins 30.`
        : `Le favori a perdu dans ${pct(tauxBattus)} des matchs écartés, contre ${pct(prevu)} prévu par les cotes et ${pct(tauxParis)} pour les paris placés. ` +
          (tauxBattus > prevu * 1.5 && tauxBattus > tauxParis
            ? 'Claude repère vraiment des favoris fragiles que le marché surestime.'
            : 'Pour l\'instant, Claude n\'écarte pas mieux qu\'au hasard : le marché connaissait déjà ces informations.');

    const resultatEcarte = (r) => {
      const t = { perdu: ['gagne', 'Favori battu : bien vu'], gagne: ['annule', 'Le favori a gagné'],
        en_attente: ['en_cours', 'En attente'], annule: ['annule', 'Match annulé'], inconnu: ['annule', 'Résultat introuvable'] }[r.statut];
      return t ? el('span', null, el('span', { class: 'statut ' + t[0], text: t[1] }), r.score ? el('div', { class: 'small muted', text: `Score : ${r.score}` }) : null) : '–';
    };
    tableau($('t-refus'),
      [{ t: 'Match' }, { t: 'Sport' }, { t: 'Favori' }, { t: 'Cote', n: 1 }, { t: 'Marché', n: 1 }, { t: 'Claude', n: 1 }, { t: 'Résultat' }, { t: 'Raison' }],
      (J.refus || []).slice(0, 100).map((p) => [
        dateHeure(p.debut),
        el('span', null, p.sport, el('br'), el('span', { class: 'small muted', text: p.competition })),
        el('span', null, el('span', { class: 'fav', text: p.favori }), ' contre ', p.adversaire),
        cote(p.cote), pct(p.proba_marche), p.proba_ia == null ? '–' : pct(p.proba_ia), resultatEcarte(p),
        el('div', { class: 'raison', text: p.raison_ia || '' })]),
      'Claude n\'a encore écarté aucun match.');

    tableau($('t-executions'),
      [{ t: 'Passage' }, { t: 'Compétitions scannées', n: 1 }, { t: 'Favoris trouvés', n: 1 }, { t: 'Paris placés', n: 1 }, { t: 'Paris réglés', n: 1 }, { t: 'Écartés vérifiés', n: 1 }, { t: 'Crédits restants', n: 1 }, { t: 'Capital', n: 1 }],
      (J.executions || []).slice(0, 30).map((x) => [dateHeure(x.date), `${x.competitions_scannees} / ${x.competitions_ouvertes}`,
        nf0.format(x.candidats), nf0.format(x.paris_places), nf0.format(x.paris_regles), nf0.format(x.ecartes_verifies || 0), x.credits_restants == null ? '–' : nf0.format(x.credits_restants), eurosC(x.capital)]));
  }

  function initDirect() {
    const actif = J && (J.executions || []).length;
    $('direct-config').hidden = !!actif;
    $('direct-contenu').hidden = !actif;
    if (actif) dessins.direct = dessinerDirect;
  }

  // ------------------------------------------------------------ démarrage
  initPasse();
  initDirect();
  let memo = null;
  try { memo = localStorage.getItem('simulateur-onglet'); } catch (e) { /* stockage indisponible */ }
  const depart = $(memo) || (!H && J && (J.executions || []).length ? $('onglet-direct') : $('onglet-passe'));
  ouvrir(depart, false);

  let largeur = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === largeur) return;
    largeur = window.innerWidth;
    const visible = onglets.find((o) => o.getAttribute('aria-selected') === 'true');
    clearTimeout(window.__redim);
    window.__redim = setTimeout(() => ouvrir(visible, false), 150);
  });
})();
