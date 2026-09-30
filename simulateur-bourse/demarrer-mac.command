#!/bin/bash
# Double-clique sur ce fichier pour lancer le simulateur de bourse (macOS).
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js n'est pas installé. Télécharge la version LTS sur https://nodejs.org puis relance ce fichier."
  read -r -p "Appuie sur Entrée pour fermer…"
  exit 1
fi
npm start
