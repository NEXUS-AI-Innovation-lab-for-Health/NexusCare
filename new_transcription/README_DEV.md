# SpeechCore — Guide développeur

Comment intégrer l'API de transcription dans votre propre projet.

---

## Architecture

```
new_transcription/
├── transcription_API_global/   # Backend Python (FastAPI)
│   ├── api_websocket.py        # Serveur WebSocket (port 8000)
│   ├── transcription_engines.py# Moteurs : Vosk, Whisper, Gladia, Groq
│   ├── audio_processing.py     # Analyse audio + réduction de bruit
│   └── Dockerfile.api_websocket
└── SpeechCore_Demo/            # Frontend React/Vite (demo)
```

Le backend expose deux interfaces :
- `GET /` — interface HTML de test (navigateur direct)
- `WebSocket /ws/transcribe` — transcription par fichier audio encodé en base64
- `POST /extract` — extraction de champs de formulaire depuis une transcription (via Ollama)

---

## Intégration WebSocket

### Protocole

1. Le client ouvre une connexion WebSocket sur `ws://<host>:8000/ws/transcribe`
2. Le client envoie un JSON avec l'audio encodé en base64 et la configuration
3. Le serveur répond avec des messages de statut, puis le résultat final

### Format de la requête

```json
{
  "engine": "whisper",
  "audio": "<base64 du fichier WAV 16 kHz mono>",
  "nb_locuteurs": 2,

  // Paramètres Whisper uniquement :
  "config_whisper": "cpu_rapide",
  "methode_bruit": "false",
  "type_environnement": "2",
  "initial_prompt": "contexte optionnel pour guider la transcription",

  // Paramètres Vosk uniquement :
  "modele_vosk": "grand",
  "methode_bruit": "noisereduce",
  "type_environnement": "2"
}
```

**Valeurs disponibles :**

| Paramètre | Valeurs |
|-----------|---------|
| `engine` | `"whisper"`, `"vosk"`, `"gladia"`, `"groq"` |
| `config_whisper` | `"cpu_rapide"`, `"cpu_qualite"`, `"gpu_equilibre"` |
| `modele_vosk` | `"petit"`, `"grand"` |
| `methode_bruit` | `"false"` (désactivé), `"noisereduce"`, `"silero"` |
| `type_environnement` | `"1"` (silencieux), `"2"` (bureau), `"3"` (bruyant), `"4"` (bruit constant) |
| `nb_locuteurs` | entier — `0` = auto pour Gladia, `1` ou `2` pour les autres |

### Format des réponses

Le serveur envoie plusieurs messages JSON dans l'ordre :

```json
// Messages de statut (pendant le traitement)
{ "type": "status", "message": "Transcription en cours..." }

// Résultat final
{
  "type": "result",
  "transcription_complete": "Bonjour, le patient présente...",
  "transcription_avec_locuteurs": "[Locuteur 0] Bonjour\n[Locuteur 1] ...",
  "stats": {
    "nombre_mots": 42,
    "nombre_locuteurs": 2
  }
}

// En cas d'erreur
{ "type": "error", "message": "description de l'erreur" }
```

---

## Exemple JavaScript (navigateur)

```javascript
async function transcribe(audioBlob, engine = "whisper") {
  // Convertir le Blob en base64
  const arrayBuffer = await audioBlob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  const base64 = btoa(binary);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket("ws://localhost:8000/ws/transcribe");

    ws.onopen = () => ws.send(JSON.stringify({
      engine,
      audio: base64,
      nb_locuteurs: 2,
      config_whisper: "cpu_rapide",
      methode_bruit: "false",
      type_environnement: "2",
    }));

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "result") resolve(data.transcription_complete);
      if (data.type === "error")  reject(new Error(data.message));
    };

    ws.onerror = () => reject(new Error("WebSocket error"));
  });
}

// Utilisation
const text = await transcribe(myWavBlob, "whisper");
console.log(text);
```

> **Format audio requis** : WAV, 16 kHz, mono, PCM 16-bit. Pour capturer le micro dans ce format, utilisez `AudioContext` + `ScriptProcessorNode` (voir `voice-recognition-page.tsx` pour un exemple complet).

---

## Exemple Python (client)

```python
import asyncio, websockets, json, base64

async def transcribe(wav_path: str, engine: str = "whisper") -> str:
    with open(wav_path, "rb") as f:
        audio_b64 = base64.b64encode(f.read()).decode()

    async with websockets.connect("ws://localhost:8000/ws/transcribe") as ws:
        await ws.send(json.dumps({
            "engine": engine,
            "audio": audio_b64,
            "nb_locuteurs": 2,
            "config_whisper": "cpu_rapide",
            "methode_bruit": "false",
            "type_environnement": "2",
        }))

        while True:
            msg = json.loads(await ws.recv())
            if msg["type"] == "result":
                return msg["transcription_complete"]
            if msg["type"] == "error":
                raise RuntimeError(msg["message"])

result = asyncio.run(transcribe("audio.wav"))
print(result)
```

---

## Endpoint POST /extract (remplissage de formulaire)

Envoie une transcription + une définition de champs à Ollama pour extraction automatique.

### Requête

```http
POST http://localhost:8000/extract
Content-Type: application/json

{
  "transcript": "Le patient s'appelle Jean Dupont, il a 45 ans...",
  "fields": [
    { "name": "nom",      "label": "Nom",    "semantic_hint": "Nom de famille du patient" },
    { "name": "prenom",   "label": "Prénom", "semantic_hint": "Prénom du patient" },
    { "name": "age",      "label": "Âge",    "semantic_hint": "Âge en années" },
    { "name": "symptomes","label": "Symptômes" }
  ]
}
```

### Réponse

```json
{
  "success": true,
  "data": {
    "nom": "Dupont",
    "prenom": "Jean",
    "age": "45",
    "symptomes": "douleur thoracique"
  }
}
```

> **Prérequis** : Ollama doit être lancé (`ollama serve`) avec un modèle installé.
> Le modèle et l'URL Ollama sont configurables via les variables d'environnement `OLLAMA_MODEL` (défaut : `mistral`) et `OLLAMA_URL` (défaut : `http://host.docker.internal:11434`).

---

## Lancer le serveur seul (sans le frontend)

```bash
docker compose -f new_transcription/docker-compose.yml up api-websocket --build
```

Le serveur est accessible sur `http://localhost:8000` (interface de test HTML) et `ws://localhost:8000/ws/transcribe`.

---

## Variables d'environnement

À définir dans un fichier `.env` à côté du `docker-compose.yml` :

```env
GLADIA_API_KEY=     # Requis pour le moteur Gladia
GROQ_API_KEY=       # Requis pour le moteur Groq
OLLAMA_URL=http://host.docker.internal:11434   # URL Ollama (défaut)
OLLAMA_MODEL=mistral                            # Modèle Ollama (défaut)
```

---

## Utiliser les modules Python directement

Si vous intégrez dans un projet Python sans passer par l'API :

```python
from pathlib import Path
from transcription_engines import transcrire_whisper, transcrire_vosk
from audio_processing import analyser_audio

# Analyse du fichier
stats = analyser_audio(Path("audio.wav"))
# → {'duree': 50.0, 'sample_rate': 16000, 'canaux': 1, 'niveau_db': -32.0, ...}

# Transcription
resultats = transcrire_whisper(
    Path("audio.wav"),
    config="cpu_rapide",   # cpu_rapide | cpu_qualite | gpu_equilibre
    nb_locuteurs=2,
    reduction_bruit=True,
    methode_bruit="noisereduce",
    type_environnement="2",
)

print(resultats["texte_brut"])       # Transcription brute
print(resultats["texte_diarise"])    # Avec labels locuteurs
print(resultats["nb_mots"])
print(resultats["nb_locuteurs"])
```

Installez les dépendances :

```bash
pip install vosk faster-whisper resemblyzer noisereduce soundfile scikit-learn
pip install fastapi uvicorn python-multipart requests
# Pour Silero VAD (optionnel) :
pip install torch torchaudio scipy
```
