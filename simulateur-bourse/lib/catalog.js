// Catalogue local : indices du bandeau, ETF qui les suivent, actions connues par bourse.
// Il sert à parcourir une bourse sans rien taper, et de secours si la recherche Yahoo échoue.

export const INDICES = [
  { symbol: '^IXIC', name: 'Nasdaq', exchangeId: 'US', etf: 'nasdaq' },
  { symbol: '^DJI', name: 'Dow Jones', exchangeId: 'US', etf: 'dow' },
  { symbol: '^GSPC', name: 'S&P 500', exchangeId: 'US', etf: 'sp500' },
  { symbol: '^BFX', name: 'BEL 20', exchangeId: 'BR', etf: 'bel20' },
  { symbol: '^FCHI', name: 'CAC 40', exchangeId: 'PA', etf: 'cac40' },
  { symbol: '^GDAXI', name: 'DAX', exchangeId: 'DE', etf: 'dax' },
  { symbol: '^FTSE', name: 'FTSE 100', exchangeId: 'L', etf: 'ftse' },
  { symbol: '^N225', name: 'Nikkei 225', exchangeId: 'T', etf: 'nikkei' },
];

export const INDEX_ETFS = {
  nasdaq: {
    title: 'Nasdaq',
    note: "Les ETF « Nasdaq » suivent en pratique le Nasdaq-100 : les 100 plus grandes sociétés non financières cotées au Nasdaq.",
    etfs: [
      { symbol: 'EQQQ.DE', name: 'Invesco EQQQ Nasdaq-100 UCITS ETF' },
      { symbol: 'SXRV.DE', name: 'iShares Nasdaq 100 UCITS ETF (Acc)' },
      { symbol: 'ANX.PA', name: 'Amundi Nasdaq-100 UCITS ETF' },
      { symbol: 'QQQ', name: 'Invesco QQQ Trust (américain)' },
    ],
  },
  dow: {
    title: 'Dow Jones',
    note: 'Le Dow Jones regroupe 30 grandes sociétés américaines, pondérées par leur prix.',
    etfs: [
      { symbol: 'EXI3.DE', name: 'iShares Dow Jones Industrial Average UCITS ETF (DE)' },
      { symbol: 'DIA', name: 'SPDR Dow Jones Industrial Average ETF (américain)' },
    ],
  },
  sp500: {
    title: 'S&P 500',
    note: 'Le S&P 500 regroupe les 500 plus grandes entreprises américaines.',
    etfs: [
      { symbol: 'SXR8.DE', name: 'iShares Core S&P 500 UCITS ETF (Acc)' },
      { symbol: 'VUSA.AS', name: 'Vanguard S&P 500 UCITS ETF (Dist)' },
      { symbol: '500.PA', name: 'Amundi S&P 500 UCITS ETF' },
      { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust (américain)' },
      { symbol: 'VOO', name: 'Vanguard S&P 500 ETF (américain)' },
    ],
  },
  bel20: {
    title: 'BEL 20',
    note: "Il n'existe plus d'ETF liquide qui réplique le BEL 20. Pour t'exposer à la Bourse de Bruxelles, tu peux acheter directement ses grandes valeurs :",
    etfs: [
      { symbol: 'ABI.BR', name: 'AB InBev' },
      { symbol: 'UCB.BR', name: 'UCB' },
      { symbol: 'ARGX.BR', name: 'argenx' },
      { symbol: 'KBC.BR', name: 'KBC Group' },
      { symbol: 'AGS.BR', name: 'Ageas' },
      { symbol: 'GBLB.BR', name: 'GBL' },
      { symbol: 'ELI.BR', name: 'Elia Group' },
      { symbol: 'UMI.BR', name: 'Umicore' },
    ],
  },
  cac40: {
    title: 'CAC 40',
    note: 'Le CAC 40 regroupe 40 grandes sociétés cotées à Paris.',
    etfs: [{ symbol: 'CAC.PA', name: 'Amundi CAC 40 UCITS ETF (Dist)' }],
  },
  dax: {
    title: 'DAX',
    note: 'Le DAX regroupe les 40 plus grandes sociétés allemandes (dividendes réinvestis dans l’indice).',
    etfs: [
      { symbol: 'EXS1.DE', name: 'iShares Core DAX UCITS ETF (DE)' },
      { symbol: 'DBXD.DE', name: 'Xtrackers DAX UCITS ETF 1C' },
    ],
  },
  ftse: {
    title: 'FTSE 100',
    note: 'Le FTSE 100 regroupe les 100 plus grandes sociétés cotées à Londres (cotation en livres sterling).',
    etfs: [
      { symbol: 'ISF.L', name: 'iShares Core FTSE 100 UCITS ETF (Dist)' },
      { symbol: 'VUKE.L', name: 'Vanguard FTSE 100 UCITS ETF (Dist)' },
    ],
  },
  nikkei: {
    title: 'Nikkei 225',
    note: 'Le Nikkei 225 regroupe 225 grandes sociétés japonaises.',
    etfs: [
      { symbol: 'XDJP.DE', name: 'Xtrackers Nikkei 225 UCITS ETF' },
      { symbol: '1321.T', name: 'NEXT FUNDS Nikkei 225 ETF (Tokyo)' },
      { symbol: 'EWJ', name: 'iShares MSCI Japan ETF (américain, indice proche)' },
    ],
  },
  world: {
    title: 'MSCI World',
    note: 'Le MSCI World regroupe environ 1 400 grandes sociétés de 23 pays développés.',
    etfs: [
      { symbol: 'IWDA.AS', name: 'iShares Core MSCI World UCITS ETF (Acc)' },
      { symbol: 'EUNL.DE', name: 'iShares Core MSCI World UCITS ETF (Acc) – Xetra' },
      { symbol: 'URTH', name: 'iShares MSCI World ETF (américain)' },
    ],
  },
};

// Secteurs en français (Yahoo renvoie les secteurs en anglais)
export const SECTORS_FR = {
  Technology: 'Technologie',
  'Financial Services': 'Services financiers',
  Healthcare: 'Santé',
  'Consumer Cyclical': 'Consommation cyclique',
  'Consumer Defensive': 'Consommation de base',
  Industrials: 'Industrie',
  Energy: 'Énergie',
  Utilities: 'Services aux collectivités',
  'Real Estate': 'Immobilier',
  'Basic Materials': 'Matériaux',
  'Communication Services': 'Communication',
};

export function sectorFr(s) {
  if (!s) return null;
  return SECTORS_FR[s] || s;
}

const T = 'Technologie';
const F = 'Services financiers';
const H = 'Santé';
const CC = 'Consommation cyclique';
const CD = 'Consommation de base';
const I = 'Industrie';
const E = 'Énergie';
const U = 'Services aux collectivités';
const R = 'Immobilier';
const M = 'Matériaux';
const C = 'Communication';
const ETF = 'ETF (diversifié)';

// [ticker, nom, secteur]
const RAW = {
  US: [
    ['AAPL', 'Apple', T], ['MSFT', 'Microsoft', T], ['NVDA', 'NVIDIA', T], ['AMZN', 'Amazon', CC],
    ['GOOGL', 'Alphabet (Google)', C], ['META', 'Meta Platforms (Facebook)', C], ['TSLA', 'Tesla', CC],
    ['AVGO', 'Broadcom', T], ['BRK-B', 'Berkshire Hathaway', F], ['JPM', 'JPMorgan Chase', F],
    ['V', 'Visa', F], ['MA', 'Mastercard', F], ['JNJ', 'Johnson & Johnson', H], ['WMT', 'Walmart', CD],
    ['PG', 'Procter & Gamble', CD], ['XOM', 'ExxonMobil', E], ['KO', 'Coca-Cola', CD], ['PEP', 'PepsiCo', CD],
    ['DIS', 'Walt Disney', C], ['NFLX', 'Netflix', C], ['AMD', 'AMD', T], ['INTC', 'Intel', T],
    ['NKE', 'Nike', CC], ['MCD', "McDonald's", CC], ['BA', 'Boeing', I], ['IBM', 'IBM', T],
    ['ORCL', 'Oracle', T], ['CRM', 'Salesforce', T], ['ADBE', 'Adobe', T], ['COST', 'Costco', CD],
    ['PFE', 'Pfizer', H], ['LLY', 'Eli Lilly', H], ['UBER', 'Uber', T], ['PLTR', 'Palantir', T],
    ['SPY', 'SPDR S&P 500 ETF', ETF], ['QQQ', 'Invesco QQQ (Nasdaq-100)', ETF],
  ],
  BR: [
    ['ABI.BR', 'AB InBev', CD], ['UCB.BR', 'UCB', H], ['ARGX.BR', 'argenx', H], ['KBC.BR', 'KBC Group', F],
    ['AGS.BR', 'Ageas', F], ['GBLB.BR', 'GBL (Groupe Bruxelles Lambert)', F], ['SOF.BR', 'Sofina', F],
    ['UMI.BR', 'Umicore', M], ['SOLB.BR', 'Solvay', M], ['SYENS.BR', 'Syensqo', M], ['ELI.BR', 'Elia Group', U],
    ['ACKB.BR', 'Ackermans & van Haaren', I], ['PROX.BR', 'Proximus', C], ['DIE.BR', "D'Ieteren", CC],
    ['COLR.BR', 'Colruyt', CD], ['LOTB.BR', 'Lotus Bakeries', CD], ['AED.BR', 'Aedifica', R],
    ['WDP.BR', 'WDP', R], ['COFB.BR', 'Cofinimmo', R], ['MELE.BR', 'Melexis', T], ['BEKB.BR', 'Bekaert', I],
    ['BAR.BR', 'Barco', T], ['AZE.BR', 'Azelis', M],
  ],
  PA: [
    ['MC.PA', 'LVMH', CC], ['OR.PA', "L'Oréal", CD], ['RMS.PA', 'Hermès', CC], ['TTE.PA', 'TotalEnergies', E],
    ['SAN.PA', 'Sanofi', H], ['AIR.PA', 'Airbus', I], ['SU.PA', 'Schneider Electric', I], ['AI.PA', 'Air Liquide', M],
    ['BNP.PA', 'BNP Paribas', F], ['GLE.PA', 'Société Générale', F], ['ACA.PA', 'Crédit Agricole', F],
    ['KER.PA', 'Kering', CC], ['CS.PA', 'AXA', F], ['DG.PA', 'Vinci', I], ['SAF.PA', 'Safran', I],
    ['EL.PA', 'EssilorLuxottica', H], ['BN.PA', 'Danone', CD], ['RI.PA', 'Pernod Ricard', CD], ['ORA.PA', 'Orange', C],
    ['CAP.PA', 'Capgemini', T], ['RNO.PA', 'Renault', CC], ['STLAP.PA', 'Stellantis', CC], ['ENGI.PA', 'Engie', U],
    ['VIE.PA', 'Veolia', U], ['DSY.PA', 'Dassault Systèmes', T], ['HO.PA', 'Thales', I], ['SGO.PA', 'Saint-Gobain', I],
    ['ML.PA', 'Michelin', CC], ['CA.PA', 'Carrefour', CD], ['PUB.PA', 'Publicis', C], ['CAC.PA', 'Amundi CAC 40 ETF', ETF],
  ],
  AS: [
    ['ASML.AS', 'ASML', T], ['ADYEN.AS', 'Adyen', T], ['INGA.AS', 'ING Groep', F], ['PRX.AS', 'Prosus', C],
    ['HEIA.AS', 'Heineken', CD], ['AD.AS', 'Ahold Delhaize', CD], ['PHIA.AS', 'Philips', H], ['WKL.AS', 'Wolters Kluwer', I],
    ['ASM.AS', 'ASM International', T], ['BESI.AS', 'BE Semiconductor', T], ['KPN.AS', 'KPN', C], ['RAND.AS', 'Randstad', I],
    ['AKZA.AS', 'Akzo Nobel', M], ['MT.AS', 'ArcelorMittal', M], ['ABN.AS', 'ABN AMRO', F], ['NN.AS', 'NN Group', F],
    ['UMG.AS', 'Universal Music Group', C], ['EXO.AS', 'Exor', F], ['GLPG.AS', 'Galapagos', H],
    ['IWDA.AS', 'iShares Core MSCI World ETF', ETF], ['VUSA.AS', 'Vanguard S&P 500 ETF', ETF],
  ],
  DE: [
    ['SAP.DE', 'SAP', T], ['SIE.DE', 'Siemens', I], ['ALV.DE', 'Allianz', F], ['DTE.DE', 'Deutsche Telekom', C],
    ['MBG.DE', 'Mercedes-Benz', CC], ['BMW.DE', 'BMW', CC], ['VOW3.DE', 'Volkswagen (préf.)', CC], ['BAS.DE', 'BASF', M],
    ['BAYN.DE', 'Bayer', H], ['ADS.DE', 'Adidas', CC], ['IFX.DE', 'Infineon', T], ['DBK.DE', 'Deutsche Bank', F],
    ['MUV2.DE', 'Munich Re', F], ['RHM.DE', 'Rheinmetall', I], ['DHL.DE', 'DHL Group', I], ['EOAN.DE', 'E.ON', U],
    ['RWE.DE', 'RWE', U], ['P911.DE', 'Porsche AG', CC], ['HEN3.DE', 'Henkel (préf.)', CD], ['MRK.DE', 'Merck KGaA', H],
    ['ENR.DE', 'Siemens Energy', I], ['CBK.DE', 'Commerzbank', F], ['DB1.DE', 'Deutsche Börse', F], ['VNA.DE', 'Vonovia', R],
    ['ZAL.DE', 'Zalando', CC], ['EXS1.DE', 'iShares Core DAX ETF', ETF], ['SXR8.DE', 'iShares Core S&P 500 ETF', ETF],
  ],
  L: [
    ['SHEL.L', 'Shell', E], ['AZN.L', 'AstraZeneca', H], ['HSBA.L', 'HSBC', F], ['ULVR.L', 'Unilever', CD],
    ['BP.L', 'BP', E], ['GSK.L', 'GSK', H], ['RIO.L', 'Rio Tinto', M], ['BATS.L', 'British American Tobacco', CD],
    ['DGE.L', 'Diageo', CD], ['BARC.L', 'Barclays', F], ['LLOY.L', 'Lloyds Banking Group', F], ['VOD.L', 'Vodafone', C],
    ['RR.L', 'Rolls-Royce', I], ['REL.L', 'RELX', I], ['LSEG.L', 'London Stock Exchange Group', F], ['GLEN.L', 'Glencore', M],
    ['TSCO.L', 'Tesco', CD], ['BA.L', 'BAE Systems', I], ['NG.L', 'National Grid', U], ['AAL.L', 'Anglo American', M],
    ['ISF.L', 'iShares Core FTSE 100 ETF', ETF],
  ],
  MI: [
    ['ENI.MI', 'Eni', E], ['ENEL.MI', 'Enel', U], ['ISP.MI', 'Intesa Sanpaolo', F], ['UCG.MI', 'UniCredit', F],
    ['RACE.MI', 'Ferrari', CC], ['STLAM.MI', 'Stellantis', CC], ['G.MI', 'Generali', F], ['STMMI.MI', 'STMicroelectronics', T],
    ['PRY.MI', 'Prysmian', I], ['LDO.MI', 'Leonardo', I], ['MONC.MI', 'Moncler', CC], ['TIT.MI', 'Telecom Italia', C],
    ['MB.MI', 'Mediobanca', F], ['CPR.MI', 'Campari', CD],
  ],
  MC: [
    ['SAN.MC', 'Banco Santander', F], ['BBVA.MC', 'BBVA', F], ['ITX.MC', 'Inditex (Zara)', CC], ['IBE.MC', 'Iberdrola', U],
    ['TEF.MC', 'Telefónica', C], ['REP.MC', 'Repsol', E], ['CABK.MC', 'CaixaBank', F], ['AMS.MC', 'Amadeus', T],
    ['AENA.MC', 'Aena', I], ['ELE.MC', 'Endesa', U], ['ACS.MC', 'ACS', I], ['GRF.MC', 'Grifols', H], ['IAG.MC', 'IAG (Iberia, British Airways)', I],
  ],
  SW: [
    ['NESN.SW', 'Nestlé', CD], ['NOVN.SW', 'Novartis', H], ['ROG.SW', 'Roche', H], ['UBSG.SW', 'UBS', F],
    ['ZURN.SW', 'Zurich Insurance', F], ['ABBN.SW', 'ABB', I], ['CFR.SW', 'Richemont', CC], ['LOGN.SW', 'Logitech', T],
    ['SIKA.SW', 'Sika', M], ['LONN.SW', 'Lonza', H], ['GIVN.SW', 'Givaudan', M], ['HOLN.SW', 'Holcim', M],
    ['SREN.SW', 'Swiss Re', F], ['ALC.SW', 'Alcon', H], ['UHR.SW', 'Swatch Group', CC], ['SCMN.SW', 'Swisscom', C],
  ],
  LS: [['EDP.LS', 'EDP', U], ['GALP.LS', 'Galp Energia', E], ['JMT.LS', 'Jerónimo Martins', CD]],
  IR: [['RYA.IR', 'Ryanair', I], ['KRZ.IR', 'Kerry Group', CD], ['BIRG.IR', 'Bank of Ireland', F]],
  ST: [['VOLV-B.ST', 'Volvo', I], ['ERIC-B.ST', 'Ericsson', T], ['ATCO-A.ST', 'Atlas Copco', I], ['INVE-B.ST', 'Investor AB', F], ['HM-B.ST', 'H&M', CC]],
  CO: [['NOVO-B.CO', 'Novo Nordisk', H], ['MAERSK-B.CO', 'A.P. Møller-Maersk', I], ['DSV.CO', 'DSV', I], ['CARL-B.CO', 'Carlsberg', CD], ['VWS.CO', 'Vestas Wind Systems', I]],
  HE: [['NOKIA.HE', 'Nokia', T], ['KNEBV.HE', 'Kone', I], ['NESTE.HE', 'Neste', E]],
  OL: [['EQNR.OL', 'Equinor', E], ['DNB.OL', 'DNB Bank', F], ['NHY.OL', 'Norsk Hydro', M], ['TEL.OL', 'Telenor', C]],
  T: [
    ['7203.T', 'Toyota', CC], ['6758.T', 'Sony', T], ['9984.T', 'SoftBank Group', C], ['7974.T', 'Nintendo', C],
    ['6861.T', 'Keyence', T], ['8306.T', 'Mitsubishi UFJ', F], ['9983.T', 'Fast Retailing (Uniqlo)', CC], ['6501.T', 'Hitachi', I],
    ['7267.T', 'Honda', CC], ['8035.T', 'Tokyo Electron', T], ['4063.T', 'Shin-Etsu Chemical', M], ['9432.T', 'NTT', C],
    ['7751.T', 'Canon', T], ['6752.T', 'Panasonic', T], ['1321.T', 'NEXT FUNDS Nikkei 225 ETF', ETF],
  ],
  HK: [
    ['0700.HK', 'Tencent', C], ['9988.HK', 'Alibaba', CC], ['3690.HK', 'Meituan', CC], ['1299.HK', 'AIA Group', F],
    ['0005.HK', 'HSBC (Hong Kong)', F], ['0941.HK', 'China Mobile', C], ['1810.HK', 'Xiaomi', T], ['9618.HK', 'JD.com', CC],
    ['2318.HK', 'Ping An Insurance', F], ['0388.HK', 'Hong Kong Exchanges', F], ['1211.HK', 'BYD', CC], ['9999.HK', 'NetEase', C],
  ],
  TO: [
    ['RY.TO', 'Royal Bank of Canada', F], ['TD.TO', 'Toronto-Dominion Bank', F], ['SHOP.TO', 'Shopify', T], ['ENB.TO', 'Enbridge', E],
    ['CNR.TO', 'Canadian National Railway', I], ['CP.TO', 'Canadian Pacific Kansas City', I], ['BN.TO', 'Brookfield Corporation', F],
    ['BMO.TO', 'Bank of Montreal', F], ['BNS.TO', 'Scotiabank', F], ['CNQ.TO', 'Canadian Natural Resources', E],
    ['SU.TO', 'Suncor Energy', E], ['ATD.TO', 'Alimentation Couche-Tard', CD], ['CSU.TO', 'Constellation Software', T],
    ['TRI.TO', 'Thomson Reuters', I], ['MFC.TO', 'Manulife', F],
  ],
  AX: [['BHP.AX', 'BHP Group', M], ['CBA.AX', 'Commonwealth Bank', F], ['CSL.AX', 'CSL', H], ['WBC.AX', 'Westpac', F], ['NAB.AX', 'National Australia Bank', F]],
  KS: [['005930.KS', 'Samsung Electronics', T], ['000660.KS', 'SK Hynix', T], ['005380.KS', 'Hyundai Motor', CC]],
  TW: [['2330.TW', 'TSMC', T], ['2317.TW', 'Hon Hai (Foxconn)', T]],
  NS: [['RELIANCE.NS', 'Reliance Industries', E], ['TCS.NS', 'Tata Consultancy Services', T], ['INFY.NS', 'Infosys', T], ['HDFCBANK.NS', 'HDFC Bank', F]],
  SS: [['600519.SS', 'Kweichow Moutai', CD], ['601398.SS', 'ICBC', F]],
  SA: [['PETR4.SA', 'Petrobras', E], ['VALE3.SA', 'Vale', M], ['ITUB4.SA', 'Itaú Unibanco', F]],
  SI: [['D05.SI', 'DBS Group', F], ['O39.SI', 'OCBC Bank', F]],
};

export const CATALOG = Object.entries(RAW).flatMap(([exchangeId, rows]) =>
  rows.map(([symbol, name, sector]) => ({
    symbol,
    name,
    sector,
    exchangeId,
    quoteType: sector === ETF ? 'ETF' : 'EQUITY',
  })),
);

export const CATALOG_BY_SYMBOL = Object.fromEntries(CATALOG.map((c) => [c.symbol, c]));

function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Recherche locale (secours) par nom ou ticker. */
export function searchCatalog(q, exchangeIds = null) {
  const nq = normalize(q).trim();
  return CATALOG.filter((c) => {
    if (exchangeIds && !exchangeIds.includes(c.exchangeId)) return false;
    if (!nq) return true;
    return normalize(c.name).includes(nq) || normalize(c.symbol).startsWith(nq);
  });
}
