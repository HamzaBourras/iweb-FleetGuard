"La plateforme iweb FleetGuard a été conçue selon une architecture modulaire hybride, respectant les normes de développement sécurisé (DevSecOps) et le principe de séparation des responsabilités (Separation of Concerns). Le système s'articule autour de trois piliers fondamentaux : un Backend haute performance développé en Python (FastAPI) agissant comme le cerveau analytique, un Frontend réactif (React.js) servant de console opérationnelle (SOC), et des Sondes distantes (Agents PHP) déployées de manière asynchrone sur les actifs cibles. Afin de garantir la portabilité, l'extensibilité et l'isolation des services, l'intégralité de l'infrastructure est conteneurisée à l'aide de Docker. L'arborescence détaillée ci-dessous illustre l'organisation logique du code source, mettant en évidence les flux de communication sécurisés et la structuration des composants métiers."

IWEB-FLEETGUARD/                 # Racine du projet (Plateforme SOC)
│
├── backend/                     # 🧠 API REST FastAPI (Le cerveau central)
│   ├── app/                     # Code source principal de l'application backend
│   │   ├── models/              # Modèles de données (SQLAlchemy ORM)
│   │   │   └── models.py        # Structure des tables (Sites, Alertes, Admins) et chiffrement Fernet
│   │   ├── routers/             # Contrôleurs : Points de terminaison (Endpoints) de l'API
│   │   │   ├── agent.py         # Planificateur (CRON) pour les pings horaires et scans automatiques
│   │   │   ├── alerts.py        # Réception des alertes envoyées par les agents (Mode Push)
│   │   │   ├── auth.py          # Authentification, JWT, et logique MFA (TOTP, codes de secours)
│   │   │   ├── dashboard.py     # Statistiques globales et système de notifications in-app
│   │   │   └── sites.py         # Gestion du parc (CRUD), investigations (SBOM, Malware) et remédiation
│   │   ├── schemas/             # Schémas de validation Pydantic (Entrées/Sorties de l'API)
│   │   │   └── schemas.py       # Validation stricte des données (ex: SiteCreate, AdminLogin)
│   │   ├── security/            # Moteur cryptographique
│   │   │   └── security.py      # Chiffrement symétrique, Hachage Bcrypt, et Génération JWT
│   │   ├── services/            # Services externes et utilitaires
│   │   │   └── email_service.py # Envoi d'alertes par email (SMTP) via templates HTML sécurisés
│   │   ├── database.py          # Configuration de la connexion PostgreSQL (SessionLocal)
│   │   └── dependencies.py      # Middlewares d'injection (get_db, vérification du cookie Admin)
│   ├── Dockerfile               # Recette de conteneurisation du backend Python
│   ├── main.py                  # Point d'entrée de l'API, configuration CORS et montage des routeurs
│   └── requirements.txt         # Dépendances Python (FastAPI, SQLAlchemy, PyOTP, apscheduler...)
│
├── frontend/                    # 🖥️ Interface Utilisateur React (Le Tableau de Bord SOC)
│   ├── public/                  # Fichiers statiques publics (Favicon, robots.txt)
│   ├── src/                     # Code source de l'application React
│   │   ├── assets/              # Ressources graphiques (Logos, illustrations)
│   │   ├── components/          # Composants UI isolés et réutilisables
│   │   │   ├── ChangePasswordModal.jsx # Modale de modification sécurisée du mot de passe
│   │   │   ├── MfaSetupModal.jsx       # Assistant d'activation du MFA (Génération du QR Code)
│   │   │   ├── NotificationDropdown.jsx# Menu interactif des alertes système en temps réel
│   │   │   ├── RecoveryCodesModal.jsx  # Générateur de codes de secours d'urgence
│   │   │   └── SystemClock.jsx         # Horloge locale détectant le fuseau horaire de l'agent SOC
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
│   │   │   └── SitesList.jsx           # Gestionnaire du parc informatique avec "Live Status"
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
├── Files/                       # 📁 (Dossier optionnel : Ressources du projet, maquettes, tests)
│
├── docker-compose.yml           # 🐳 Orchestrateur liant l'API, le Frontend, PostgreSQL et Adminer
├── .env                         # 🔐 Variables d'environnement sensibles (Clé AES, IDs BDD, SMTP)
├── .gitignore                   # 🚫 Fichiers à ne pas versionner sur Git (ex: .env)
└── README.md                    # 📖 Documentation principale d'introduction au dépôt