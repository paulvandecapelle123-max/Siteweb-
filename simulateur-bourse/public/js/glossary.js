// Petites bulles d'aide (icône ?) : définitions simples des termes de la bourse.

import { esc } from './core.js';

export const GLOSSARY = {
  'paper-trading': {
    title: 'Paper trading',
    text: "S'entraîner à la bourse avec de l'argent fictif. Les prix sont réels (ou presque), mais aucun euro n'est réellement dépensé.",
  },
  action: {
    title: 'Action',
    text: "Une petite part d'une entreprise. Si l'entreprise prend de la valeur, ton action aussi (et inversement). Certaines versent une partie de leurs bénéfices : le dividende.",
  },
  ticker: {
    title: 'Ticker (symbole)',
    text: "Le code court qui identifie une action en bourse. Le suffixe indique la bourse : .BR = Bruxelles, .PA = Paris, .AS = Amsterdam, .DE = Francfort (Xetra), .L = Londres, .T = Tokyo, .HK = Hong Kong, .TO = Toronto. Sans suffixe = bourse américaine.",
    ex: 'ABI.BR = AB InBev à Bruxelles ; MC.PA = LVMH à Paris ; 7203.T = Toyota à Tokyo.',
  },
  indice: {
    title: 'Indice boursier',
    text: "Un « panier » d'actions qui résume l'évolution d'un marché (ex. BEL 20 = les 20 grandes valeurs de Bruxelles). On ne peut pas l'acheter directement : on passe par un ETF qui le copie.",
  },
  etf: {
    title: 'ETF (tracker)',
    text: "Un fonds coté en bourse qui copie un indice. En achetant une seule part, tu possèdes un petit bout de toutes les sociétés de l'indice : c'est la façon la plus simple de se diversifier.",
    ex: 'Un ETF MSCI World contient environ 1 400 sociétés de 23 pays.',
  },
  'msci-world': {
    title: 'MSCI World (indice de comparaison)',
    text: "Indice mondial des grandes sociétés des pays développés. Le comparer à ton portefeuille te dit si tes choix font mieux… qu'un simple ETF acheté et oublié.",
  },
  'ordre-marche': {
    title: 'Ordre au marché',
    text: "Tu achètes ou vends tout de suite, au meilleur prix disponible. Simple, mais tu ne maîtrises pas le prix exact. Si la bourse est fermée, l'ordre attend l'ouverture.",
  },
  'ordre-limite': {
    title: 'Ordre limite',
    text: "Tu fixes ton prix. Achat limite : exécuté seulement si le cours descend à ton prix (ou moins). Vente limite : seulement s'il monte à ton prix (ou plus). Sinon, l'ordre reste en attente.",
    ex: "Apple vaut 180 $. Un achat limite à 175 $ ne s'exécute que si le cours baisse jusqu'à 175 $.",
  },
  'stop-loss': {
    title: 'Stop-loss',
    text: "Un filet de sécurité : si le cours descend jusqu'à ce prix, ta position est vendue automatiquement pour limiter la perte. Attention, en cas de chute brutale, la vente peut se faire un peu plus bas.",
    ex: 'Achat à 100 €, stop-loss à 90 € : perte limitée à environ 10 %.',
  },
  'take-profit': {
    title: 'Take-profit',
    text: "L'inverse du stop-loss : si le cours monte jusqu'à ce prix, ta position est vendue automatiquement pour encaisser le gain.",
  },
  spread: {
    title: 'Spread (fourchette)',
    text: "L'écart entre le prix auquel les acheteurs sont prêts à acheter (bid, « offre d'achat ») et celui auquel les vendeurs acceptent de vendre (ask). Tu achètes au prix vendeur et vends au prix acheteur : c'est un coût caché.",
  },
  'plus-value-latente': {
    title: 'Plus-value (ou moins-value) latente',
    text: "Le gain ou la perte « sur papier » de ce que tu possèdes encore. Elle change à chaque mouvement de prix et ne devient réelle qu'à la vente.",
  },
  'plus-value-realisee': {
    title: 'Plus-value (ou moins-value) réalisée',
    text: "Le gain ou la perte définitivement encaissé(e) quand tu vends, frais compris.",
  },
  volatilite: {
    title: 'Volatilité',
    text: "L'ampleur des variations d'un prix. Une action très volatile fait de grands écarts (vers le haut comme vers le bas) : plus de chances de gain rapide, mais plus de risque. Exprimée en % par an.",
    ex: 'Une volatilité de 20 % signifie que, sur un an, des écarts de ±20 % sont courants.',
  },
  'risque-change': {
    title: 'Risque de change',
    text: "Si tu achètes une action en dollars, yens ou livres, ton résultat en euros dépend aussi du taux de change. Une action qui monte de 5 % peut te faire perdre de l'argent si la devise baisse de 7 % face à l'euro.",
  },
  'frais-courtage': {
    title: 'Frais de courtage',
    text: "Ce que prend le courtier (la banque ou l'appli) pour passer ton ordre. Ici : une partie fixe + un pourcentage du montant, un peu plus cher hors d'Europe. Modifiables dans les Réglages.",
  },
  'frais-change': {
    title: 'Frais de change',
    text: "Le courtier convertit tes euros en devise étrangère (et inversement à la vente) en prenant une petite commission, ici un pourcentage du montant.",
  },
  tob: {
    title: 'TOB (taxe sur les opérations de bourse)',
    text: "Taxe belge prélevée à chaque achat et vente : 0,35 % pour les actions (plafonnée), 0,12 % pour la plupart des ETF. Activable dans les Réglages pour une simulation « à la belge ».",
  },
  differe: {
    title: 'Cours différé',
    text: "Beaucoup de bourses (hors États-Unis) imposent un délai de 15 à 20 minutes sur les prix gratuits. Le prix affiché est donc celui d'il y a quelques minutes.",
  },
  direct: {
    title: 'Cours en direct',
    text: 'Le prix est actualisé en temps réel (ou presque) : flux WebSocket Finnhub ou cotation temps réel Yahoo pour les actions américaines.',
  },
  liquidites: {
    title: 'Liquidités',
    text: "L'argent (fictif) disponible pour acheter. Une partie peut être « réservée » par des ordres d'achat en attente.",
  },
  'prix-moyen': {
    title: "Prix moyen d'achat",
    text: "Si tu achètes la même action plusieurs fois à des prix différents, c'est la moyenne pondérée. Le coût de revient en € inclut aussi les frais et le taux de change du jour d'achat.",
  },
  capitalisation: {
    title: 'Capitalisation boursière',
    text: "La valeur totale de l'entreprise en bourse : prix de l'action × nombre d'actions.",
  },
  per: {
    title: 'PER (Price Earnings Ratio)',
    text: "Le prix de l'action divisé par le bénéfice par action. Un PER de 20 signifie qu'on paie 20 années de bénéfices actuels. Plus il est élevé, plus le marché attend de la croissance.",
  },
  dividende: {
    title: 'Rendement du dividende',
    text: "Dividende annuel divisé par le prix de l'action. Note : le simulateur ne verse pas les dividendes.",
  },
  volume: {
    title: 'Volume',
    text: "Le nombre d'actions échangées pendant la séance. Un volume élevé = marché actif, facile d'acheter et de vendre.",
  },
  '52-semaines': {
    title: 'Plus haut / plus bas sur 52 semaines',
    text: "Les prix extrêmes atteints pendant la dernière année : utile pour situer le cours actuel.",
  },
  'cloture-veille': {
    title: 'Clôture de la veille',
    text: 'Le dernier prix de la séance précédente. La variation du jour est calculée par rapport à lui.',
  },
  'variation-jour': {
    title: 'Variation du jour',
    text: 'La différence entre le prix actuel et la clôture de la veille, en % et en valeur.',
  },
  drawdown: {
    title: 'Baisse maximale (drawdown)',
    text: "La plus forte chute de ton portefeuille entre un sommet et le creux qui a suivi. Elle mesure la « douleur » à supporter.",
  },
  'taux-reussite': {
    title: '% de trades gagnants',
    text: "La part de tes ventes qui ont rapporté de l'argent (frais compris). Attention : on peut gagner souvent un peu et perdre rarement beaucoup !",
  },
  trade: {
    title: 'Trade',
    text: "Un ordre exécuté (achat ou vente). Pour le % de gagnants, seules les ventes comptent, car c'est là que le résultat est connu.",
  },
  position: {
    title: 'Position',
    text: "Une action que tu détiens, avec sa quantité. « Ouvrir » une position = acheter, la « solder » = tout revendre.",
  },
  diversification: {
    title: 'Diversification',
    text: "Répartir son argent entre plusieurs sociétés, secteurs et pays pour ne pas dépendre d'une seule. Les camemberts t'aident à voir si tu mets tous tes œufs dans le même panier.",
  },
  'avant-apres-bourse': {
    title: 'Avant-Bourse / Après-Bourse',
    text: "Aux États-Unis, on peut échanger avant l'ouverture et après la clôture, avec peu de volume. Le simulateur n'exécute les ordres que pendant la séance normale.",
  },
  fractions: {
    title: "Fractions d'action",
    text: "Certains courtiers permettent d'acheter 0,5 action. Par réalisme, c'est désactivé par défaut (activable dans les Réglages).",
  },
  pence: {
    title: 'Cotation en pence (GBp)',
    text: "À Londres, la plupart des actions sont cotées en pence (1 £ = 100 p). Le simulateur convertit automatiquement en livres (GBP).",
  },
  'lot-minimum': {
    title: 'Lot minimum',
    text: "À Tokyo et Hong Kong, on achète normalement par lots (souvent 100 actions). Le simulateur l'ignore pour que tu puisses t'entraîner avec 5 000 €.",
  },
  reserve: {
    title: 'Liquidités réservées',
    text: "Montant bloqué pour tes ordres d'achat en attente, afin de ne pas dépenser deux fois le même argent.",
  },
  horaires: {
    title: 'Horaires de bourse',
    text: "Chaque bourse a ses heures d'ouverture (affichées ici en heure de Bruxelles) et ses jours fériés. Tokyo et Hong Kong font une pause à midi.",
  },
};

export function help(key) {
  const g = GLOSSARY[key];
  if (!g) return '';
  return `<button type="button" class="help" data-help="${esc(key)}" aria-label="Aide : ${esc(g.title)}">?</button>`;
}

export function initTooltips() {
  const tip = document.getElementById('tooltip');
  let current = null;

  const show = (btn) => {
    const g = GLOSSARY[btn.dataset.help];
    if (!g) return;
    current = btn;
    tip.innerHTML = `<strong>${esc(g.title)}</strong>${esc(g.text)}${g.ex ? `<span class="ex">Exemple : ${esc(g.ex)}</span>` : ''}`;
    tip.classList.add('show');
    const r = btn.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    let left = Math.min(window.innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2));
    let top = r.bottom + 8;
    if (top + h > window.innerHeight - 8) top = r.top - h - 8;
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(8, top)}px`;
  };
  const hide = () => {
    current = null;
    tip.classList.remove('show');
  };

  document.addEventListener('mouseover', (e) => {
    const btn = e.target.closest?.('[data-help]');
    if (btn && btn !== current) show(btn);
    else if (!btn && current && !('ontouchstart' in window)) hide();
  });
  document.addEventListener('click', (e) => {
    const btn = e.target.closest?.('[data-help]');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      if (current === btn && tip.classList.contains('show')) hide();
      else show(btn);
    } else hide();
  }, true);
  document.addEventListener('focusin', (e) => {
    const btn = e.target.closest?.('[data-help]');
    if (btn) show(btn);
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide();
  });
  window.addEventListener('scroll', hide, { passive: true });
}
