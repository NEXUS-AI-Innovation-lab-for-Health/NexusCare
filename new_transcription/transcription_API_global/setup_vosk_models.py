#!/usr/bin/env python3
import os
import subprocess
from pathlib import Path

MODELES = {
    "vosk-model-small-fr-0.22": "https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip",
    "vosk-model-fr-0.22": "https://alphacephei.com/vosk/models/vosk-model-fr-0.22.zip"
}

FICHIERS_CRITIQUES = ["graph/HCLG.fst", "am/final.mdl", "conf/model.conf"]

def verifier_modele(chemin_modele):
    if not Path(chemin_modele).exists():
        return False
    for fichier in FICHIERS_CRITIQUES:
        if not (Path(chemin_modele) / fichier).exists():
            return False
    return True

def installer_modele(nom, url):
    print(f"Installation de {nom}...")
    zip_file = f"{nom}.zip"
    
    subprocess.run(["wget", "-q", "--show-progress", url, "-O", zip_file], check=True)
    subprocess.run(["unzip", "-q", "-o", zip_file], check=True)
    os.remove(zip_file)
    
    print(f"✓ {nom} installé")

for nom_modele, url_modele in MODELES.items():
    if not verifier_modele(nom_modele):
        if Path(nom_modele).exists():
            print(f"⚠ {nom_modele} corrompu, réinstallation...")
            subprocess.run(["rm", "-rf", nom_modele])
        installer_modele(nom_modele, url_modele)
    else:
        print(f"✓ {nom_modele} OK")

print("\n✅ Tous les modèles sont installés et vérifiés")