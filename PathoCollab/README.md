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