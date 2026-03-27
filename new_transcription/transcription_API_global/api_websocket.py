#!/usr/bin/env python3
"""
API WebSocket pour transcription audio en temps réel
"""

import asyncio
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Any
import json
import base64
import tempfile
import os
import requests
from pathlib import Path

from transcription_engines import (
    transcrire_whisper,
    transcrire_groq,
)
from audio_processing import analyser_audio, reduire_bruit


app = FastAPI(
    title="API WebSocket Transcription",
    description="Transcription en temps réel via WebSocket",
    version="3.0.0"
)

# CORS — autorise le frontend (port 5173) à appeler l'API (port 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Executor partagé — les fonctions de transcription sont bloquantes (CPU/IO).
# run_in_executor les exécute dans un thread séparé sans bloquer FastAPI.
_executor = ThreadPoolExecutor(max_workers=2)

@app.on_event("startup")
async def preload_models():
    from transcription_engines import _get_whisper_model
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(_executor, lambda: _get_whisper_model("cpu_rapide"))
    print("✅ Whisper base prêt")

# ── Page HTML de test ──────────────────────────────────────────────────────────
HTML_PAGE = """
<!DOCTYPE html>
<html>
<head>
    <title>Transcription WebSocket</title>
    <meta charset="utf-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 1000px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; margin-bottom: 20px; }
        .config { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0; }
        label { display: block; margin: 10px 0 5px; font-weight: bold; }
        select, input[type="number"] { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #4CAF50; color: white; padding: 10px 25px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
        button:hover { background: #45a049; }
        button:disabled { background: #ccc; cursor: not-allowed; }
        #status { padding: 15px; margin: 15px 0; border-radius: 5px; text-align: center; font-weight: bold; }
        .status-connecting  { background: #fff3cd; color: #856404; }
        .status-connected   { background: #d4edda; color: #155724; }
        .status-disconnected{ background: #f8d7da; color: #721c24; }
        .status-processing  { background: #d1ecf1; color: #0c5460; }
        #result { background: #f9f9f9; padding: 20px; border-radius: 5px; min-height: 200px; max-height: 500px; overflow-y: auto; white-space: pre-wrap; font-family: monospace; margin-top: 15px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Transcription WebSocket v3</h1>

        <div class="config">
            <label>Moteur:</label>
            <select id="engine">
                <option value="whisper">Whisper (local)</option>
                <option value="groq">Groq (cloud, Whisper-large-v3)</option>
            </select>

            <label>Config Whisper:</label>
            <select id="config_whisper">
                <option value="cpu_rapide">CPU Rapide</option>
                <option value="cpu_qualite">CPU Qualite</option>
                <option value="gpu_equilibre">GPU Equilibre</option>
            </select>

            <label>Nombre de locuteurs:</label>
            <input type="number" id="nb_locuteurs" value="2" min="0" max="10">

            <label>Reduction de bruit:</label>
            <select id="methode_bruit">
                <option value="false">Desactivee</option>
                <option value="noisereduce">NoiseReduce</option>
                <option value="silero">Silero VAD</option>
            </select>

            <label>Environnement:</label>
            <select id="type_environnement">
                <option value="1">Salle silencieuse</option>
                <option value="2" selected>Bureau/Normal</option>
                <option value="3">Environnement bruyant</option>
                <option value="4">Bruit constant</option>
            </select>
        </div>

        <div style="text-align: center;">
            <input type="file" id="fileInput" accept=".wav" style="display: none;">
            <button onclick="document.getElementById('fileInput').click()">Fichier WAV</button>
            <button id="sendBtn" onclick="sendAudio()" disabled>Transcrire</button>
        </div>

        <div id="status" class="status-disconnected">Selectionnez un fichier</div>
        <div id="result">En attente...</div>
    </div>

    <script>
        let ws = null;
        let selectedFile = null;

        document.getElementById('fileInput').addEventListener('change', function(e) {
            selectedFile = e.target.files[0];
            if (selectedFile) {
                document.getElementById('sendBtn').disabled = false;
                document.getElementById('status').textContent = 'Fichier: ' + selectedFile.name;
                document.getElementById('status').className = 'status-connected';
            }
        });

        async function sendAudio() {
            if (!selectedFile) return;

            const arrayBuffer = await selectedFile.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);

            let binary = '';
            const chunkSize = 0x8000;
            for (let i = 0; i < bytes.length; i += chunkSize) {
                binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
            }
            const base64Audio = btoa(binary);

            const config = {
                engine:             document.getElementById('engine').value,
                config_whisper:     document.getElementById('config_whisper').value,
                nb_locuteurs:       parseInt(document.getElementById('nb_locuteurs').value),
                methode_bruit:      document.getElementById('methode_bruit').value,
                type_environnement: document.getElementById('type_environnement').value,
                audio:              base64Audio
            };

            document.getElementById('status').textContent = 'Connexion...';
            document.getElementById('status').className = 'status-connecting';

            ws = new WebSocket('ws://localhost:8000/ws/transcribe');

            ws.onopen = () => {
                document.getElementById('status').textContent = 'Envoi...';
                ws.send(JSON.stringify(config));
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);

                if (data.type === 'status') {
                    document.getElementById('status').textContent = data.message;
                    document.getElementById('status').className = 'status-processing';
                } else if (data.type === 'result') {
                    let output = '='.repeat(70) + '\\n';
                    output += 'TRANSCRIPTION TERMINEE\\n';
                    output += '='.repeat(70) + '\\n\\n';

                    if (data.stats) {
                        output += 'STATISTIQUES\\n';
                        output += 'Mots: ' + data.stats.nombre_mots + '\\n';
                        output += 'Locuteurs: ' + data.stats.nombre_locuteurs + '\\n\\n';
                    }

                    if (data.transcription_avec_locuteurs) {
                        output += 'AVEC LOCUTEURS:\\n' + '='.repeat(70) + '\\n';
                        output += data.transcription_avec_locuteurs + '\\n\\n';
                    }

                    output += 'TRANSCRIPTION BRUTE:\\n' + '='.repeat(70) + '\\n';
                    output += data.transcription_complete;

                    document.getElementById('result').textContent = output;
                    document.getElementById('status').textContent = 'Termine!';
                    document.getElementById('status').className = 'status-connected';
                } else if (data.type === 'error') {
                    document.getElementById('result').textContent = 'Erreur: ' + data.message;
                    document.getElementById('status').textContent = 'Erreur';
                    document.getElementById('status').className = 'status-disconnected';
                }
            };

            ws.onerror = () => {
                document.getElementById('status').textContent = 'Erreur WebSocket';
                document.getElementById('status').className = 'status-disconnected';
            };
        }
    </script>
</body>
</html>
"""


@app.get("/")
async def get():
    return HTMLResponse(content=HTML_PAGE)


# ── Extraction formulaire via Ollama ──────────────────────────────────────────

class ExtractRequest(BaseModel):
    transcript: str
    fields: list[dict[str, Any]]

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "mistral")

@app.post("/extract")
async def extract_form(req: ExtractRequest):
    """
    Remplit les champs d'un formulaire à partir d'une transcription en utilisant Ollama.
    Requiert qu'Ollama soit lancé (ollama serve) avec un modèle installé (ex: mistral).
    Variable d'env OLLAMA_URL pour pointer vers un Ollama distant/Docker.
    """
    field_descriptions = "\n".join(
        f"- {f['name']} ({f.get('semantic_hint', f.get('label', f['name']))})"
        for f in req.fields
    )

    prompt = (
        "Tu es un assistant médical. À partir de la transcription suivante, "
        "extrais les informations demandées et retourne UNIQUEMENT un objet JSON valide, "
        "sans texte supplémentaire, sans markdown, sans explication.\n\n"
        f"Champs à extraire :\n{field_descriptions}\n\n"
        f"Transcription :\n{req.transcript}\n\n"
        "Réponds avec UNIQUEMENT le JSON, par exemple : "
        '{"nom": "Dupont", "age": "45", ...}\n'
        "Si une information est absente, mets une chaîne vide \"\"."
    )

    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            timeout=60,
        )
        response.raise_for_status()
        raw = response.json().get("response", "")

        # Extraire le JSON de la réponse (Ollama peut ajouter du texte autour)
        start = raw.find("{")
        end   = raw.rfind("}") + 1
        if start == -1 or end == 0:
            return {"success": False, "data": {}, "error": "Pas de JSON dans la réponse Ollama"}

        data = json.loads(raw[start:end])
        # Normaliser toutes les valeurs en str
        data = {k: str(v) if v is not None else "" for k, v in data.items()}
        return {"success": True, "data": data}

    except requests.exceptions.ConnectionError:
        return {
            "success": False,
            "data": {},
            "error": f"Impossible de joindre Ollama sur {OLLAMA_URL}. Lancez : ollama serve"
        }
    except Exception as e:
        return {"success": False, "data": {}, "error": str(e)}


@app.websocket("/ws/transcribe")
async def websocket_transcribe(websocket: WebSocket):
    await websocket.accept()
    loop = asyncio.get_event_loop()

    try:
        # Recevoir config + audio encodé base64
        data   = await websocket.receive_text()
        config = json.loads(data)

        await websocket.send_json({"type": "status", "message": "Chargement audio..."})
        audio_bytes = base64.b64decode(config['audio'])

        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = Path(tmp.name)

        try:
            await websocket.send_json({"type": "status", "message": "Transcription en cours..."})

            engine         = config.get('engine', 'whisper')
            initial_prompt = config.get('initial_prompt', '')

            # ── Dispatch moteur ───────────────────────────────────────────────
            # Toutes les fonctions de transcription sont bloquantes (CPU/IO-bound).
            # run_in_executor les exécute dans un thread pour ne pas bloquer
            # la boucle d'événements asyncio de FastAPI.

            if engine == 'groq':
                resultats = await loop.run_in_executor(
                    _executor,
                    lambda: transcrire_groq(
                        tmp_path,
                        nb_locuteurs=config.get('nb_locuteurs', 0),
                        initial_prompt=initial_prompt
                    )
                )

            else:  # whisper (défaut)
                resultats = await loop.run_in_executor(
                    _executor,
                    lambda: transcrire_whisper(
                        tmp_path,
                        config=config.get('config_whisper', 'cpu_rapide'),
                        nb_locuteurs=config.get('nb_locuteurs', 2),
                        reduction_bruit=config.get('methode_bruit', 'false') != 'false',
                        type_environnement=config.get('type_environnement', '2'),
                        methode_bruit=config.get('methode_bruit', 'noisereduce'),
                        initial_prompt=initial_prompt
                    )
                )

            await websocket.send_json({
                "type":                         "result",
                "transcription_complete":       resultats['texte_brut'],
                "transcription_avec_locuteurs": resultats.get('texte_diarise', ''),
                "stats": {
                    "nombre_mots":      resultats.get('nb_mots', 0),
                    "nombre_locuteurs": resultats.get('nb_locuteurs', 0)
                }
            })

        finally:
            if tmp_path.exists():
                tmp_path.unlink()

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn
    print("Demarrage de l'API WebSocket v3...")
    print("http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
