// node print.cjs  ->  ../synthese-chimie-polymerisation.pdf  (Playwright + Chromium)
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const dir = path.resolve(__dirname, '..');
  const html = path.join(dir, 'synthese-chimie-polymerisation.html');
  const pdf = path.join(dir, 'synthese-chimie-polymerisation.pdf');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: pdf, printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: '<div style="font-size:7.5px;width:100%;text-align:center;color:#8a8f99;font-family:sans-serif">Synthèse chimie 6e · UAA 8 &amp; UAA 9 · page <span class="pageNumber"></span>/<span class="totalPages"></span></div>',
  });
  await browser.close();
  console.log(pdf);
})();
