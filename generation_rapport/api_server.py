"""
FastAPI server for the Meeting Report Generator.
Exposes endpoints for audio upload / text submission → PDF report generation.
Runs inside the Docker container on port 8000.
"""

# ── Monkey-patch torch.load BEFORE any whisper import ──────────────
# Recent versions of openai-whisper call torch.load(weights_only=True),
# but the model checkpoint files are not compatible with that flag.
# We force weights_only=False since the Whisper models are trusted.
import torch
_original_torch_load = torch.load

def _patched_torch_load(*args, **kwargs):
    kwargs["weights_only"] = False
    return _original_torch_load(*args, **kwargs)

torch.load = _patched_torch_load
# ────────────────────────────────────────────────────────────────────

import os
import uuid
import traceback
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="OncoCollab Report Generator API")

# Allow cross-origin requests from the visio-app frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTPUT_DIR = Path("/app/output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _get_gemini_key() -> str:
    key = os.getenv("GEMINI_API_KEY", "")
    if not key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY environment variable is not set on the server.",
        )
    return key


# ------------------------------------------------------------------
# Health check
# ------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok", "service": "generation_rapport"}


# ------------------------------------------------------------------
# Generate report from uploaded audio file
# ------------------------------------------------------------------
@app.post("/generate/audio")
async def generate_from_audio(
    audio: UploadFile = File(...),
    meeting_type: str = Form("medical"),
    organization_name: str = Form("OncoCollab"),
    whisper_model: str = Form("small"),
    language: str = Form("fr"),
):
    """
    Receive an audio file (webm, wav, mp3 …), run Whisper → Gemini → PDF pipeline.
    Returns the generated PDF.
    """
    gemini_key = _get_gemini_key()
    uid = uuid.uuid4().hex[:10]

    # --- Save uploaded audio to disk ---
    ext = Path(audio.filename or "audio.webm").suffix or ".webm"
    audio_path = UPLOAD_DIR / f"audio_{uid}{ext}"
    with open(audio_path, "wb") as f:
        f.write(await audio.read())

    pdf_filename = f"report_{uid}.pdf"
    pdf_path = OUTPUT_DIR / pdf_filename

    try:
        from cedric_complete_integration import CompleteMeetingReportGenerator

        generator = CompleteMeetingReportGenerator(
            gemini_api_key=gemini_key,
            organization_name=organization_name,
            whisper_model=whisper_model,
        )

        result = generator.generate_report_from_audio(
            audio_file_path=str(audio_path),
            output_pdf_filename=str(pdf_path),
            meeting_type=meeting_type,
            language=language,
        )

        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Unknown error"))

        return FileResponse(
            path=str(pdf_path),
            filename=pdf_filename,
            media_type="application/pdf",
        )

    except HTTPException:
        raise
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        # Clean up uploaded audio
        if audio_path.exists():
            audio_path.unlink(missing_ok=True)


# ------------------------------------------------------------------
# Generate report from raw text (skip Whisper)
# ------------------------------------------------------------------
@app.post("/generate/text")
async def generate_from_text(
    text: str = Form(...),
    meeting_type: str = Form("medical"),
    organization_name: str = Form("OncoCollab"),
):
    """
    Receive raw meeting text, run Gemini → PDF pipeline.
    Returns the generated PDF.
    """
    gemini_key = _get_gemini_key()
    uid = uuid.uuid4().hex[:10]

    pdf_filename = f"report_{uid}.pdf"
    pdf_path = OUTPUT_DIR / pdf_filename

    try:
        from cedric_complete_integration import CompleteMeetingReportGenerator

        generator = CompleteMeetingReportGenerator(
            gemini_api_key=gemini_key,
            organization_name=organization_name,
        )

        result = generator.generate_report_from_text(
            raw_text=text,
            output_pdf_filename=str(pdf_path),
            meeting_type=meeting_type,
        )

        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Unknown error"))

        return FileResponse(
            path=str(pdf_path),
            filename=pdf_filename,
            media_type="application/pdf",
        )

    except HTTPException:
        raise
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


# ------------------------------------------------------------------
# Transcribe only (return text, no PDF)
# ------------------------------------------------------------------
@app.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    whisper_model: str = Form("small"),
    language: str = Form("fr"),
):
    """
    Transcribe audio with Whisper and return the text (useful for preview).
    """
    uid = uuid.uuid4().hex[:10]
    ext = Path(audio.filename or "audio.webm").suffix or ".webm"
    audio_path = UPLOAD_DIR / f"audio_{uid}{ext}"

    with open(audio_path, "wb") as f:
        f.write(await audio.read())

    try:
        from cedric_file1 import MeetingTranscriber

        transcriber = MeetingTranscriber(model_size=whisper_model)
        result = transcriber.transcribe_audio_file(str(audio_path), language=language)

        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Transcription failed"))

        return JSONResponse(
            content={
                "success": True,
                "transcription": result["transcription"],
                "language": result.get("language", "unknown"),
            }
        )

    except HTTPException:
        raise
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        if audio_path.exists():
            audio_path.unlink(missing_ok=True)
