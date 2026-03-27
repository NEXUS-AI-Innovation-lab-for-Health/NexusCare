# 🎙️ SpeechCore - SAE Projet 15

Application de transcription médicale avec IA pour l'extraction automatique de données.

## 🚀 Installation rapide

### Prérequis

- **Python 3.11+** : https://www.python.org/downloads/
- **Node.js 20+** : https://nodejs.org/
- **Ollama** : https://ollama.com/download

### Installation en 3 étapes

#### 1️⃣ Backend Python
```bash
cd backend
pip install -r requirements.txt
python api_websocket.py
```

Le serveur démarre sur http://localhost:8000

#### 2️⃣ Frontend React

**Terminal séparé** :
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

L'application s'ouvre sur http://localhost:5173

#### 3️⃣ IA Ollama (pour auto-complétion)

**Terminal séparé** :
```bash
ollama serve
ollama pull mistral
```

Vérifiez sur http://localhost:11434

## 🧪 Utilisation

1. Ouvrez http://localhost:5173
2. Allez dans "Reconnaissance Vocale"
3. Choissisez le type d'API que vous souhaitez utiliser (Whisper, Vosk, Gladia) et configurer selon vos besoins
4. Cliquez sur le micro et parlez
5. A la fin de l'enregistrement, enregistrer la transcription.

## 📁 Structure du projet
```
SAE_PROJET15/
├── backend/          → API Python (FastAPI + Whisper/Vosk/Gladia + Ollama)
├── app/              → Interface React (Vite + TypeScript)
└── docs/             → Documentation
```

## 🛠️ Technologies

- **Backend** : Python, FastAPI, Whisper, Vosk, Gladia, Ollama
- **App** : React, TypeScript, Vite, Tailwind CSS
- **IA** : Whisper (transcription), Mistral (extraction)

## 👥 Équipe

- Matéo Durandeau FA3A
- Edouard Peyrouty FA3A
- Jamie Rabonarson FA3A

## 📝 Licence

Projet 15 - SAE BUT Informatique
