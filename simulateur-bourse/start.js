// Lanceur « une commande » : vérifie Node.js, installe les dépendances au premier lancement,
// démarre le serveur et ouvre le navigateur.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const [major, minor] = process.versions.node.split('.').map(Number);

if (major < 22) {
  console.error(`\n❌  Node.js ${process.versions.node} est trop ancien : installe Node.js 22 ou plus récent (version « LTS » sur https://nodejs.org).\n`);
  process.exit(1);
}
if (major === 22 && minor < 4) {
  console.warn('⚠️  Node.js 22.4 ou plus récent est conseillé pour le flux temps réel Finnhub (WebSocket).');
}

const needed = ['yahoo-finance2', 'lightweight-charts'];
const missing = needed.filter((d) => !fs.existsSync(path.join(ROOT, 'node_modules', d, 'package.json')));
if (missing.length) {
  console.log('📦  Premier lancement : installation des dépendances (une minute environ)…');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const r = spawnSync(npm, ['install', '--no-audit', '--no-fund'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    console.error('\n❌  L’installation a échoué. Vérifie ta connexion Internet puis relance « npm start ».\n');
    process.exit(1);
  }
}

if (!process.argv.includes('--no-open')) process.env.SIM_OPEN_BROWSER = '1';
await import('./server.js');
