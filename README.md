# iweb FleetGuard 🛡️

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![PHP](https://img.shields.io/badge/php-%3E%3D%207.4-8892BF.svg)
![WordPress](https://img.shields.io/badge/WordPress-%3E%3D%205.0-21759b.svg)
![Security](https://img.shields.io/badge/SecOps-Active-success.svg)

**iweb FleetGuard** est une architecture SecOps sur-mesure et une plateforme de surveillance centralisée conçue pour sécuriser et auditer un parc d'applications e-commerce et vitrines sous WordPress.
Ce projet permet de passer d'une sécurité réactive (site par site) à une posture proactive et centralisée, garantissant l'intégrité des données clients et la réputation de l'agence.

---
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

Ouvrez ensuite le fichier `.env` avec votre éditeur pour configurer vos accès PostgreSQL, vos clés secrètes et vos identifiants SMTP.
3. **Génération de la clé cryptographique maîtresse :**
La plateforme nécessite une clé de chiffrement Fernet pour protéger au repos les jetons de communication et les secrets MFA. Générez une clé valide en exécutant cette commande :
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

```


Copiez la chaîne de caractères affichée dans le terminal, puis collez-la dans votre fichier `.env` à la ligne `ENCRYPTION_KEY=...`.
Générez également une clé JWT distincte et aléatoire pour `JWT_SECRET_KEY` :
```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```
Ne réutilisez jamais la même valeur pour `JWT_SECRET_KEY` et `ENCRYPTION_KEY`.
4. **Lancement de l'infrastructure :**
Une fois l'environnement configuré, démarrez l'ensemble des conteneurs de développement (PostgreSQL, Backend API, Frontend React et Adminer) en arrière-plan :
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
* **Authentification et intégrité HMAC-SHA256 :** Les routes de l'agent vérifient une signature liée à la méthode, la route, l'horodatage et le hash du corps JSON. Les requêtes expirées ou rejouées sont rejetées. HMAC n'assure pas le chiffrement : la confidentialité du transport repose sur HTTPS.

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

1. Déclaration : Ajoutez le nouveau site depuis le tableau de bord FleetGuard et copiez le jeton d'authentification généré. Il est affiché une seule fois.

2. Transfert : Connectez-vous au serveur du site client via SFTP et placez le fichier `iwebcreative-agent.php` dans le répertoire `/wp-content/mu-plugins/`. Ce mode Must-Use empêche sa désactivation depuis l'interface WordPress.

3. Verrouillage Cryptographique : Ouvrez le fichier wp-config.php situé à la racine du site WordPress.

4. Configuration : Ajoutez ces trois lignes juste avant la ligne "That's all, stop editing!" :
   `define( 'IWEB_AGENT_SECRET_TOKEN', 'VOTRE_JETON_COPIE_ICI' );`
   `define( 'IWEB_SITE_ID', 'UUID_PUBLIC_DU_SITE' );`
   `define( 'IWEB_SOC_URL', 'https://soc.exemple.com' );`


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
* **Authentification et intégrité HMAC-SHA256 :** La route `/api/alerts` rejette toute requête dont la signature est absente, invalide, expirée ou rejouée. La signature n'est pas un mécanisme de chiffrement ; l'API doit être publiée derrière HTTPS en production.
* **Chiffrement au repos (Encryption at Rest) :** Les jetons de communication et les secrets MFA sont chiffrés dans PostgreSQL avec Fernet via un `TypeDecorator` SQLAlchemy. `ENCRYPTION_KEY` sert au chiffrement courant et `ENCRYPTION_KEY_OLD` peut permettre une rotation progressive. Les données sont déchiffrées en mémoire lors de leur lecture par l'application, pas uniquement pendant une vérification.
* **Hachage des mots de passe :** Les mots de passe administrateurs et les codes de récupération MFA sont hachés avec bcrypt. Les jetons d'agents ne sont pas hachés avec bcrypt, car le backend doit pouvoir les utiliser pour signer les appels sortants.
* **Session administrateur :** L'accès au dashboard utilise un JWT signé en HS256 dans un cookie HttpOnly, avec version de token pour révoquer les sessions. En production, `COOKIE_SECURE=true` et HTTPS sont obligatoires.

### 🚀 Déploiement de l'Environnement de Développement
L'infrastructure s'instancie de manière totalement isolée et automatisée :

```bash
# Lancement de l'API, de la base PostgreSQL et d'Adminer
docker compose up -d
```

### Exemple de requête de test (cURL)
```bash
curl -X GET https://site-client.com/wp-json/iwebcreative/v1/health \
  -H "X-Iweb-Timestamp: TIMESTAMP" -H "X-Iweb-Signature: SIGNATURE"
```

En production, l'API centrale doit être publiée derrière un reverse proxy TLS. Le fichier `docker-compose.yml` expose principalement des ports destinés au développement et ne fournit pas, à lui seul, de terminaison HTTPS.

## 🖥️ Phase 3 : Le Centre de Commandes (Dashboard React)

Le tableau de bord (Frontend) constitue la "Tour de Contrôle" (*Single Pane of Glass*) de l'infrastructure iweb FleetGuard. Développé en **React** et stylisé avec **Tailwind CSS**, il permet aux administrateurs de sécurité d'avoir une visibilité centralisée et une réactivité quasi temps réel sur l'ensemble du parc cible.

L'interface est structurée autour de trois espaces de travail distincts :

### 📊 1. Vue d'ensemble (Overview)
Le centre de pilotage principal offrant une vision macroscopique de la santé de la flotte.
* **Indicateurs Clés de Sécurité (KPIs) :** Affichage immédiat du nombre de capteurs actifs, du volume d'alertes interceptées sur les dernières 24h, et du ratio de sites sains par rapport aux sites subissant des attaques.
* **Analyse de Tendances :** Visualisation globale permettant d'identifier rapidement les pics d'activité malveillante ou les campagnes d'attaques coordonnées sur le parc.

### 🌐 2. Gestion de la Flotte (Sites)
Le module de provisionnement et de supervision (*Fleet Management*) des capteurs déployés.
* **Provisionnement Sécurisé :** Ajout de nouvelles cibles avec génération automatique d'un jeton d'authentification cryptographique à très haute entropie.
* **Architecture "Read-Once" :** Pour limiter les risques de fuite, le jeton de l'agent est affiché en clair une seule fois lors de sa création ou de sa régénération. L'interface ne le réaffiche ensuite pas ; le serveur conserve une version chiffrée avec Fernet, et non une empreinte bcrypt.
* **Observabilité Continue :** Suivi dynamique de la connectivité des agents (Actif, Hors ligne, En attente) permettant de détecter le sabotage ou la désactivation d'une sonde. Une compromission est signalée par les alertes et les résultats de scan, et n'est pas un statut autonome.

### 🚨 3. Centre d'Opérations de Sécurité (Alerts)
Le cœur réactif du système (SecOps), conçu pour l'analyse des incidents et la qualification des menaces.
* **Flux quasi temps réel :** Réception et affichage asynchrones des *payloads* d'attaques expédiés par les agents WordPress. La transmission est non bloquante et ne garantit pas la livraison si le SOC est indisponible.
* **Triage par Criticité :** Les événements sont automatiquement classifiés par niveau de sévérité (Critique, Élevée, Moyenne, Faible) à l'aide de badges visuels stricts pour prioriser la réponse à incident.
* **Traçabilité Forensique :** Chaque log consigne le type d'attaque (ex: *Brute Force*, *Élévation de privilèges*), le message de l'agent, le timestamp exact, et l'adresse IP de l'attaquant pour faciliter la mise en place de règles de pare-feu (WAF).

### 🔍 4. Console d'Investigation Forensique (Site Details)
Le module d'analyse profonde et de réponse aux incidents (IR - Incident Response) dédié à un actif spécifique.
* **Threat Intelligence & SBOM :** Évaluation dynamique de la vétusté des composants. Le système cartographie l'environnement PHP, le noyau WordPress et les extensions. Il signale instantanément les versions obsolètes ou les mises à jour en attente.
* **Scanner Heuristique & Remédiation :** Lancement d'analyses anti-malware à distance pour détecter les Web Shells, extensions exécutables ou certains motifs de code obfusqué. L'analyste peut mettre un fichier en quarantaine ou le placer en liste blanche (gestion des faux positifs). La quarantaine déplace le fichier ; elle ne constitue pas une suppression irréversible.
* **Playbook SecOps Intégré :** Pour chaque alerte interceptée sur le site, le système fournit une analyse détaillée de la menace et propose des actions de remédiation concrètes pour guider l'opérateur.
* **Gestion Cryptographique (Key Rotation) :** Mécanisme d'urgence permettant de révoquer l'accès d'une cible compromise et de générer un nouveau jeton de communication à la volée, sans perdre l'historique des attaques.
* **Politique d'Auto-Scan :** Activation ou désactivation de la surveillance asynchrone. La fréquence est configurable ; le planificateur central vérifie périodiquement les scans à effectuer.


## ⚔️ Phase 4 : Déploiement en Production & Red Teaming (Simulation d'Attaques)

Cette phase valide la chaîne de communication de bout en bout entre le site client en production et la Tour de Contrôle locale, en utilisant des techniques de contournement administratif et des simulations d'attaques réelles (Pentesting).

### 1. Génération du Jeton (Read-Once)
Pour respecter le principe de *Zero Trust* et limiter le rayon d'impact (Blast Radius) en cas de compromission d'un serveur client :
1. Chaque site cible nécessite son propre jeton d'authentification unique.
2. Le jeton est généré par l'API (FastAPI) lors de l'ajout du site depuis le tableau de bord React.
3. **Sécurité :** Le backend chiffre le jeton avec Fernet avant son enregistrement en base de données. Le jeton en clair n'est affiché qu'une seule fois à l'administrateur (Read-Once). bcrypt est réservé aux mots de passe et aux codes de récupération MFA.

### 2. Déploiement Furtif de l'Agent via SFTP
Le déploiement manuel garantit que l'agent est installé proprement sans passer par les installeurs standards de WordPress.

1. Connexion au serveur d'hébergement du site cible (ex: `i-webcreative.com`) à l'aide d'un client sécurisé comme **WinSCP**.
2. Navigation vers le répertoire Must-Use Plugin : `/public_html/wp-content/mu-plugins/`.
3. Création, si nécessaire, du répertoire `/public_html/wp-content/mu-plugins/` et transfert du fichier PHP. Le jeton est configuré dans `wp-config.php`, pas codé dans le plugin.
4. **Bypass des restrictions d'accès (Hardening) :** Si le site masque sa page de connexion `/wp-admin` (redirection vers `/contact` par exemple) via une extension de sécurité (ex: *WPS Hide Login*) :
   * Dans un environnement autorisé et uniquement pour un test contrôlé, renommer temporairement le dossier de l'extension de sécurité depuis WinSCP (ex: `wps-hide-login_bak`) pour forcer sa désactivation silencieuse.
   * Accéder à l'URL native `wp-login.php`, activer l'agent *iwebCreative Security*, puis restaurer le nom du dossier de sécurité initial.

### 3. Établissement du Tunnel Réseau (Phase de Test)
Afin de permettre au site de production de communiquer avec l'API locale en cours de développement, un tunnel sécurisé est mis en place :
* Utilisation d'une URL HTTPS publique autorisée (ou d'un tunnel approuvé par le client) pour exposer le service FastAPI. Ne publiez pas directement le port `8000` en HTTP sur Internet.
* L'URL générée est injectée dans la configuration de l'agent PHP pour acheminer les payloads JSON.



## Phase 5 : Investigation Forensique & Réponse aux Incidents (DevSecOps)

Cette phase transforme la plateforme en un véritable centre de réponse aux incidents (Incident Response), permettant aux analystes d'auditer et d'assainir les sites de la flotte à distance.

### 1. Audit d'Infrastructure & SBOM (Software Bill of Materials)
* **Threat Intelligence (Renseignement sur les Menaces) :** Évaluation dynamique de la vétusté des composants. Le tableau de bord interroge des API publiques de référence (`api.wordpress.org` et `endoflife.date`) pour comparer l'inventaire de la cible avec les dernières versions du cœur WordPress et les branches PHP encore maintenues. Les environnements en fin de vie (EOL) sont signalés.
* **Cartographie des Composants :** Remontée des versions du cœur WordPress, de l'environnement PHP et de la liste complète des extensions.
* **Hardening :** Identification automatique des environnements obsolètes (ex: PHP 5.x/7.x) nécessitant une mise à jour critique.
* **Traçabilité Admin :** Suivi de l'horodatage et de l'adresse IP de la dernière connexion au panel administrateur de chaque cible.

### 2. Scanner Anti-Malware Heuristique
* **Investigation de Fichiers :** Analyse du système de fichiers distant (notamment le dossier `uploads`) pour détecter la présence de Web Shells ou de portes dérobées (Backdoors).
* **Liste Blanche (Whitelisting) :** Gestion intelligente des faux positifs en permettant de marquer un fichier suspect comme "sain" pour l'ignorer lors des scans ultérieurs.

### 3. Réponse à Incident (Remédiation Active)
* **Mise en quarantaine de payloads :** Capacité de déplacer un fichier malveillant vers un répertoire de quarantaine protégé sur le serveur distant, sécurisée par une modale de confirmation. Les fichiers hors du dossier `uploads` doivent être traités manuellement via SFTP.
* **Archivage des Menaces :** Résolution manuelle et archivage des alertes de sécurité une fois l'investigation terminée par l'analyste SOC.
* **File d'Attente de Triage :** Interface compacte et dynamique affichant les sites critiques nécessitant une intervention urgente, classés selon un *Health Score* (0 à 100) recalculé en temps réel en fonction des alertes actives.

### 4. Gestion du Cycle de Vie des Clés (Key Rotation)
* **Révocation Instantanée :** Mécanisme d'urgence permettant de révoquer l'accès d'un agent compromis et de régénérer un nouveau jeton cryptographique à la volée.
* **Distribution Sécurisée :** Affichage unique (*Read-Once*) du nouveau jeton, chiffré au repos en base de données via Fernet, pour faciliter la reconfiguration manuelle de la sonde distante. Le nouveau jeton doit être transmis et configuré via un canal d'administration sécurisé.


👨‍💻 Auteur
Hamza Bourras Élève Ingénieur en Cybersécurité et Confiance Numérique (CCN) Projet réalisé dans le cadre de la mise en place d'une infrastructure SecOps globale.
