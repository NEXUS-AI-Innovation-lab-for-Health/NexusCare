#!/usr/bin/env python3
"""
Module de traitement audio
Gère l'analyse et la réduction de bruit
"""

import soundfile as sf
import numpy as np
import noisereduce as nr
from pathlib import Path


def analyser_audio(fichier_audio: Path) -> dict:
    """Analyse préliminaire du fichier audio"""
    try:
        audio_data, sample_rate = sf.read(str(fichier_audio))
        
        if len(audio_data.shape) > 1:
            nb_canaux = audio_data.shape[1]
            audio_mono = np.mean(audio_data, axis=1)
        else:
            nb_canaux = 1
            audio_mono = audio_data
        
        duree = len(audio_mono) / sample_rate
        
        # Calcul du niveau sonore moyen
        rms = np.sqrt(np.mean(audio_mono**2))
        db = 20 * np.log10(rms + 1e-10)
        
        # Détection de silence
        silence_threshold = 0.01
        non_silence = np.abs(audio_mono) > silence_threshold
        pourcentage_parole = (np.sum(non_silence) / len(audio_mono)) * 100
        
        return {
            'duree': float(duree),
            'sample_rate': int(sample_rate),
            'canaux': int(nb_canaux),
            'niveau_db': float(db),
            'activite_vocale': float(pourcentage_parole)
        }
    except Exception as e:
        return None


def reduire_bruit_noisereduce(fichier_audio: Path, type_environnement: str = "2") -> str:
    """Réduction de bruit avec NoiseReduce"""
    configs = {
        "1": {'stationary': True, 'prop_decrease': 0.5, 'freq_mask_smooth_hz': 500, 'time_mask_smooth_ms': 50},
        "2": {'stationary': False, 'prop_decrease': 0.8, 'freq_mask_smooth_hz': 500, 'time_mask_smooth_ms': 50},
        "3": {'stationary': False, 'prop_decrease': 1.0, 'freq_mask_smooth_hz': 1000, 'time_mask_smooth_ms': 100},
        "4": {'stationary': True, 'prop_decrease': 0.9, 'freq_mask_smooth_hz': 800, 'time_mask_smooth_ms': 80}
    }
    
    config = configs.get(type_environnement, configs["2"])
    
    try:
        audio_data, sample_rate = sf.read(str(fichier_audio))
        
        if len(audio_data.shape) > 1:
            audio_data = np.mean(audio_data, axis=1)
        
        reduced_noise = nr.reduce_noise(
            y=audio_data, sr=sample_rate,
            stationary=config['stationary'],
            prop_decrease=config['prop_decrease'],
            freq_mask_smooth_hz=config['freq_mask_smooth_hz'],
            time_mask_smooth_ms=config['time_mask_smooth_ms']
        )
        
        max_val = np.max(np.abs(reduced_noise))
        if max_val > 0:
            reduced_noise = reduced_noise / max_val * 0.9
        
        temp_file = fichier_audio.parent / f"cleaned_{fichier_audio.name}"
        sf.write(str(temp_file), reduced_noise, sample_rate, subtype='PCM_16')
        
        return str(temp_file)
    except Exception as e:
        return str(fichier_audio)


def reduire_bruit_silero(fichier_audio: Path) -> str:
    """Réduction de bruit avec Silero VAD"""
    try:
        import torch
        torch.set_num_threads(1)
        
        model, utils = torch.hub.load(
            repo_or_dir='snakers4/silero-vad',
            model='silero_vad',
            force_reload=False,
            onnx=False
        )
        (get_speech_timestamps, _, _, _, collect_chunks) = utils
        
        audio_data, sample_rate = sf.read(str(fichier_audio))
        
        if len(audio_data.shape) > 1:
            audio_data = np.mean(audio_data, axis=1)
        
        # Silero nécessite 16kHz
        if sample_rate != 16000:
            from scipy import signal as scipy_signal
            num_samples = int(len(audio_data) * 16000 / sample_rate)
            audio_data = scipy_signal.resample(audio_data, num_samples)
            sample_rate = 16000
        
        wav = torch.from_numpy(audio_data).float()
        speech_timestamps = get_speech_timestamps(wav, model, sampling_rate=sample_rate)
        
        if not speech_timestamps:
            return str(fichier_audio)
        
        cleaned_audio = collect_chunks(speech_timestamps, wav)
        cleaned_audio_np = cleaned_audio.numpy()
        
        max_val = np.max(np.abs(cleaned_audio_np))
        if max_val > 0:
            cleaned_audio_np = cleaned_audio_np / max_val * 0.9
        
        temp_file = fichier_audio.parent / f"cleaned_{fichier_audio.name}"
        sf.write(str(temp_file), cleaned_audio_np, sample_rate, subtype='PCM_16')
        
        return str(temp_file)
    except Exception as e:
        return str(fichier_audio)


def reduire_bruit(fichier_audio: Path, type_environnement: str = "2", methode: str = "noisereduce") -> str:
    """Réduction de bruit selon la méthode choisie"""
    if methode == "silero":
        return reduire_bruit_silero(fichier_audio)
    else:
        return reduire_bruit_noisereduce(fichier_audio, type_environnement)