# SpeechCore — Guide utilisateur (démo)

Application de transcription audio médicale en temps réel. Elle convertit la parole en texte depuis le microphone et peut remplir automatiquement un formulaire médical à partir de la transcription.

---

## Prérequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installé et démarré
- Un navigateur moderne (Chrome ou Edge recommandé)
- Un microphone fonctionnel

---

## Configurer les clés API (optionnel)
Pour utiliser les moteurs de transcription cloud (Groq ou Gladia), vous devez fournir une clé API. Si vous n'en avez pas, vous pouvez toujours utiliser les moteurs locaux (Whisper ou Vosk) qui ne nécessitent aucune configuration.

1. créez un fichier `.env` à la racine du projet (au même niveau que `docker-compose.yml`) avec le contenu suivant :

```
GROQ_API_KEY=votre_cle_groq_ici
GLADIA_API_KEY=votre_cle_gladia_ici
```

Redémarrez ensuite l'application pour que les clés soient prises en compte (sans supprimer les conteneurs) :
```bash
docker compose -f new_transcription/docker-compose.yml up --no-build
```

## Lancement

Ouvrez un terminal dans le dossier du projet et exécutez :

```bash
docker compose -f new_transcription/docker-compose.yml up --build
```

> **Premier démarrage uniquement** : l'application télécharge les modèles de transcription (~1,5 Go). Cela peut prendre 5 à 10 minutes selon votre connexion. C'est normal — les lancements suivants sont instantanés.

Une fois prêt, vous verrez dans les logs :
```
frontend  | VITE ready in ...
```

Ouvrez ensuite **http://localhost:5173** dans votre navigateur.

---

## Arrêt

```bash
# Dans le terminal où docker compose tourne :
Ctrl+C

# Ou depuis un autre terminal :
docker compose -f new_transcription/docker-compose.yml down
```

---

## Utilisation

### Page "Consultation" — Transcription en direct

1. **Choisissez le moteur** en cliquant sur "⚙️ Paramètres" :
   - **Whisper** — meilleure précision (recommandé), tourne en local
   - **Vosk** — plus rapide, tourne en local
   - **Groq** — cloud, très rapide (nécessite une clé API)
   - **Gladia** — cloud, meilleure qualité (nécessite une clé API)

2. **Réglez la durée chunk** : 5 secondes est recommandé pour Whisper, 1-2 secondes pour Vosk.

3. **Cliquez sur "Démarrer la transcription"** — autorisez l'accès au microphone si demandé.

4. **Parlez** : le texte apparaît par blocs au rythme de la durée chunk choisie.

5. **Arrêtez** avec le bouton rouge, puis **sauvegardez** pour conserver l'enregistrement.

> Le log réseau en bas de page affiche les échanges WebSocket en temps réel — utile pour vérifier que tout fonctionne.

---

### Page "Formulaire" — Remplissage automatique par IA

> Nécessite [Ollama](https://ollama.com) installé sur votre machine avec le modèle Mistral : `ollama pull mistral`

1. Faites d'abord un enregistrement depuis la page "Consultation" et sauvegardez-le.
2. Allez sur la page "Formulaire".
3. **Sélectionnez l'enregistrement** dans la liste déroulante.
4. Cliquez sur **"Remplir automatiquement avec l'IA"** — les champs se remplissent.
5. Vérifiez, corrigez si besoin, puis **sauvegardez le formulaire**.

---

## Moteurs disponibles

| Moteur | Type | Qualité | Vitesse | Clé API requise |
|--------|------|---------|---------|-----------------|
| Whisper | Local | Très bonne | Moyenne | Non |
| Vosk | Local | Bonne | Rapide | Non |
| Groq | Cloud | Excellente | Très rapide | Oui (`GROQ_API_KEY`) |
| Gladia | Cloud | Excellente | Rapide | Oui (`GLADIA_API_KEY`) |

Pour configurer une clé API, créez un fichier `.env` à côté du `docker-compose.yml` :

```
GROQ_API_KEY=votre_cle_ici
GLADIA_API_KEY=votre_cle_ici
```

---

## Problèmes courants

**Le microphone ne fonctionne pas**
→ Vérifiez que vous avez autorisé l'accès dans les permissions du navigateur (icône cadenas dans la barre d'adresse).

**"Impossible de joindre le serveur (port 8000)"**
→ Le conteneur `api-websocket` n'est pas encore prêt. Attendez que les modèles aient fini de charger et rafraîchissez la page.

**L'IA ne remplit pas le formulaire**
→ Ollama doit être lancé sur votre machine (`ollama serve`) avec le modèle Mistral installé (`ollama pull mistral`).

**Le texte est en mauvais français**
→ Parlez clairement, à un rythme normal. Avec Whisper, augmentez la durée chunk à 5 s pour de meilleurs résultats.
