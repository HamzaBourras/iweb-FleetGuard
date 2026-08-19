# iweb FleetGuard 🛡️

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![PHP](https://img.shields.io/badge/php-%3E%3D%207.4-8892BF.svg)
![WordPress](https://img.shields.io/badge/WordPress-%3E%3D%205.0-21759b.svg)
![Security](https://img.shields.io/badge/SecOps-Active-success.svg)

**iweb FleetGuard** est une architecture SecOps sur-mesure et une plateforme de surveillance centralisée conçue pour sécuriser et auditer un parc complet d'applications e-commerce et vitrines sous WordPress. 

Ce projet permet de passer d'une sécurité réactive (site par site) à une posture proactive et centralisée, garantissant l'intégrité des données clients et la réputation de l'agence.

---
C'est une excellente déduction ! Puisque tu viens d'ajouter un fichier `.env.example` complet (avec la base de données, le SMTP, etc.), ton ancienne méthode qui ajoutait juste la clé à la fin d'un fichier vide n'est plus adaptée.

Il faut maintenant indiquer aux utilisateurs de copier le fichier d'exemple, puis de générer la clé pour remplacer la valeur par défaut.

Voici la version mise à jour, parfaite et professionnelle, à copier-coller dans ton `README.md` :


### ⚙️ Installation & Démarrage rapide

1. **Cloner le dépôt :**
   ```bash
   git clone [https://github.com/HamzaBourras/iweb-FleetGuard](https://github.com/HamzaBourras/iweb-FleetGuard)
   cd iweb-FleetGuard
```


2. **Configuration de l'environnement (.env) :**
Par mesure de sécurité (Security by Design), les secrets d'infrastructure ne sont pas versionnés. Un fichier modèle est fourni pour faciliter le déploiement.
Copiez le fichier d'exemple pour créer votre propre fichier `.env` :
```bash
cp .env.example .env
```



Ouvrez ensuite le fichier `.env` avec votre éditeur pour configurer vos accès PostgreSQL et vos identifiants SMTP.*
3. **Génération de la clé cryptographique maîtresse :**
La plateforme nécessite une clé de chiffrement (Fernet/AES) pour sécuriser les jetons de communication avec les agents distants. Générez une clé valide en exécutant cette commande :
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

```


Copiez la chaîne de caractères affichée dans le terminal, et collez-la dans votre fichier `.env` à la ligne `ENCRYPTION_KEY=...*`
4. **Lancement de l'infrastructure :**
Une fois l'environnement configuré, démarrez l'ensemble des conteneurs (PostgreSQL, Backend API, Frontend React et Adminer) en arrière-plan :
```bash
docker compose up -d --build

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

Pour garantir l'intégrité de l'infrastructure (Zero-Trust), le jeton d'authentification n'est plus codé en dur dans le plugin, mais injecté directement à la racine du serveur.

1. Déclaration : Ajoutez le nouveau site depuis le tableau de bord FleetGuard et copiez le jeton cryptographique généré.

2. Transfert : Connectez-vous au serveur du site client via SFTP et placez le fichier iwebcreative-agent.php dans le répertoire /wp-content/mu-plugins/ (ou /plugins/).

3. Verrouillage Cryptographique : Ouvrez le fichier wp-config.php situé à la racine du site WordPress.

4. Configuration : Ajoutez la ligne define( 'IWEB_AGENT_SECRET_TOKEN', 'VOTRE_JETON_COPIE_ICI' ); juste avant la ligne "That's all, stop editing!".


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
```

## 🖥️ Phase 3 : Le Centre de Commandes (Dashboard React)

Le tableau de bord (Frontend) constitue la "Tour de Contrôle" (*Single Pane of Glass*) de l'infrastructure iweb FleetGuard. Développé en **React** et stylisé avec **Tailwind CSS**, il permet aux administrateurs de sécurité d'avoir une visibilité et une réactivité en temps réel sur l'ensemble du parc cible.

L'interface est structurée autour de trois espaces de travail distincts :

### 📊 1. Vue d'ensemble (Overview)
Le centre de pilotage principal offrant une vision macroscopique de la santé de la flotte.
* **Indicateurs Clés de Sécurité (KPIs) :** Affichage immédiat du nombre de capteurs actifs, du volume d'alertes interceptées sur les dernières 24h, et du ratio de sites sains par rapport aux sites subissant des attaques.
* **Analyse de Tendances :** Visualisation globale permettant d'identifier rapidement les pics d'activité malveillante ou les campagnes d'attaques coordonnées sur le parc.

### 🌐 2. Gestion de la Flotte (Sites)
Le module de provisionnement et de supervision (*Fleet Management*) des capteurs déployés.
* **Provisionnement Sécurisé :** Ajout de nouvelles cibles avec génération automatique d'un jeton d'authentification cryptographique à très haute entropie.
* **Architecture "Read-Once" :** Pour contrer les risques de fuites de données (*Data Breach*), le jeton de l'agent n'est affiché en clair qu'une seule et unique fois lors de sa création. L'interface masque ensuite définitivement la donnée, le serveur ne conservant qu'une empreinte hachée (`bcrypt`).
* **Observabilité Continue :** Suivi dynamique du statut des agents (Actif, Hors ligne, Compromis) permettant de détecter instantanément le sabotage ou la désactivation d'une sonde sur un site client.

### 🚨 3. Centre d'Opérations de Sécurité (Alerts)
Le cœur réactif du système (SecOps), conçu pour l'analyse des incidents et la qualification des menaces.
* **Flux en Temps Réel :** Réception et affichage asynchrone des *payloads* d'attaques expédiés par les agents WordPress à travers le tunnel sécurisé.
* **Triage par Criticité :** Les événements sont automatiquement classifiés par niveau de sévérité (Critique, Élevée, Moyenne, Faible) à l'aide de badges visuels stricts pour prioriser la réponse à incident.
* **Traçabilité Forensique :** Chaque log consigne le type d'attaque (ex: *Brute Force*, *Élévation de privilèges*), le message de l'agent, le timestamp exact, et l'adresse IP de l'attaquant pour faciliter la mise en place de règles de pare-feu (WAF).

### 🔍 4. Console d'Investigation Forensique (Site Details)
Le module d'analyse profonde et de réponse aux incidents (IR - Incident Response) dédié à un actif spécifique.
* **Threat Intelligence & SBOM :** Évaluation dynamique de la vétusté des composants. Le système cartographie l'environnement PHP, le noyau WordPress et les extensions. Il signale instantanément les versions obsolètes ou les mises à jour en attente.
* **Scanner Heuristique & Remédiation :** Lancement d'analyses anti-malware à distance pour détecter les Web Shells ou le code obfusqué. L'analyste peut procéder à la destruction irréversible des *payloads* malveillants ou à leur mise en liste blanche (gestion des faux positifs).
* **Playbook SecOps Intégré :** Pour chaque alerte interceptée sur le site, le système fournit une analyse détaillée de la menace et propose des actions de remédiation concrètes pour guider l'opérateur.
* **Gestion Cryptographique (Key Rotation) :** Mécanisme d'urgence permettant de révoquer l'accès d'une cible compromise et de générer un nouveau jeton de communication à la volée, sans perdre l'historique des attaques.
* **Politique d'Auto-Scan :** Activation ou désactivation de la surveillance asynchrone (tâches CRON de 24h) spécifique à cet environnement.


## ⚔️ Phase 4 : Déploiement en Production & Red Teaming (Simulation d'Attaques)

Cette phase valide la chaîne de communication de bout en bout entre le site client en production et la Tour de Contrôle locale, en utilisant des techniques de contournement administratif et des simulations d'attaques réelles (Pentesting).

### 1. Génération du Jeton (Read-Once)
Pour respecter le principe de *Zero Trust* et limiter le rayon d'impact (Blast Radius) en cas de compromission d'un serveur client :
1. Chaque site cible nécessite son propre jeton d'authentification unique.
2. Le jeton est généré par l'API (FastAPI) lors de l'ajout du site depuis le tableau de bord React.
3. **Sécurité :** Le backend applique un hachage cryptographique (`bcrypt`) avant l'enregistrement en base de données. Le jeton en clair n'est affiché qu'une seule et unique fois à l'administrateur (Read-Once).

### 2. Déploiement Furtif de l'Agent via SFTP
Le déploiement manuel garantit que l'agent est installé proprement sans passer par les installeurs standards de WordPress.

1. Connexion au serveur d'hébergement du site cible (ex: `i-webcreative.com`) à l'aide d'un client sécurisé comme **WinSCP**.
2. Navigation vers le répertoire des extensions : `/public_html/wp-content/plugins/`.
3. Création d'un répertoire dédié `iwebcreative-agent` et transfert du fichier PHP préconfiguré avec l'URL de l'API et le jeton en clair.
4. **Bypass des restrictions d'accès (Hardening) :** Si le site masque sa page de connexion `/wp-admin` (redirection vers `/contact` par exemple) via une extension de sécurité (ex: *WPS Hide Login*) :
   * Renommer temporairement le dossier de l'extension de sécurité depuis WinSCP (ex: `wps-hide-login_bak`) pour forcer sa désactivation silencieuse.
   * Accéder à l'URL native `wp-login.php`, activer l'agent *iwebCreative Security*, puis restaurer le nom du dossier de sécurité initial.

### 3. Établissement du Tunnel Réseau (Phase de Test)
Afin de permettre au site de production de communiquer avec l'API locale en cours de développement, un tunnel sécurisé est mis en place :
* Utilisation de **Ngrok** (ou Cloudflare Tunnels) pour exposer le port `8000` du conteneur Docker FastAPI vers une URL HTTPS publique temporaire.
* L'URL générée est injectée dans la configuration de l'agent PHP pour acheminer les payloads JSON.



## Phase 5 : Investigation Forensique & Réponse aux Incidents (DevSecOps)

Cette phase transforme la plateforme en un véritable centre de réponse aux incidents (Incident Response), permettant aux analystes d'auditer et d'assainir les sites de la flotte à distance.

### 1. Audit d'Infrastructure & SBOM (Software Bill of Materials)
* **Threat Intelligence (Renseignement sur les Menaces) :** Évaluation dynamique de la vétusté des composants sans dette technique. Le tableau de bord interroge en temps réel des API publiques de référence (`api.wordpress.org` et `endoflife.date`) pour comparer l'inventaire de la cible avec les dernières versions sécurisées (CMS) et les branches encore maintenues (PHP). Les environnements en fin de vie (EOL) sont instantanément flaggués.
* **Cartographie des Composants :** Remontée des versions du cœur WordPress, de l'environnement PHP et de la liste complète des extensions.
* **Hardening :** Identification automatique des environnements obsolètes (ex: PHP 5.x/7.x) nécessitant une mise à jour critique.
* **Traçabilité Admin :** Suivi de l'horodatage et de l'adresse IP de la dernière connexion au panel administrateur de chaque cible.

### 2. Scanner Anti-Malware Heuristique
* **Investigation de Fichiers :** Analyse du système de fichiers distant (notamment le dossier `uploads`) pour détecter la présence de Web Shells ou de portes dérobées (Backdoors).
* **Liste Blanche (Whitelisting) :** Gestion intelligente des faux positifs en permettant de marquer un fichier suspect comme "sain" pour l'ignorer lors des scans ultérieurs.

### 3. Réponse à Incident (Remédiation Active)
* **Destruction de Payloads :** Capacité de supprimer un fichier malveillant de manière irréversible directement depuis le serveur distant, sécurisée par une modale de confirmation.
* **Archivage des Menaces :** Résolution manuelle et archivage des alertes de sécurité une fois l'investigation terminée par l'analyste SOC.
* **File d'Attente de Triage :** Interface compacte et dynamique affichant les sites critiques nécessitant une intervention urgente, classés selon un *Health Score* (0 à 100) recalculé en temps réel en fonction des alertes actives.

### 4. Gestion du Cycle de Vie des Clés (Key Rotation)
* **Révocation Instantanée :** Mécanisme d'urgence permettant de révoquer l'accès d'un agent compromis et de régénérer un nouveau jeton cryptographique à la volée.
* **Distribution Sécurisée :** Affichage unique (*Read-Once*) du nouveau jeton (chiffré en base de données via l'algorithme symétrique Fernet) pour faciliter la reconfiguration manuelle de la sonde distante.


👨‍💻 Auteur
Hamza Bourras Élève Ingénieur en Cybersécurité et Confiance Numérique (CCN) Projet réalisé dans le cadre de la mise en place d'une infrastructure SecOps globale.