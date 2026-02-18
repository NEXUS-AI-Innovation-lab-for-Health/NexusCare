"""
SPEECH-TO-TEXT MODULE - Cedric's Meeting Report Generator
Uses OpenAI Whisper for audio transcription

Features:
- Converts audio files (WebM, MP3, WAV, etc.) to compatible formats
- Transcribes audio using OpenAI Whisper
- Multiple model sizes for accuracy/speed tradeoff
- Returns transcribed text with high accuracy

Requirements:
    pip install openai-whisper
    
    Also install FFmpeg (required by Whisper):
    - Windows: https://ffmpeg.org/download.html
    - Linux: sudo apt install ffmpeg
    - Mac: brew install ffmpeg
"""

import whisper
import os
from datetime import datetime


class MeetingTranscriber:
    """
    Transcribe meeting audio files to text using OpenAI Whisper
    """
    
    def __init__(self, model_size="base", device="auto"):
        """
        Initialize the transcriber with Whisper model
        
        Args:
            model_size: Whisper model size ('tiny', 'base', 'small', 'medium', 'large')
                       - tiny: Fastest, ~1GB VRAM, good for quick testing
                       - base: Good balance, ~1GB VRAM (recommended)
                       - small: Better accuracy, ~2GB VRAM
                       - medium: High accuracy, ~5GB VRAM
                       - large: Best accuracy, ~10GB VRAM (GPU recommended)
            device: Device to run on ('auto', 'cuda', 'cpu')
        """
        self.model_size = model_size
        # Resolve "auto" to an actual device string torch understands
        if device == "auto":
            import torch
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device
        self.model = None
        print(f"✓ Meeting Transcriber initialized with Whisper model: {model_size}")
    
    def _load_model(self):
        """
        Load Whisper model (lazy loading)
        """
        if self.model is None:
            print(f"🎤 Loading Whisper model ({self.model_size}) on {self.device}...")
            self.model = whisper.load_model(self.model_size, device=self.device)
            print("✓ Whisper model loaded successfully")
        return self.model
    
    # Medical vocabulary prompt to guide Whisper for French oncology meetings
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

    def transcribe_audio_file(self, audio_file_path, language=None, task="transcribe", initial_prompt=None):
        """
        Transcribe audio file to text using OpenAI Whisper
        
        Args:
            audio_file_path: Path to audio file (supports all formats: MP3, WAV, M4A, WebM, etc.)
            language: Optional language code (e.g., 'en', 'es', 'fr'). Auto-detected if None.
            task: Either 'transcribe' or 'translate' (translate to English)
            initial_prompt: Optional text prompt to condition the model (improves domain-specific accuracy)
        
        Returns:
            dict: {
                'success': bool,
                'transcription': str,
                'language': str,
                'error': str (if applicable)
            }
        """
        try:
            # Check if file exists
            if not os.path.exists(audio_file_path):
                return {
                    'success': False,
                    'error': f'Audio file not found: {audio_file_path}'
                }
            
            # Load model
            model = self._load_model()
            
            # Transcribe using Whisper
            print(f"🎤 Transcribing audio with Whisper ({self.model_size})...")
            
            # Transcribe options
            transcribe_options = {'task': task}
            if language:
                transcribe_options['language'] = language
            # Use medical prompt by default if none provided
            transcribe_options['initial_prompt'] = initial_prompt or self.MEDICAL_PROMPT
            
            result = model.transcribe(audio_file_path, **transcribe_options)
            
            transcription = result['text'].strip()
            detected_language = result.get('language', 'unknown')
            
            print(f"✓ Transcription complete: {len(transcription)} characters")
            print(f"  Detected language: {detected_language}")
            
            return {
                'success': True,
                'transcription': transcription,
                'language': detected_language,
                'full_result': result  # Includes segments, timestamps, etc.
            }
        
        except Exception as e:
            print(f"✗ Whisper transcription error: {e}")
            return {
                'success': False,
                'error': f'Whisper transcription error: {str(e)}'
            }
    
    def transcribe_with_timestamps(self, audio_file_path, language=None):
        """
        Transcribe audio and return detailed segments with timestamps
        
        Args:
            audio_file_path: Path to audio file
            language: Optional language code
        
        Returns:
            dict: {
                'success': bool,
                'transcription': str,
                'segments': list of dict with timestamps,
                'error': str (if applicable)
            }
        """
        try:
            # Check if file exists
            if not os.path.exists(audio_file_path):
                return {
                    'success': False,
                    'error': f'Audio file not found: {audio_file_path}'
                }
            
            # Load model
            model = self._load_model()
            
            print(f"🎤 Transcribing with timestamps...")
            
            transcribe_options = {}
            if language:
                transcribe_options['language'] = language
            
            result = model.transcribe(audio_file_path, **transcribe_options)
            
            # Format segments with timestamps
            segments = []
            for seg in result['segments']:
                segments.append({
                    'start': seg['start'],
                    'end': seg['end'],
                    'text': seg['text'].strip()
                })
            
            print(f"✓ Transcription complete: {len(segments)} segments")
            
            return {
                'success': True,
                'transcription': result['text'].strip(),
                'segments': segments,
                'language': result.get('language', 'unknown')
            }
        
        except Exception as e:
            return {
                'success': False,
                'error': f'Timestamp transcription error: {str(e)}'
            }


# ===========================
# USAGE EXAMPLE
# ===========================

if __name__ == "__main__":
    # Initialize transcriber with Whisper model
    # Model options: 'tiny', 'base', 'small', 'medium', 'large'
    transcriber = MeetingTranscriber(model_size="base")
    
    # Example 1: Basic transcription
    audio_file = "meeting_recording.wav"  # Can also be MP3, M4A, WebM, etc.
    
    if os.path.exists(audio_file):
        result = transcriber.transcribe_audio_file(audio_file)
        
        if result['success']:
            print("\n" + "="*60)
            print("TRANSCRIPTION RESULT:")
            print("="*60)
            print(result['transcription'])
            print(f"\nDetected Language: {result['language']}")
        else:
            print(f"\n✗ Error: {result['error']}")
    else:
        print(f"Example audio file not found: {audio_file}")
        print("\nCreating a demo with sample text...")
        
    # Example 2: Transcription with timestamps (useful for long meetings)
    """
    result = transcriber.transcribe_with_timestamps(audio_file)
    if result['success']:
        print("\n" + "="*60)
        print("TRANSCRIPTION WITH TIMESTAMPS:")
        print("="*60)
        for segment in result['segments']:
            start_time = segment['start']
            end_time = segment['end']
            text = segment['text']
            print(f"[{start_time:.2f}s - {end_time:.2f}s] {text}")
    """
    
    # Example 3: Transcribe MP3 file (Whisper handles all formats automatically)
    """
    mp3_file = "meeting_recording.mp3"
    result = transcriber.transcribe_audio_file(mp3_file)
    if result['success']:
        print(result['transcription'])
    """
    
    # Example 4: Transcribe and translate to English
    """
    result = transcriber.transcribe_audio_file(audio_file, task="translate")
    if result['success']:
        print("Translation to English:", result['transcription'])
    """
