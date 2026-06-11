"""
SPEECH-TO-TEXT MODULE - Cedric's Meeting Report Generator
Uses Groq API (whisper-large-v3) for audio transcription — no local model, no RAM overhead.

Requirements:
    pip install groq

    Set environment variable:
        GROQ_API_KEY=<your key>   (https://console.groq.com → API Keys)

    FFmpeg is still required to convert audio formats before sending to Groq:
    - Windows: https://ffmpeg.org/download.html
    - Linux:   sudo apt install ffmpeg
    - Mac:     brew install ffmpeg
"""

import os
import tempfile
import subprocess
from pathlib import Path


GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

# Supported audio formats accepted directly by the Groq API
_GROQ_NATIVE = {".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm", ".ogg", ".flac"}

# Medical vocabulary prompt to guide the model for French oncology meetings
MEDICAL_PROMPT = (
    "Réunion de concertation pluridisciplinaire en oncologie. "
    "Tumeur, tumeurs, métastase, métastases, chimiothérapie, radiothérapie, "
    "immunothérapie, biopsie, histologie, carcinome, adénocarcinome, "
    "sarcome, lymphome, mélanome, ganglion, ganglions lymphatiques, "
    "stadification, TNM, IRM, scanner, TEP-scan, PET-scan, "
    "hémoglobine, leucocytes, plaquettes, marqueurs tumoraux, PSA, CA 125, "
    "ACE, AFP, chirurgie, résection, exérèse, curage, protocole, "
    "patient, patiente, dossier médical, compte-rendu, anatomopathologie, "
    "pronostic, diagnostic, rémission, récidive, palliatif, curatif, "
    "concertation pluridisciplinaire, oncologue, chirurgien, radiologue, "
    "pathologiste, infirmier, infirmière."
)


def _ensure_compatible_format(audio_path: Path) -> tuple[Path, bool]:
    """
    If the file format is not natively supported by Groq, convert it to mp3 via ffmpeg.
    Returns (path_to_use, was_temp) — caller must delete the temp file if was_temp is True.
    """
    if audio_path.suffix.lower() in _GROQ_NATIVE:
        return audio_path, False

    tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
    tmp.close()
    tmp_path = Path(tmp.name)

    result = subprocess.run(
        ["ffmpeg", "-y", "-i", str(audio_path), str(tmp_path)],
        capture_output=True,
    )
    if result.returncode != 0:
        tmp_path.unlink(missing_ok=True)
        raise RuntimeError(f"ffmpeg conversion failed: {result.stderr.decode()}")

    return tmp_path, True


class MeetingTranscriber:
    """
    Transcribe meeting audio using the Groq API (whisper-large-v3).
    Identical interface to the previous Whisper-local version so existing
    callers (cedric_complete_integration, api_server) work without changes.
    """

    def __init__(self, model_size=None, device=None):  # noqa: ARG002
        """
        Args:
            model_size: ignored (kept for backwards compatibility)
            device:     ignored (kept for backwards compatibility)
        """
        _ = model_size, device
        if not GROQ_API_KEY:
            raise RuntimeError(
                "GROQ_API_KEY environment variable is not set. "
                "Get a free key at https://console.groq.com"
            )
        print("✓ Meeting Transcriber initialized (Groq API — whisper-large-v3)")

    # ------------------------------------------------------------------
    def transcribe_audio_file(self, audio_file_path, language=None, task="transcribe", initial_prompt=None):  # noqa: ARG002
        """
        Transcribe audio file to text using Groq API.

        Args:
            audio_file_path: Path to audio file (MP3, WAV, M4A, WebM, OGG, …)
            language:        Optional language code (e.g. 'fr', 'en'). Auto-detected if None.
            task:            'transcribe' or 'translate' (translate → English).
                             Note: Groq does not support translate natively; the text is
                             returned as-is when task='translate'.
            initial_prompt:  Optional prompt to improve domain accuracy.

        Returns:
            dict: {
                'success':      bool,
                'transcription': str,
                'language':     str,
                'error':        str   (only when success is False)
            }
        """
        audio_path = Path(audio_file_path)
        if not audio_path.exists():
            return {"success": False, "error": f"Audio file not found: {audio_file_path}"}

        tmp_path = None
        try:
            from groq import Groq

            upload_path, is_tmp = _ensure_compatible_format(audio_path)
            if is_tmp:
                tmp_path = upload_path

            print(f"🎤 Transcribing audio with Groq (whisper-large-v3)…")
            client = Groq(api_key=GROQ_API_KEY)

            kwargs = dict(
                model="whisper-large-v3",
                response_format="verbose_json",
                prompt=initial_prompt or MEDICAL_PROMPT,
            )
            if language:
                kwargs["language"] = language

            with open(upload_path, "rb") as f:
                response = client.audio.transcriptions.create(
                    file=(upload_path.name, f.read()),
                    **kwargs,
                )

            transcription = (response.text or "").strip()
            detected_lang = getattr(response, "language", language or "unknown")

            print(f"✓ Transcription complete: {len(transcription)} characters — langue: {detected_lang}")

            return {
                "success": True,
                "transcription": transcription,
                "language": detected_lang,
            }

        except Exception as e:
            print(f"✗ Groq transcription error: {e}")
            return {"success": False, "error": f"Groq transcription error: {str(e)}"}

        finally:
            if tmp_path and tmp_path.exists():
                tmp_path.unlink(missing_ok=True)

    # ------------------------------------------------------------------
    def transcribe_with_timestamps(self, audio_file_path, language=None):
        """
        Transcribe audio and return segments with timestamps.

        Returns:
            dict: {
                'success':      bool,
                'transcription': str,
                'segments':     list[dict],  # {start, end, text}
                'language':     str,
                'error':        str   (only when success is False)
            }
        """
        audio_path = Path(audio_file_path)
        if not audio_path.exists():
            return {"success": False, "error": f"Audio file not found: {audio_file_path}"}

        tmp_path = None
        try:
            from groq import Groq

            upload_path, is_tmp = _ensure_compatible_format(audio_path)
            if is_tmp:
                tmp_path = upload_path

            print("🎤 Transcribing with timestamps (Groq)…")
            client = Groq(api_key=GROQ_API_KEY)

            kwargs = dict(
                model="whisper-large-v3",
                response_format="verbose_json",
                prompt=MEDICAL_PROMPT,
            )
            if language:
                kwargs["language"] = language

            with open(upload_path, "rb") as f:
                response = client.audio.transcriptions.create(
                    file=(upload_path.name, f.read()),
                    **kwargs,
                )

            segments = [
                {"start": seg.start, "end": seg.end, "text": seg.text.strip()}
                for seg in (response.segments or [])
            ]

            print(f"✓ Transcription complete: {len(segments)} segments")

            return {
                "success": True,
                "transcription": (response.text or "").strip(),
                "segments": segments,
                "language": getattr(response, "language", language or "unknown"),
            }

        except Exception as e:
            return {"success": False, "error": f"Timestamp transcription error: {str(e)}"}

        finally:
            if tmp_path and tmp_path.exists():
                tmp_path.unlink(missing_ok=True)


# ===========================
# USAGE EXAMPLE
# ===========================

if __name__ == "__main__":
    transcriber = MeetingTranscriber()

    audio_file = "meeting_recording.wav"

    if os.path.exists(audio_file):
        result = transcriber.transcribe_audio_file(audio_file)
        if result["success"]:
            print("\n" + "=" * 60)
            print("TRANSCRIPTION RESULT:")
            print("=" * 60)
            print(result["transcription"])
            print(f"\nDetected Language: {result['language']}")
        else:
            print(f"\n✗ Error: {result['error']}")
    else:
        print(f"Audio file not found: {audio_file}")
