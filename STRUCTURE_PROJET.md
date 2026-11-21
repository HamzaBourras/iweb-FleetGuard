"La plateforme iweb FleetGuard a été conçue selon une architecture modulaire hybride, respectant les normes de développement sécurisé (DevSecOps) et le principe de séparation des responsabilités (Separation of Concerns). Le système s'articule autour de trois piliers fondamentaux : un Backend développé en Python (FastAPI) agissant comme le cerveau analytique, un Frontend React servant de console opérationnelle (SOC), et des sondes distantes (agents PHP) déployées sur les actifs cibles. Les services centraux sont conteneurisés à l'aide de Docker ; l'agent WordPress est déployé séparément sur chaque site supervisé. L'arborescence détaillée ci-dessous illustre l'organisation logique du code source et la structuration des composants métiers."

IWEB-FLEETGUARD/                 # Racine du projet (Plateforme SOC)
│
├── backend/                     # 🧠 API REST FastAPI (Le cerveau central)
│   ├── app/                     # Code source principal de l'application backend
│   │   ├── models/              # Modèles de données (SQLAlchemy ORM)
│   │   │   └── models.py        # Tables métier, notifications, réinitialisation et chiffrement Fernet
│   │   ├── routers/             # Contrôleurs : Points de terminaison (Endpoints) de l'API
│   │   │   ├── agent.py         # Planificateur APScheduler : pings toutes les 2h et scans automatiques
│   │   │   ├── alerts.py        # Réception des alertes envoyées par les agents (Mode Push)
│   │   │   ├── auth.py          # Authentification, JWT, et logique MFA (TOTP, codes de secours)
│   │   │   ├── dashboard.py     # Statistiques globales et système de notifications in-app
│   │   │   └── sites.py         # Gestion du parc (CRUD), investigations (SBOM, Malware) et remédiation
│   │   ├── schemas/             # Schémas de validation Pydantic (Entrées/Sorties de l'API)
│   │   │   └── schemas.py       # Validation stricte des données (ex: SiteCreate, AdminLogin)
│   │   ├── security/            # Sécurité applicative et cryptographie
│   │   │   ├── security.py      # Fernet/MultiFernet, hachage bcrypt et génération JWT
│   │   │   ├── signing.py       # Signature HMAC-SHA256 et protection anti-rejeu des agents
│   │   │   └── url_validator.py # Validation des URL publiques et protection SSRF
│   │   ├── services/            # Services externes et utilitaires
│   │   │   ├── agent_client.py  # Appels signés vers les agents WordPress distants
│   │   │   ├── email_service.py # Envoi des alertes et notifications par SMTP
│   │   │   └── health.py        # Recalcul du score de santé des sites
│   │   ├── rate_limit.py        # Limitation du débit des routes sensibles
│   │   ├── database.py          # Configuration de la connexion PostgreSQL (SessionLocal)
│   │   └── dependencies.py      # Middlewares d'injection (get_db, vérification du cookie Admin)
│   ├── alembic/                 # Migrations et configuration du schéma de base
│   ├── Dockerfile               # Recette de conteneurisation du backend Python
│   ├── scripts/                 # Scripts d'administration et de migration
│   ├── main.py                  # Point d'entrée de l'API, configuration CORS et montage des routeurs
│   └── requirements.txt         # Dépendances Python (FastAPI, SQLAlchemy, PyOTP, apscheduler...)
│
├── frontend/                    # 🖥️ Interface Utilisateur React (Le Tableau de Bord SOC)
│   ├── public/                  # Fichiers statiques publics (icônes et favicon)
│   ├── src/                     # Code source de l'application React
│   │   ├── assets/              # Ressources graphiques (Logos, illustrations)
│   │   ├── components/          # Composants UI isolés et réutilisables
│   │   │   ├── ChangePasswordModal.jsx # Modale de modification sécurisée du mot de passe
│   │   │   ├── MfaSetupModal.jsx       # Assistant d'activation du MFA (Génération du QR Code)
│   │   │   ├── NotificationDropdown.jsx # Menu interactif des notifications système
│   │   │   ├── RecoveryCodesModal.jsx  # Générateur de codes de secours d'urgence
│   │   │   ├── SystemClock.jsx         # Horloge locale de l'interface SOC
│   │   │   └── FileInspectionModal.jsx # Consultation sécurisée du contenu d'un fichier inspecté
│   │   ├── router/              # Logique de navigation et protection des routes
│   │   │   ├── ProtectedRoute.jsx      # Gardien interdisant l'accès sans cookie JWT valide
│   │   │   └── PublicRoute.jsx         # Gardien redirigeant les utilisateurs déjà connectés
│   │   ├── views/               # Pages principales (Vues) de l'interface
│   │   │   ├── Dashboard.jsx           # Layout principal (Sidebar dynamique, Header)
│   │   │   ├── Guide.jsx               # Centre de documentation technique interactif
│   │   │   ├── Login.jsx               # Portail d'authentification (Avec vérification MFA)
│   │   │   ├── Overview.jsx            # Tableau de bord principal (Statistiques, Graphiques KPI)
│   │   │   ├── Profile.jsx             # Espace de gestion des paramètres de sécurité de l'admin
│   │   │   ├── SecurityAlerts.jsx      # Journal global pour l'analyse forensique (Triage)
│   │   │   ├── SiteInvestigation.jsx   # Console de réponse aux incidents (IR) d'un site cible
│   │   │   ├── SitesList.jsx           # Gestionnaire du parc informatique avec "Live Status"
│   │   │   └── ResetPassword.jsx       # Réinitialisation du mot de passe
│   │   ├── utils/                      # Utilitaires frontend
│   │   │   ├── apiErrors.js            # Normalisation des erreurs de l'API
│   │   │   └── passwordPolicy.js       # Règles de validation des mots de passe
│   │   ├── App.jsx              # Routeur principal orchestrant l'arborescence des vues
│   │   ├── index.css            # Styles globaux et configuration des animations Tailwind CSS
│   │   └── main.jsx             # Point de montage de l'application React dans le DOM
│   ├── .dockerignore            # Fichiers exclus du build Docker (node_modules, dist)
│   ├── Dockerfile               # Recette de conteneurisation du frontend (Node.js/Alpine)
│   ├── package.json             # Dépendances Node.js (React, Lucide, Recharts, Tailwind...)
│   ├── tailwind.config.js       # Configuration du framework de style (Couleurs, Polices)
│   └── vite.config.js           # Configuration du bundler Vite.js pour le développement
│
├── mu-plugins/                  # 🛡️ Agent distant (Sonde) à déployer chez les clients
│   └── iwebcreative-agent.php   # Plugin WordPress Must-Use (WAF/IDS, API REST, Scanner EDR)
│
│
├── docker-compose.yml           # 🐳 Orchestrateur liant l'API, le Frontend, PostgreSQL et Adminer
├── .env                         # 🔐 Configuration locale sensible, à ne jamais versionner
├── .env.example                 # Modèle des variables d'environnement (Fernet, JWT, BDD, SMTP)
├── .gitignore                   # 🚫 Fichiers à ne pas versionner sur Git (ex: .env)
└── README.md                    # 📖 Documentation principale d'introduction au dépôt