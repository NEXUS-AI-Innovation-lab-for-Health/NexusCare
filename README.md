# OncoCollab

Plateforme de visioconférence médicale collaborative avec génération de rapports IA, conçue pour les équipes oncologiques.

---

## Architecture

```
OncoCollab/
├── rest-api/              # API REST (NestJS + PostgreSQL + Redis)
├── websocket/             # Serveur de signalisation WebRTC (Socket.IO)
├── visio-app/             # Frontend (React + Vite + Tailwind CSS)
├── generation_rapport/    # Service IA de génération de rapports (FastAPI)
├── docker-compose.yml     # Orchestration développement
└── docker-compose.prod.yml # Déploiement production (Traefik + Let's Encrypt)
```

### Services et ports (développement)

| Service             | Technologie              | Port  |
|---------------------|--------------------------|-------|
| `rest-api`          | NestJS 11 / Node 20      | 3000  |
| `websocket`         | Express + Socket.IO 4    | 4000  |
| `visio-app`         | React 19 / Vite 7        | 5173  |
| `generation_rapport`| FastAPI / Python 3.11    | 8000  |
| `postgres`          | PostgreSQL 16-alpine     | 5432  |
| `redis`             | Redis 7-alpine           | 6379  |
| `coturn`            | STUN/TURN (optionnel)    | 3478  |

---

## Stack technique

**Backend**
- NestJS (TypeScript) — API REST
- Prisma — ORM type-safe PostgreSQL
- Socket.IO — signalisation WebRTC (offres SDP, ICE candidates)
- Argon2 — hachage des mots de passe
- Redis — cache et streams d'événements temps réel

**Frontend**
- React + TypeScript
- React Router DOM
- Socket.IO Client 
- Tailwind CSS 

**Génération de rapports**
- FastAPI — API Python
- OpenAI Whisper — transcription audio
- Google Gemini API — structuration IA du rapport
- ReportLab — export PDF

**Infrastructure**
- Docker Compose (dev + prod)
- Traefik — reverse proxy avec SSL automatique (Let's Encrypt)
- coturn (dev) / metered.ca (prod) — serveur STUN/TURN pour WebRTC

---

## Prérequis

- Docker & Docker Compose
- Node.js ≥ 20 et npm ≥ 10 (pour développement local hors Docker)
- `mkcert` — HTTPS local (optionnel mais recommandé pour le dev)
- `ngrok` — exposition locale (optionnel)
- Pas connecter à eduroam

---

## Démarrage rapide — développement

### 1. Configuration de l'environnement

```bash
cp .env.example .env
```

Remplir les variables minimales dans `.env` :

```env
# Base de données
DATABASE_URL=postgresql://admin:password123@postgres:5432/oncocollab
REDIS_URL=redis://redis:6379

# URLs des services
API_URL=http://localhost:3000
WEBSOCKET_URL=http://localhost:4000
VITE_API_URL=http://localhost:3000
VITE_WS_URL=http://localhost:4000
REPORT_API_URL=http://localhost:8000

# WebRTC / STUN-TURN
VITE_STUN_URL=stun:stun.l.google.com:19302
VITE_TURN_URL=turn:localhost:3478
VITE_TURN_USERNAME=admin
VITE_TURN_PASSWORD=password
EXTERNAL_IP=192.168.x.x   # IP locale de la machine hôte linux : ip a / windows : ipconfig

# Génération de rapports
GEMINI_API_KEY=           # https://aistudio.google.com/api-keys
ORGANIZATION_NAME=OncoCollab
```

### 2. Lancer le stack complet

```bash
docker compose up --build -d
```

### 3. Commandes utiles

```bash
# Logs d'un service
docker compose logs -f rest-api

# Arrêter et supprimer les conteneurs
docker compose down

# Reconstruire un service spécifique
docker compose up --build -d visio-app
```

---

## Développement local (sans Docker)

Chaque service peut être lancé indépendamment mais pas recommandé de le faire. PostgreSQL et Redis doivent rester dans Docker.

```bash
# Démarrer uniquement la base de données et Redis
docker compose up -d postgres redis
```

**REST API**
```bash
cd rest-api
npm install
npm run start:dev        # http://localhost:3000
# Swagger : http://localhost:3000/api
```

**WebSocket**
```bash
cd websocket
npm install
npm run dev              # http://localhost:4000
```

**Frontend**
```bash
cd visio-app
npm install
npm run dev              # http://localhost:5173
```

**Génération de rapports**
```bash
# Via Docker (recommandé, dépendances lourdes : PyTorch, Whisper, FFmpeg)
docker compose up -d generation_rapport
```

---

## Base de données

Le schéma Prisma est situé dans [rest-api/prisma/schema.prisma](rest-api/prisma/schema.prisma).

**Modèles principaux**

| Modèle              | Description                                                  |
|---------------------|--------------------------------------------------------------|
| `User`              | Compte utilisateur avec profession et rôle admin             |
| `Profession`        | Spécialités médicales avec code couleur                      |
| `Meeting`           | Réunion avec salle WebRTC, statut et participants            |
| `MeetingParticipant`| Participation avec dossier patient et visibilité             |
| `PatientRecord`     | Dossier patient flexible (champ JSON) par profession         |
| `Message`           | Messages de chat persistants par salle                       |
| `Group`             | Groupes chat                                                 |

**Migrations Prisma**
Au cas où s'il y a un soucis
```bash
cd rest-api

# Appliquer les migrations existantes
npx prisma migrate deploy

# Créer une nouvelle migration (dev)
npx prisma migrate dev --name nom_migration

# Inspecter la base via Prisma Studio
npx prisma studio
```

---

## Déploiement production

La production utilise Traefik comme reverse proxy avec SSL automatique via Let's Encrypt.

### 1. Configuration

```bash
cp .env.prod.example .env.prod
```

Variables clés à renseigner dans `.env.prod` :

```env
# Domaine
DOMAIN=oncocollab.example.com
ACME_EMAIL=admin@example.com

# Base de données
POSTGRES_DB=oncocollab
POSTGRES_USER=oncocollab_prod
POSTGRES_PASSWORD=<mot_de_passe_fort>

# Redis
REDIS_PASSWORD=<mot_de_passe_fort>

# Dashboard Traefik (basic auth)
TRAEFIK_DASHBOARD_AUTH=admin:<hash_bcrypt>

# APIs externes
GEMINI_API_KEY=<votre_clé>
VITE_METERED_API_KEY=<votre_clé_metered>

# WebRTC
EXTERNAL_IP=<ip_publique_du_serveur>
```

### 2. Déploiement

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up --build -d
```

### 3. Routing Traefik (production)

| Service             | URL                                |
|---------------------|------------------------------------|
| Frontend            | `https://app-{DOMAIN}`            |
| REST API            | `https://api-{DOMAIN}`            |
| WebSocket           | `https://ws-{DOMAIN}`             |
| Rapport             | `https://report-{DOMAIN}`         |
| Dashboard Traefik   | `https://traefik.{DOMAIN}`        |

---

## Structure des modules NestJS

```
rest-api/src/
├── auth/          # Authentification (register, login, Argon2)
├── users/         # Gestion des utilisateurs et profils
├── meetings/      # Réunions, salles et statuts
├── messages/      # Chat persistant par salle
├── professions/   # Spécialités médicales
├── groups/        # Groupes d'utilisateurs
└── events/        # Redis streams pour événements temps réel
```

---

## Variables d'environnement — référence complète

Voir [.env.example](.env.example) pour le développement et [.env.prod.example](.env.prod.example) pour la production.

---

## Contact

Pour toute question ou problème, contacter :

- Discord : `_.cedric` ou `pinkysheeep`
- Mail : [lokcedriclok@gmail.com](mailto:lokcedriclok@gmail.com)
