# iweb FleetGuard 🛡️

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![PHP](https://img.shields.io/badge/php-%3E%3D%207.4-8892BF.svg)
![WordPress](https://img.shields.io/badge/WordPress-%3E%3D%205.0-21759b.svg)
![Security](https://img.shields.io/badge/SecOps-Active-success.svg)

**iweb FleetGuard** est une architecture SecOps sur-mesure et une plateforme de surveillance centralisée conçue pour sécuriser et auditer un parc complet d'applications e-commerce et vitrines sous WordPress. 

Ce projet permet de passer d'une sécurité réactive (site par site) à une posture proactive et centralisée, garantissant l'intégrité des données clients et la réputation de l'agence.

---
### ⚙️ Installation & Démarrage rapide

1. **Cloner le dépôt :**
   
  ```bash
   git clone [https://github.com/votre-compte/iweb-fleetguard.git](https://github.com/votre-compte/iweb-fleetguard.git)
   cd iweb-fleetguard

```

2. **Configuration de la sécurité (Variables d'environnement) :**
Pour des raisons de sécurité (Security by Design), la clé de chiffrement maîtresse n'est pas versionnée. Avant de lancer l'infrastructure, vous devez générer la vôtre.
Créez un fichier `.env` à la racine du projet :
```bash
touch .env

```

Générez une clé Fernet (AES) valide et injectez-la dans le fichier `.env` en exécutant cette commande :
```bash
python -c "from cryptography.fernet import Fernet; print(f'ENCRYPTION_KEY={Fernet.generate_key().decode()}')" >> .env
```

*(Assurez-vous que le fichier `.env` contient bien une ligne du type : `ENCRYPTION_KEY=votreclegénérée...`)*
3. **Lancement de l'infrastructure :**
```bash
docker compose up -d
```


--------------------------------------------------------

## 🏗️ Phase 1 : Architecture du Projet

Le système repose sur une architecture distribuée de type **Maître / Agent** :
1. **L'Agent (Client) :** Un *Must-Use Plugin* léger installé sur chaque site WordPress du parc.
2. **Le Serveur Central (Maître) :** L'API et le tableau de bord (Tour de Contrôle) qui interrogent les agents et consolident les données de sécurité.

---

## 📄 1. Documentation : iwebCreative Security Agent (Client)

Cette section documente le fichier `iwebcreative-agent.php`, la brique "Client" déployée sur les sites cibles.

### 1. Présentation Générale
L'agent est un script PHP autonome agissant comme une sonde de surveillance décentralisée. Déployé sous forme de **Must-Use Plugin (mu-plugin)**, il s'exécute silencieusement en arrière-plan et ne peut pas être désactivé accidentellement depuis l'interface d'administration WordPress.

### 2. Objectif et Rôle
L'agent remplit deux missions critiques :
* **Audit Continu (Lecture seule) :** Remonter l'état de santé du site (versions du cœur WP, version PHP, état et versions des extensions) pour détecter les vulnérabilités liées aux composants obsolètes.
* **Système de Détection d'Intrusion (IDS) :** Écouter activement le comportement du site via les *Hooks* natifs de WordPress pour capturer et journaliser les actions suspectes ou malveillantes.

### 3. Architecture de Sécurité (Zero Trust)
L'agent est conçu selon le principe du moindre privilège :
* **Protection des fichiers :** Blocage natif de l'exécution directe du script via l'URL.
* **Authentification Forte :** L'accès à l'API de l'agent est strictement verrouillé par un jeton de sécurité cryptographique (`Bearer Token`). Seule la Tour de Contrôle possédant ce jeton exact est autorisée à récupérer les données.

### 4. Événements de Sécurité Surveillés (SecOps Logger)
Le script écoute silencieusement le cœur de WordPress et utilise un système de cache local FIFO (limité aux 50 derniers événements sur 24h) pour repérer les anomalies suivantes :
* 🔴 **Élévation de Privilèges (Backdoor) :** Attribution du rôle "Administrateur" à un utilisateur.
* 🔴 **Détournement de Propriété :** Modification de l'adresse e-mail de l'administration globale.
* 🟠 **Attaques Brute Force :** Tentatives de connexion échouées (`wp-admin`).
* 🟠 **Altération Visuelle / Code :** Changement du thème actif.
* 🟡 **Sabotage des Défenses :** Désactivation d'une extension.
* 🟡 **Compromission de Compte :** Réinitialisations de mots de passe réussies.

---

## 🚀 Installation de l'Agent

Pour déployer l'agent sur un site client :

1. Accédez aux fichiers du site WordPress via FTP/SFTP ou via votre dépôt Git.
2. Naviguez vers le répertoire `wp-content`.
3. Si le dossier `mu-plugins` n'existe pas, créez-le.
4. Déposez le fichier `iwebcreative-agent.php` dans `wp-content/mu-plugins/`.
5. Modifiez la constante `IWEB_AGENT_SECRET_TOKEN` dans le fichier pour définir une clé unique.
6. L'agent est immédiatement actif.


## 🏗️ Phase 2 : La Tour de Contrôle Centrale (Backend API)

Cette phase constitue le cœur du projet **iweb FleetGuard**. Il s'agit du serveur central chargé de réceptionner, traiter, authentifier et stocker de manière permanente les événements de sécurité remontés par le parc de sites WordPress.

### 🛠️ Stack Technologique
* **Langage & Framework :** Python 3.11 avec **FastAPI**. Choisi pour ses performances asynchrones élevées, sa génération automatique de documentation (Swagger), et sa préparation à l'intégration future de modèles d'Intelligence Artificielle.
* **Base de Données :** **PostgreSQL 15**, géré via l'ORM **SQLAlchemy**.
* **Validation des Données :** **Pydantic**, pour bloquer instantanément les requêtes malformées ou malveillantes.
* **Infrastructure :** Conteneurisation complète du backend, de la base de données et de l'interface d'administration (Adminer) via **Docker** (`docker-compose`).

### 🗄️ Architecture des Données
La base de données relationnelle s'articule autour de trois modèles définis dans `models.py` :
1. **`client_sites` :** Le registre d'inventaire du parc. Stocke les URLs des sites clients et leurs jetons de communication.
2. **`security_alerts` :** Le coffre-fort des logs. Stocke l'historique complet des alertes (type, sévérité, IP de l'attaquant, message), lié au site cible via une clé étrangère.
3. **`dashboard_admins` :** La gestion des identités et des accès (IAM) pour les administrateurs du futur tableau de bord visuel.

### 🔒 Sécurité Intégrée (Security by Design)
L'API a été conçue avec des standards stricts de cybersécurité :
* **Authentification par Bearer Token :** La route `/api/alerts` rejette toute requête (HTTP 401/403) ne présentant pas un jeton d'agent valide.
* **Chiffrement au Repos (Encryption at Rest) :** Les jetons de communication ne sont jamais stockés en clair. Ils sont chiffrés dans PostgreSQL à l'aide de l'algorithme **Fernet (AES)** via un `TypeDecorator` personnalisé dans SQLAlchemy. L'API les déchiffre dynamiquement en mémoire uniquement lors de la vérification.

### 🚀 Déploiement de l'Environnement de Développement
L'infrastructure s'instancie de manière totalement isolée et automatisée :

```bash
# Lancement de l'API, de la base PostgreSQL et d'Adminer
docker compose up -d

### Exemple de requête de test (cURL)
```bash
curl -X GET [https://site-client.com/wp-json/iwebcreative/v1/health](https://site-client.com/wp-json/iwebcreative/v1/health) \
  -H "Authorization: Bearer VOTRE_TOKEN_SECRET"




👨‍💻 Auteur
Hamza Bourras Élève Ingénieur en Cybersécurité et Confiance Numérique (CCN) Projet réalisé dans le cadre de la mise en place d'une infrastructure SecOps globale.