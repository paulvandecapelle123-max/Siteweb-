// Graphiques : cours d'une action et valeur du portefeuille (lightweight-charts de TradingView),
// camemberts de répartition (SVG maison).

import { createChart, AreaSeries, CandlestickSeries, HistogramSeries, LineSeries, ColorType, CrosshairMode, LineStyle } from '/vendor/lightweight-charts.mjs';
import { brusselsOffsetSec, esc, fmtEur, fmtNum, fmtPct, fmtPrice, priceDigits } from './core.js';

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function alpha(hex, a) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function baseOptions(priceFormatter) {
  return {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: css('--text-2'),
      fontFamily: css('--font') || 'system-ui',
      fontSize: 12,
      attributionLogo: true,
    },
    grid: {
      vertLines: { color: alpha(css('--border').startsWith('#') ? css('--border') : '#2b313c', 0.5) },
      horzLines: { color: alpha(css('--border').startsWith('#') ? css('--border') : '#2b313c', 0.5) },
    },
    rightPriceScale: { borderColor: css('--border') },
    timeScale: { borderColor: css('--border'), timeVisible: true, secondsVisible: false },
    crosshair: { mode: CrosshairMode.Magnet },
    localization: { locale: 'fr-BE', priceFormatter },
    handleScroll: { vertTouchDrag: false },
  };
}

/** Décale les horodatages UTC pour afficher l'heure de Bruxelles sur l'axe du temps. */
function toLocal(sec) {
  return sec + brusselsOffsetSec(sec);
}

const dayFmt = new Intl.DateTimeFormat('fr-BE', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' });
const dayTimeFmt = new Intl.DateTimeFormat('fr-BE', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Graphique de cours d'une action. */
export function createPriceChart(container, legendEl) {
  let currency = 'EUR';
  let intraday = true;
  const chart = createChart(container, {
    ...baseOptions((p) => fmtNum(p, priceDigits(p, currency))),
  });
  let main = null;
  let volume = null;
  let prevLine = null;
  let lastData = [];

  chart.subscribeCrosshairMove((param) => {
    if (!legendEl) return;
    const d = param?.time != null && main ? param.seriesData.get(main) : null;
    const point = d || lastData.at(-1);
    if (!point) {
      legendEl.innerHTML = '';
      return;
    }
    const when = (intraday ? dayTimeFmt : dayFmt).format(new Date(point.time * 1000));
    const val = point.close ?? point.value;
    const ohlc = point.open != null ? ` · O ${fmtNum(point.open, priceDigits(point.open, currency))} H ${fmtNum(point.high, priceDigits(point.high, currency))} B ${fmtNum(point.low, priceDigits(point.low, currency))}` : '';
    legendEl.innerHTML = `<span>${esc(when)}</span> · <strong>${fmtPrice(val, currency)}</strong><span class="hide-sm">${ohlc}</span>`;
  });

  return {
    chart,
    setData(hist, { type = 'area' } = {}) {
      currency = hist.currency || 'EUR';
      intraday = hist.intraday;
      if (main) chart.removeSeries(main);
      if (volume) chart.removeSeries(volume);
      main = null;
      volume = null;
      prevLine = null;
      const candles = hist.candles.map((c) => ({ ...c, time: toLocal(c.time) }));
      const up = css('--up');
      const down = css('--down');
      const first = hist.range === '1d' && hist.prevClose ? hist.prevClose : candles[0]?.close;
      const isUp = candles.length ? candles.at(-1).close >= first : true;
      const color = isUp ? up : down;
      chart.applyOptions({ timeScale: { timeVisible: hist.intraday } });

      if (type === 'candles') {
        main = chart.addSeries(CandlestickSeries, {
          upColor: up,
          downColor: down,
          borderUpColor: up,
          borderDownColor: down,
          wickUpColor: up,
          wickDownColor: down,
        });
        main.setData(candles.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
        lastData = candles;
      } else {
        main = chart.addSeries(AreaSeries, {
          lineColor: color,
          lineWidth: 2,
          topColor: alpha(color, 0.28),
          bottomColor: alpha(color, 0.02),
          priceLineVisible: true,
        });
        const data = candles.map((c) => ({ time: c.time, value: c.close }));
        main.setData(data);
        lastData = data;
      }
      volume = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol', color: alpha(css('--muted') || '#7b8392', 0.35), lastValueVisible: false, priceLineVisible: false });
      volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      volume.setData(candles.map((c) => ({ time: c.time, value: c.volume || 0 })));
      if (hist.range === '1d' && hist.prevClose) {
        prevLine = main.createPriceLine({ price: hist.prevClose, color: css('--muted'), lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: 'Clôture veille' });
      }
      chart.timeScale().fitContent();
      if (legendEl) {
        const last = lastData.at(-1);
        legendEl.innerHTML = last ? `Dernier : <strong>${fmtPrice(last.close ?? last.value, currency)}</strong>` : '';
      }
    },
    /** Met à jour le dernier point avec le prix en direct. */
    updatePrice(price) {
      if (!main || !lastData.length || !(price > 0)) return;
      const last = lastData.at(-1);
      if (last.close != null) {
        const bar = { time: last.time, open: last.open, high: Math.max(last.high, price), low: Math.min(last.low, price), close: price };
        main.update(bar);
        lastData[lastData.length - 1] = { ...last, ...bar };
      } else {
        main.update({ time: last.time, value: price });
        lastData[lastData.length - 1] = { time: last.time, value: price };
      }
    },
    destroy() {
      chart.remove();
    },
  };
}

/** Évolution de la valeur du portefeuille, comparée à l'indice de référence. */
export function createPortfolioChart(container, legendEl) {
  const chart = createChart(container, { ...baseOptions((p) => fmtEur(p, { digits: 0 })) });
  const s1 = css('--series-1');
  const s2 = css('--series-2');
  const pf = chart.addSeries(LineSeries, { color: s1, lineWidth: 2, title: '', priceLineVisible: false });
  const bm = chart.addSeries(LineSeries, { color: s2, lineWidth: 2, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: true });
  let initial = 0;
  let benchName = '';
  let startLine = null;
  let lastPf = null;
  let lastBm = null;

  const renderLegend = (pv, bv) => {
    if (!legendEl) return;
    const pct = (v) => (initial && v != null ? ` (${fmtPct(((v - initial) / initial) * 100)})` : '');
    legendEl.innerHTML =
      `<span><span class="sw" style="background:${s1}"></span>Mon portefeuille : <strong>${fmtEur(pv)}</strong>${pct(pv)}</span>` +
      (benchName ? `<span><span class="sw" style="background:${s2}"></span>${esc(benchName)} (même mise de départ) : <strong>${fmtEur(bv)}</strong>${pct(bv)}</span>` : '');
  };

  chart.subscribeCrosshairMove((param) => {
    if (param?.time == null) return renderLegend(lastPf, lastBm);
    const a = param.seriesData.get(pf);
    const b = param.seriesData.get(bm);
    renderLegend(a?.value ?? lastPf, b?.value ?? lastBm);
  });

  return {
    setData({ portfolio, benchmark, initialCapital, benchmarkSymbol }) {
      initial = initialCapital;
      benchName = benchmark.length ? benchmarkSymbol : '';
      const dedupe = (arr) => {
        const out = [];
        for (const p of arr) {
          const t = toLocal(p.time);
          if (out.length && t <= out.at(-1).time) out[out.length - 1] = { time: out.at(-1).time, value: p.value };
          else out.push({ time: t, value: p.value });
        }
        return out;
      };
      const pd = dedupe(portfolio);
      const bd = dedupe(benchmark);
      pf.setData(pd);
      bm.setData(bd);
      lastPf = pd.at(-1)?.value ?? null;
      lastBm = bd.at(-1)?.value ?? null;
      if (startLine) pf.removePriceLine(startLine);
      startLine = pf.createPriceLine({ price: initialCapital, color: css('--muted'), lineStyle: LineStyle.Dotted, lineWidth: 1, axisLabelVisible: false, title: 'Départ' });
      chart.timeScale().fitContent();
      renderLegend(lastPf, lastBm);
    },
    destroy() {
      chart.remove();
    },
  };
}

// ---------- Camembert (anneau) SVG ----------

const PALETTE = ['--series-1', '--series-2', '--series-3', '--series-4', '--series-5', '--series-6', '--series-7', '--series-8'];

export function donut(items, { title }) {
  const total = items.reduce((s, x) => s + x.value, 0);
  if (!total) return '<p class="empty">Aucune donnée pour le moment.</p>';
  // Au-delà de 7 catégories (+ liquidités), le reste est regroupé dans « Autres »
  let cats = items.filter((x) => x.label !== 'Liquidités');
  const cash = items.find((x) => x.label === 'Liquidités');
  if (cats.length > 7) {
    const keep = cats.slice(0, 6);
    const rest = cats.slice(6).reduce((s, x) => s + x.value, 0);
    cats = [...keep, { label: 'Autres', value: rest }];
  }
  // Couleur stable par catégorie (ordre alphabétique), jamais selon le rang
  const order = [...cats].map((c) => c.label).sort((a, b) => a.localeCompare(b, 'fr'));
  const colorOf = (label) => (label === 'Autres' ? 'var(--text-2)' : `var(${PALETTE[order.indexOf(label) % PALETTE.length]})`);
  const slices = [...cats.map((c) => ({ ...c, color: colorOf(c.label) })), ...(cash ? [{ ...cash, color: 'var(--surface-3)' }] : [])];

  const R = 80;
  const r = 50;
  const cx = 85;
  const cy = 85;
  let angle = -Math.PI / 2;
  const paths = slices
    .map((s) => {
      const frac = s.value / total;
      const a0 = angle;
      const a1 = angle + frac * Math.PI * 2;
      angle = a1;
      const pct = `${fmtNum(frac * 100, 1)} %`;
      if (frac >= 0.9999) {
        return `<path d="M ${cx} ${cy - R} A ${R} ${R} 0 1 1 ${cx - 0.01} ${cy - R} L ${cx - 0.01} ${cy - r} A ${r} ${r} 0 1 0 ${cx} ${cy - r} Z" style="fill:${s.color}"><title>${esc(s.label)} : ${fmtEur(s.value)} (${pct})</title></path>`;
      }
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (rad, a) => `${cx + rad * Math.cos(a)} ${cy + rad * Math.sin(a)}`;
      return `<path d="M ${p(R, a0)} A ${R} ${R} 0 ${large} 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${large} 0 ${p(r, a0)} Z" style="fill:${s.color}"><title>${esc(s.label)} : ${fmtEur(s.value)} (${pct})</title></path>`;
    })
    .join('');
  const legend = slices
    .map((s) => `<div class="li"><span class="sw" style="background:${s.color}"></span><span>${esc(s.label)}</span><span class="muted">${fmtNum((s.value / total) * 100, 1)} %</span><strong class="right">${fmtEur(s.value, { digits: 0 })}</strong></div>`)
    .join('');
  return `<div class="donut-wrap"><svg class="donut" viewBox="0 0 170 170" role="img" aria-label="${esc(title)}">${paths}</svg><div class="donut-legend">${legend}</div></div>`;
}
