#!/usr/bin/env python3
"""
Module des moteurs de transcription
Whisper (local) et Groq (cloud)
"""

from pathlib import Path
import os
import soundfile as sf
import numpy as np
from resemblyzer import VoiceEncoder, preprocess_wav
from sklearn.cluster import AgglomerativeClustering

from audio_processing import analyser_audio, reduire_bruit


# ========== CONFIGURATION ==========

CONFIGS_WHISPER = {
    "cpu_rapide":    {"model_size": "base",     "device": "cpu",  "compute_type": "int8"},
    "cpu_qualite":   {"model_size": "small",    "device": "cpu",  "compute_type": "int8"},
    "gpu_equilibre": {"model_size": "medium",   "device": "cuda", "compute_type": "float16"},
    "gpu_max":       {"model_size": "large-v3", "device": "cuda", "compute_type": "float16"},
    "ultra_rapide":  {"model_size": "tiny",     "device": "auto", "compute_type": "int8"}
}

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")


# ========== CACHE MODÈLES (singletons) ==========
# Les modèles sont chargés une seule fois au démarrage du serveur
# et réutilisés pour toutes les requêtes — gain majeur sur la latence.

_whisper_models: dict                = {}
_voice_encoder:  VoiceEncoder | None = None


def _get_whisper_model(config: str):
    """Retourne le modèle Whisper mis en cache, le charge si nécessaire."""
    if config not in _whisper_models:
        from faster_whisper import WhisperModel
        wcfg = CONFIGS_WHISPER.get(config, CONFIGS_WHISPER["cpu_rapide"])
        _whisper_models[config] = WhisperModel(
            wcfg['model_size'],
            device=wcfg['device'],
            compute_type=wcfg['compute_type']
        )
    return _whisper_models[config]


def _get_voice_encoder() -> VoiceEncoder:
    """Retourne le VoiceEncoder mis en cache (Resemblyzer)."""
    global _voice_encoder
    if _voice_encoder is None:
        _voice_encoder = VoiceEncoder()
    return _voice_encoder


# ========== DIARIZATION ==========

def re_segmenter(segments_avec_temps, max_duration=5.0):
    """Découpe les longs segments pour améliorer la diarisation."""
    nouveaux_segments = []

    for segment in segments_avec_temps:
        duration = segment['end'] - segment['start']

        if duration <= max_duration:
            nouveaux_segments.append(segment)
        else:
            num_chunks = int(np.ceil(duration / max_duration))
            mots = segment['text'].split()

            if not mots:
                continue

            mots_par_chunk = max(1, len(mots) // num_chunks)

            for i in range(num_chunks):
                start     = segment['start'] + i * max_duration
                end       = min(segment['start'] + (i + 1) * max_duration, segment['end'])
                debut_mot = i * mots_par_chunk
                fin_mot   = (i + 1) * mots_par_chunk if i < num_chunks - 1 else len(mots)

                if debut_mot < len(mots):
                    nouveaux_segments.append({
                        'start': start,
                        'end':   end,
                        'text':  ' '.join(mots[debut_mot:fin_mot])
                    })

    return nouveaux_segments


def diarizer_avec_resemblyzer(fichier_audio: Path, segments_avec_temps, n_speakers: int):
    """Identifie les locuteurs avec Resemblyzer (encodeur mis en cache)."""
    try:
        encoder    = _get_voice_encoder()   # ← cache
        audio_data, sample_rate = sf.read(str(fichier_audio))

        if len(audio_data.shape) > 1:
            audio_data = np.mean(audio_data, axis=1)

        embeddings     = []
        valid_segments = []

        for segment in segments_avec_temps:
            start_sample = max(0, int(segment['start'] * sample_rate))
            end_sample   = min(len(audio_data), int(segment['end'] * sample_rate))
            seg_audio    = audio_data[start_sample:end_sample]

            if len(seg_audio) < sample_rate * 0.3:
                continue

            try:
                seg_wav = preprocess_wav(seg_audio, sample_rate)
                embed   = encoder.embed_utterance(seg_wav)
                embeddings.append(embed)
                valid_segments.append(segment)
            except Exception:
                continue

        if len(embeddings) < 2:
            return None

        n_speakers = min(n_speakers, len(embeddings))
        labels = AgglomerativeClustering(n_clusters=n_speakers, linkage='average') \
                     .fit_predict(np.array(embeddings))

        for segment, label in zip(valid_segments, labels):
            segment['speaker'] = int(label)

        return valid_segments

    except Exception:
        return None


def formater_transcription_avec_locuteurs(segments_diarises):
    """Formate la transcription avec les locuteurs."""
    if not segments_diarises:
        return None

    texte_avec_locuteurs = []
    current_speaker      = None
    current_text         = []

    for segment in segments_diarises:
        speaker_id = segment['speaker']

        if speaker_id == current_speaker:
            current_text.append(segment['text'])
        else:
            if current_text:
                texte_avec_locuteurs.append(
                    f"[Locuteur {current_speaker}] {' '.join(current_text)}"
                )
            current_speaker = speaker_id
            current_text    = [segment['text']]

    if current_text:
        texte_avec_locuteurs.append(
            f"[Locuteur {current_speaker}] {' '.join(current_text)}"
        )

    return "\n\n".join(texte_avec_locuteurs)


# ========== MOTEUR WHISPER ==========

def transcrire_whisper(
    fichier_audio: Path,
    config: str           = "cpu_rapide",
    nb_locuteurs: int     = 2,
    reduction_bruit: bool = True,
    type_environnement: str = "2",
    methode_bruit: str    = "noisereduce",
    initial_prompt: str   = ""
):
    """
    Transcription avec Whisper (modèle mis en cache).
    initial_prompt : derniers mots du chunk précédent pour améliorer la continuité
                     inter-chunks et réduire les hallucinations.
    """
    stats_audio = analyser_audio(fichier_audio)
    model       = _get_whisper_model(config)    # ← cache, pas de rechargement

    fichier_a_transcrire = fichier_audio
    fichier_temp         = None

    if reduction_bruit:
        fichier_nettoye = reduire_bruit(fichier_audio, type_environnement, methode_bruit)
        fichier_a_transcrire = Path(fichier_nettoye)
        if fichier_nettoye != str(fichier_audio):
            fichier_temp = Path(fichier_nettoye)

    segments, info = model.transcribe(
        str(fichier_a_transcrire),
        language='fr',
        beam_size=1,
        vad_filter=True,
        initial_prompt=initial_prompt or None   # ← contexte inter-chunks
    )

    segments_avec_temps = []
    texte_brut_complet  = []
    total_mots          = 0

    for segment in segments:
        segments_avec_temps.append({
            'start': segment.start,
            'end':   segment.end,
            'text':  segment.text.strip()
        })
        texte_brut_complet.append(segment.text.strip())
        total_mots += len(segment.text.split())

    segments_diarises = diarizer_avec_resemblyzer(
        fichier_a_transcrire, segments_avec_temps, nb_locuteurs
    )

    if fichier_temp and fichier_temp.exists():
        fichier_temp.unlink()

    return {
        'texte_brut':       ' '.join(texte_brut_complet),
        'texte_diarise':    formater_transcription_avec_locuteurs(segments_diarises),
        'stats_audio':      stats_audio,
        'nb_mots':          total_mots,
        'nb_segments':      len(segments_avec_temps),
        'nb_locuteurs':     nb_locuteurs,
        'langue':           info.language,
        'confiance_langue': info.language_probability
    }


# ========== MOTEUR GROQ ==========

def transcrire_groq(
    fichier_audio: Path,
    nb_locuteurs: int  = 0,
    initial_prompt: str = ""
):
    """
    Transcription avec l'API Groq (Whisper-large-v3, très rapide ~2-5x Whisper local).
    Nécessite : pip install groq
    Clé API   : https://console.groq.com → API Keys → mettre dans GROQ_API_KEY
    """
    from groq import Groq

    stats_audio = analyser_audio(fichier_audio)
    client      = Groq(api_key=GROQ_API_KEY)

    with open(fichier_audio, "rb") as f:
        response = client.audio.transcriptions.create(
            file=(fichier_audio.name, f.read()),
            model="whisper-large-v3",
            language="fr",
            response_format="verbose_json",
            prompt=initial_prompt or None
        )

    full_transcript     = response.text or ""
    segments_avec_temps = []

    for seg in (response.segments or []):
        segments_avec_temps.append({
            'start': seg.start,
            'end':   seg.end,
            'text':  seg.text.strip()
        })

    segments_diarises = None
    if nb_locuteurs > 0 and len(segments_avec_temps) >= 2:
        segments_diarises = diarizer_avec_resemblyzer(
            fichier_audio, segments_avec_temps, nb_locuteurs
        )

    return {
        'texte_brut':       full_transcript,
        'texte_diarise':    formater_transcription_avec_locuteurs(segments_diarises),
        'stats_audio':      stats_audio,
        'nb_mots':          len(full_transcript.split()),
        'nb_segments':      len(segments_avec_temps),
        'nb_locuteurs':     nb_locuteurs,
        'langue':           'fr',
        'confiance_langue': 1.0
    }
