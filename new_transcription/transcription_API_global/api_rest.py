#!/usr/bin/env python3
"""
API REST FastAPI pour transcription audio
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from pathlib import Path
import tempfile
import shutil

from transcription_engines import (
    transcrire_vosk,
    transcrire_whisper,
    transcrire_gladia,
    transcrire_groq,
)
from utils import generer_json


app = FastAPI(
    title="API de Transcription Audio",
    description="Vosk, Whisper, Gladia, Groq",
    version="3.0.0"
)


@app.get("/")
async def root():
    return {
        "message": "API de Transcription Audio v3",
        "endpoints": {
            "/vosk":   "Transcription Vosk (local, rapide)",
            "/whisper":"Transcription Whisper (local, GPU)",
            "/gladia": "Transcription Gladia (cloud, 10h/mois)",
            "/groq":   "Transcription Groq (cloud, Whisper-large-v3, très rapide)"
        },
        "documentation": "/docs"
    }


@app.post("/vosk")
async def transcription_vosk(
    file: UploadFile = File(...),
    modele: str = "grand",
    nb_locuteurs: int = 2,
    reduction_bruit: bool = True,
    type_environnement: str = "2",
    methode_bruit: str = "noisereduce"
):
    """
    Transcription avec Vosk

    - **modele**: petit ou grand
    - **nb_locuteurs**: 1-10
    - **reduction_bruit**: true/false
    - **type_environnement**: 1=Silencieux, 2=Normal, 3=Bruyant, 4=Constant
    - **methode_bruit**: noisereduce ou silero
    """
    if not file.filename.endswith('.wav'):
        raise HTTPException(status_code=400, detail="Fichier WAV requis")

    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = Path(tmp.name)

    try:
        resultats = transcrire_vosk(
            tmp_path,
            modele=modele,
            nb_locuteurs=nb_locuteurs,
            reduction_bruit=reduction_bruit,
            type_environnement=type_environnement,
            methode_bruit=methode_bruit
        )
        return JSONResponse(content=generer_json(file.filename, resultats, "Vosk"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


@app.post("/whisper")
async def transcription_whisper(
    file: UploadFile = File(...),
    config: str = "cpu_rapide",
    nb_locuteurs: int = 2,
    reduction_bruit: bool = True,
    type_environnement: str = "2",
    methode_bruit: str = "noisereduce"
):
    """
    Transcription avec Whisper

    - **config**: cpu_rapide, cpu_qualite, gpu_equilibre, gpu_max, ultra_rapide
    - **nb_locuteurs**: 1-10
    - **reduction_bruit**: true/false
    - **type_environnement**: 1=Silencieux, 2=Normal, 3=Bruyant, 4=Constant
    - **methode_bruit**: noisereduce ou silero
    """
    if not file.filename.endswith('.wav'):
        raise HTTPException(status_code=400, detail="Fichier WAV requis")

    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = Path(tmp.name)

    try:
        resultats = transcrire_whisper(
            tmp_path,
            config=config,
            nb_locuteurs=nb_locuteurs,
            reduction_bruit=reduction_bruit,
            type_environnement=type_environnement,
            methode_bruit=methode_bruit
        )
        return JSONResponse(content=generer_json(file.filename, resultats, "Whisper"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


@app.post("/gladia")
async def transcription_gladia(
    file: UploadFile = File(...),
    nb_locuteurs: int = 0
):
    """
    Transcription avec Gladia API

    - **nb_locuteurs**: 0 pour auto, 1-10 pour fixe
    """
    if not file.filename.endswith('.wav'):
        raise HTTPException(status_code=400, detail="Fichier WAV requis")

    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = Path(tmp.name)

    try:
        resultats = transcrire_gladia(tmp_path, nb_locuteurs=nb_locuteurs)
        return JSONResponse(content=generer_json(file.filename, resultats, "Gladia"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


@app.post("/groq")
async def transcription_groq(
    file: UploadFile = File(...),
    nb_locuteurs: int = 0
):
    """
    Transcription avec Groq API (Whisper-large-v3, très rapide)

    - **nb_locuteurs**: 0 pour sans diarisation, 1-10 pour avec diarisation
    - Nécessite GROQ_API_KEY dans transcription_engines.py
    """
    if not file.filename.endswith('.wav'):
        raise HTTPException(status_code=400, detail="Fichier WAV requis")

    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = Path(tmp.name)

    try:
        resultats = transcrire_groq(tmp_path, nb_locuteurs=nb_locuteurs)
        return JSONResponse(content=generer_json(file.filename, resultats, "Groq"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


if __name__ == "__main__":
    import uvicorn
    print("Demarrage de l'API REST v3...")
    print("http://localhost:8000")
    print("Documentation: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
