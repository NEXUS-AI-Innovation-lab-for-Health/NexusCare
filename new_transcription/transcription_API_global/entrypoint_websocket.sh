#!/bin/bash
set -e

echo "🔍 Vérification des modèles Vosk..."
python setup_vosk_models.py

echo "🌐 Démarrage API WebSocket..."
exec uvicorn api_websocket:app --host 0.0.0.0 --port 8000