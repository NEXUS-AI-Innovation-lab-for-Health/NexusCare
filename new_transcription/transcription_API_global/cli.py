#!/usr/bin/env python3
"""
Interface CLI pour transcription audio
"""

from pathlib import Path
from transcription_engines import (
    transcrire_vosk, transcrire_whisper, transcrire_gladia,
    MODELES_VOSK, CONFIGS_WHISPER
)
from utils import generer_json, sauvegarder_fichier_texte, sauvegarder_json
import json as json_module


def main():
    print("=" * 70)
    print("  🎙️  TRANSCRIPTION AUDIO")
    print("  3 Moteurs disponibles: Vosk, Whisper, Gladia")
    print("=" * 70)
    
    # Choix du moteur
    print("\n" + "=" * 70)
    print("CHOIX DU MOTEUR")
    print("=" * 70)
    print("\n1. 🚀 Vosk (rapide, local, gratuit illimité)")
    print("2. 🎯 Whisper (meilleure qualité, local, GPU supporté)")
    print("3. ☁️  Gladia (cloud, meilleure qualité, 10h/mois gratuit)")
    
    choix_moteur = input("\n➤ Choisissez votre moteur (1-3): ").strip()
    
    if choix_moteur not in ["1", "2", "3"]:
        print("❌ Choix invalide")
        return
    
    # Configuration spécifique au moteur
    if choix_moteur == "1":  # Vosk
        print("\n" + "=" * 70)
        print("MODÈLE VOSK")
        print("=" * 70)
        print("\n1. ⚡ Petit (41 MB, rapide)")
        print("2. 🇫🇷 Grand (1.5 GB, meilleure qualité)")
        
        choix_modele = input("\n➤ Choisissez le modèle (1-2): ").strip()
        modele_vosk = "petit" if choix_modele == "1" else "grand"
        
        # Vérifier si installé
        modele_info = MODELES_VOSK[modele_vosk]
        if not Path(modele_info['path']).exists():
            print(f"\n⚠️  Modèle non installé: {modele_info['path']}")
            print(f"📥 Téléchargez: wget {modele_info['url']}")
            print(f"📦 Puis: unzip {modele_info['url'].split('/')[-1]}")
            return
    
    elif choix_moteur == "2":  # Whisper
        print("\n" + "=" * 70)
        print("CONFIGURATION WHISPER")
        print("=" * 70)
        print("\n1. 💻 CPU Rapide")
        print("2. 💻 CPU Qualité")
        print("3. 🚀 GPU Équilibré")
        print("4. 🔥 GPU Max")
        print("5. ⚡ Ultra Rapide")
        
        choix_config = input("\n➤ Choisissez la configuration (1-5): ").strip()
        configs_map = {"1": "cpu_rapide", "2": "cpu_qualite", "3": "gpu_equilibre", "4": "gpu_max", "5": "ultra_rapide"}
        config_whisper = configs_map.get(choix_config, "cpu_rapide")
    
    # Lister les fichiers WAV
    print("\n" + "=" * 70)
    print("FICHIERS AUDIO")
    print("=" * 70)
    
    fichiers_wav = sorted(list(Path(".").glob("*.wav")))
    
    if not fichiers_wav:
        print("❌ Aucun fichier .wav trouvé")
        return
    
    print(f"\n📁 {len(fichiers_wav)} fichier(s) .wav:\n")
    for i, fichier in enumerate(fichiers_wav, 1):
        taille = fichier.stat().st_size / (1024 * 1024)
        print(f"{i}. {fichier.name} ({taille:.1f} MB)")
    
    choix_fichier = int(input("\n➤ Choisissez un fichier (numéro): "))
    
    if not (1 <= choix_fichier <= len(fichiers_wav)):
        print("❌ Numéro invalide")
        return
    
    fichier_choisi = fichiers_wav[choix_fichier - 1]
    
    # Nombre de locuteurs
    print("\n" + "=" * 70)
    print("NOMBRE DE LOCUTEURS")
    print("=" * 70)
    
    if choix_moteur == "3":  # Gladia
        print("💡 0 = Détection automatique")
        nb_locuteurs = int(input("➤ Nombre de locuteurs (0-10): "))
    else:
        nb_locuteurs = int(input("➤ Nombre de locuteurs (1-10): "))
    
    if nb_locuteurs < 0 or nb_locuteurs > 10:
        print("⚠️  Valeur invalide, utilisation de 2 par défaut")
        nb_locuteurs = 2
    
    # Réduction de bruit (pas pour Gladia)
    reduction_bruit = False
    type_environnement = "2"
    methode_bruit = "noisereduce"
    
    if choix_moteur in ["1", "2"]:
        print("\n" + "=" * 70)
        print("RÉDUCTION DE BRUIT")
        print("=" * 70)
        
        reduction = input("➤ Activer la réduction de bruit ? (o/n): ").lower()
        reduction_bruit = reduction != 'n'
        
        if reduction_bruit:
            print("\n🌍 TYPE D'ENVIRONNEMENT:")
            print("1. Salle silencieuse")
            print("2. Bureau/Normal")
            print("3. Environnement bruyant")
            print("4. Bruit constant")
            
            type_environnement = input("\n➤ Environnement (1-4): ").strip()
            if type_environnement not in ["1", "2", "3", "4"]:
                type_environnement = "2"
            
            print("\n🔧 MÉTHODE:")
            print("1. NoiseReduce (classique)")
            print("2. Silero VAD (IA)")
            
            methode = input("\n➤ Méthode (1-2): ").strip()
            methode_bruit = "silero" if methode == "2" else "noisereduce"
    
    # Type de sortie
    print("\n" + "=" * 70)
    print("TYPE DE SORTIE")
    print("=" * 70)
    print("\n1. 🖨️  Affichage console")
    print("2. 📄 Fichier texte")
    print("3. 📝 Return string")
    print("4. 📊 Fichier JSON")
    
    type_sortie = input("\n➤ Type de sortie (1-4): ").strip()
    
    if type_sortie not in ["1", "2", "3", "4"]:
        type_sortie = "1"
    
    # Traitement
    print("\n" + "=" * 70)
    print("🚀 TRAITEMENT EN COURS...")
    print("=" * 70)
    
    try:
        if choix_moteur == "1":  # Vosk
            resultats = transcrire_vosk(
                fichier_choisi,
                modele=modele_vosk,
                nb_locuteurs=nb_locuteurs,
                reduction_bruit=reduction_bruit,
                type_environnement=type_environnement,
                methode_bruit=methode_bruit
            )
            moteur_nom = "Vosk"
        
        elif choix_moteur == "2":  # Whisper
            resultats = transcrire_whisper(
                fichier_choisi,
                config=config_whisper,
                nb_locuteurs=nb_locuteurs,
                reduction_bruit=reduction_bruit,
                type_environnement=type_environnement,
                methode_bruit=methode_bruit
            )
            moteur_nom = "Whisper"
        
        else:  # Gladia
            resultats = transcrire_gladia(
                fichier_choisi,
                nb_locuteurs=nb_locuteurs
            )
            moteur_nom = "Gladia"
        
        # Traiter selon le type de sortie
        if type_sortie == "1":  # Console
            print("\n" + "=" * 70)
            print("📊 RÉSULTATS")
            print("=" * 70)
            
            if resultats.get('texte_diarise'):
                print("\n🎭 AVEC LOCUTEURS:")
                print("-" * 70)
                print(resultats['texte_diarise'])
            
            print("\n📝 TRANSCRIPTION BRUTE:")
            print("-" * 70)
            print(resultats['texte_brut'])
            print("\n" + "=" * 70)
        
        elif type_sortie == "2":  # Fichier texte
            fichier_sortie = sauvegarder_fichier_texte(fichier_choisi, resultats, moteur_nom)
            print(f"\n✅ Fichier créé: {fichier_sortie.name}")
        
        elif type_sortie == "3":  # String
            print("\n📝 TRANSCRIPTION:")
            print(resultats['texte_brut'])
            return resultats['texte_brut']
        
        elif type_sortie == "4":  # JSON
            json_data = generer_json(fichier_choisi.name, resultats, moteur_nom)
            fichier_json = sauvegarder_json(fichier_choisi, json_data)
            print(f"\n✅ JSON créé: {fichier_json.name}")
            print("\n📊 Aperçu:")
            print(json_module.dumps(json_data, ensure_ascii=False, indent=2)[:500] + "...")
            return json_data
    
    except Exception as e:
        print(f"\n❌ Erreur: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()