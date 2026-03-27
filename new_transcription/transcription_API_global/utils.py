#!/usr/bin/env python3
"""
Module utilitaires
Gestion des fichiers, JSON, etc.
"""

from pathlib import Path
from datetime import datetime
import json


def generer_json(fichier_audio_name: str, resultats: dict, moteur: str):
    """Génère un dictionnaire JSON avec les résultats"""
    locution_separee = []
    
    if resultats.get('texte_diarise'):
        lignes = resultats['texte_diarise'].split('\n\n')
        for ligne in lignes:
            if ligne.strip() and ligne.startswith('[Locuteur'):
                try:
                    locuteur = ligne.split(']')[0].replace('[', '').replace(']', '').strip()
                    texte = ligne.split(']', 1)[1].strip()
                    locution_separee.append({"locuteur": locuteur, "texte": texte})
                except:
                    pass
    
    json_data = {
        "fichier_source": fichier_audio_name,
        "date_traitement": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "moteur": moteur,
        "analyse_audio": resultats.get('stats_audio', {}),
        "statistiques": {
            "nombre_mots": resultats.get('nb_mots', 0),
            "nombre_segments": resultats.get('nb_segments', 0),
            "nombre_locuteurs": resultats.get('nb_locuteurs', 0),
            "langue_detectee": resultats.get('langue', 'fr'),
            "confiance_langue": resultats.get('confiance_langue', 1.0)
        },
        "locution_separee": locution_separee,
        "transcription_complete": resultats.get('texte_brut', ''),
        "transcription_avec_locuteurs": resultats.get('texte_diarise', resultats.get('texte_brut', ''))
    }
    return json_data


def sauvegarder_fichier_texte(fichier_audio: Path, resultats: dict, moteur: str):
    """Sauvegarde les résultats dans un fichier texte"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    nom_base = fichier_audio.stem
    fichier_sortie = fichier_audio.parent / f"transcription_{nom_base}_{timestamp}.txt"
    
    with open(fichier_sortie, 'w', encoding='utf-8') as f:
        f.write("=" * 70 + "\n")
        f.write("TRANSCRIPTION AUDIO - RAPPORT COMPLET\n")
        f.write("=" * 70 + "\n\n")
        
        f.write(f"📁 Fichier source: {fichier_audio.name}\n")
        f.write(f"📅 Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"🤖 Moteur: {moteur}\n\n")
        
        # Analyse audio
        if resultats.get('stats_audio'):
            f.write("=" * 70 + "\n")
            f.write("📊 ANALYSE AUDIO\n")
            f.write("=" * 70 + "\n\n")
            stats = resultats['stats_audio']
            f.write(f"Durée: {stats['duree']:.1f}s ({stats['duree']/60:.1f}min)\n")
            f.write(f"Sample rate: {stats['sample_rate']} Hz\n")
            f.write(f"Canaux: {stats['canaux']}\n")
            f.write(f"Niveau sonore: {stats['niveau_db']:.1f} dB\n")
            f.write(f"Activité vocale: {stats['activite_vocale']:.1f}%\n\n")
        
        # Statistiques transcription
        f.write("=" * 70 + "\n")
        f.write("📈 STATISTIQUES DE TRANSCRIPTION\n")
        f.write("=" * 70 + "\n\n")
        f.write(f"Nombre de mots: {resultats.get('nb_mots', 0)}\n")
        f.write(f"Segments: {resultats.get('nb_segments', 0)}\n")
        f.write(f"Locuteurs: {resultats.get('nb_locuteurs', 0)}\n")
        f.write(f"Langue: {resultats.get('langue', 'fr')}\n\n")
        
        # Transcription avec locuteurs
        if resultats.get('texte_diarise'):
            f.write("=" * 70 + "\n")
            f.write("🎭 TRANSCRIPTION AVEC IDENTIFICATION DES LOCUTEURS\n")
            f.write("=" * 70 + "\n\n")
            f.write(resultats['texte_diarise'])
            f.write("\n\n")
        
        # Transcription brute
        f.write("=" * 70 + "\n")
        f.write("📝 TRANSCRIPTION BRUTE (SANS LOCUTEURS)\n")
        f.write("=" * 70 + "\n\n")
        f.write(resultats.get('texte_brut', ''))
        f.write("\n")
    
    return fichier_sortie


def sauvegarder_json(fichier_audio: Path, json_data: dict):
    """Sauvegarde les résultats au format JSON"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    nom_base = fichier_audio.stem
    fichier_sortie = fichier_audio.parent / f"transcription_{nom_base}_{timestamp}.json"
    
    with open(fichier_sortie, 'w', encoding='utf-8') as f:
        json.dump(json_data, f, ensure_ascii=False, indent=2)
    
    return fichier_sortie