# PathoCollab Integration Package

Ce dossier permet de lancer PathoCollab comme un service Docker externe, sans récupérer le code source.

## Prérequis

- Docker
- Docker Compose v2

## Démarrage

```bash
cp .env.example .env
docker compose pull
docker compose up -d

# Vérifier les APIs
http://localhost:8000/docs
http://localhost:8002/docs
http://localhost:8004/docs

# Vérifier MinIO
http://localhost:9001

# Installation OpenSeadragon
npm install openseadragon
npm install axios