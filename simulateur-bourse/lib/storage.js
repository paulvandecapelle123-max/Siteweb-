// Sauvegarde locale en fichiers JSON (dossier data/), écriture atomique et différée.

import fs from 'node:fs';
import path from 'node:path';

export class JsonStore {
  constructor(file, defaults) {
    this.file = file;
    this.defaults = defaults;
    this.timer = null;
    this.data = this.load();
  }

  load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        // Fichier corrompu : on le met de côté plutôt que de l'écraser silencieusement
        const backup = `${this.file}.corrompu-${Date.now()}`;
        try {
          fs.renameSync(this.file, backup);
          console.warn(`⚠️  ${path.basename(this.file)} illisible, copie conservée dans ${path.basename(backup)}`);
        } catch {
          /* rien */
        }
      }
      return structuredClone(this.defaults);
    }
  }

  /** Écrit immédiatement (fichier temporaire puis renommage : pas de fichier à moitié écrit). */
  saveNow() {
    clearTimeout(this.timer);
    this.timer = null;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }

  /** Écriture regroupée (utile quand beaucoup de petites modifications arrivent d'un coup). */
  save(delay = 400) {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      try {
        this.saveNow();
      } catch (err) {
        console.error('Erreur de sauvegarde :', err.message);
      }
    }, delay);
  }

  flush() {
    if (this.timer) this.saveNow();
  }
}
