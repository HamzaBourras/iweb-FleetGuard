from fastapi import FastAPI, Depends, HTTPException, Header, APIRouter
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
import secrets
from pydantic import BaseModel
from datetime import datetime, timedelta
import httpx
import time

# 1. Configuration de la connexion à la Base de Données PostgreSQL
DATABASE_URL = "postgresql://fleetguard_admin:super_secret_password@db:5432/fleetguard_db"

# Initialisation du moteur de base de données
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- LA CORRECTION EST ICI ---
# On importe les modèles APRÈS avoir défini Base pour éviter l'importation circulaire
import models
import schemas
import security

# On ordonne la création des tables dans PostgreSQL
models.Base.metadata.create_all(bind=engine)
# ------------------------------

# 2. Initialisation de l'application FastAPI
app = FastAPI(
    title="iweb FleetGuard API",
    description="Le cerveau central de la Tour de Contrôle SecOps",
    version="1.0.0"
)

# --- CONFIGURATION CORS ---
# On autorise uniquement le port de ton frontend React pour des raisons de sécurité
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"], # Autorise les requêtes GET, POST, PUT, DELETE
    allow_headers=["*"], # Autorise tous les en-têtes (comme les tokens d'authentification)
)

# Fonction de dépendance pour ouvrir et fermer proprement la session BDD à chaque requête
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 3. Première Route de Test
@app.get("/")
def read_root():
    return {
        "status": "En ligne",
        "message": "Bienvenue sur l'API centrale iweb FleetGuard. Le moteur Python est opérationnel."
    }

# On indique à FastAPI quelle route délivre les tokens
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

# 4. Route pour recevoir les alertes de l'agent PHP
@app.post("/api/alerts")
def receive_agent_alerts(
    payload: schemas.AgentPayload,          
    authorization: str = Header(None),      
    db: Session = Depends(get_db)           
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token d'authentification manquant ou mal formaté")

    token_recu = authorization.split(" ")[1]

    # --- LOGIQUE DE SÉCURITÉ (FERNET) ---
    sites = db.query(models.ClientSite).all()
    site_client = None
    
    for site in sites:
        try:
            decrypted_token = security.decrypt_token(site.secret_token)
            if token_recu == decrypted_token:
                site_client = site
                break
        except Exception:
            continue

    if not site_client:
        raise HTTPException(status_code=403, detail="Token refusé : Site inconnu, token invalide ou accès révoqué")

    # --- ENREGISTREMENT DES ALERTES ET CALCUL DU MALUS ---
    penalite_score = 0

    for event in payload.security_events:
        nouvelle_alerte = models.SecurityAlert(
            site_id=site_client.id,
            event_type=event.event_type,
            severity=event.severity,
            message=event.message,
            ip_address=event.ip_address
        )
        db.add(nouvelle_alerte)

        # Calcul de la pénalité selon la gravité de l'alerte
        if event.severity == "critical":
            penalite_score += 15
        elif event.severity == "high":
            penalite_score += 10
        elif event.severity == "medium":
            penalite_score += 5
        else:
            penalite_score += 2
            
    # --- MISE À JOUR DU SCORE DE SANTÉ DU SITE ---
    # On récupère le score actuel (ou 100 par défaut s'il est vide)
    score_actuel = getattr(site_client, 'health_score', 100)
    if score_actuel is None:
        score_actuel = 100
        
    # On soustrait la pénalité en s'assurant que le score ne descende jamais en dessous de 0
    nouveau_score = max(0, score_actuel - penalite_score)
    site_client.health_score = nouveau_score

    # On sauvegarde tout en une seule transaction (les alertes + le nouveau score)
    db.commit()

    return {
        "status": "success",
        "message": f"{len(payload.security_events)} alerte(s) enregistrée(s). Score de santé mis à jour à {nouveau_score}/100."
    }


# --- ROUTES D'AUTHENTIFICATION DU TABLEAU DE BORD ---
@app.post("/api/auth/login", response_model=schemas.Token)
def login_admin(credentials: schemas.AdminLogin, db: Session = Depends(get_db)):
    # 1. On cherche l'administrateur par son email
    admin = db.query(models.DashboardAdmin).filter(models.DashboardAdmin.email == credentials.email).first()
    
    # 2. On vérifie si le compte existe et si le mot de passe correspond au hash
    if not admin or not security.verify_password(credentials.password, admin.hashed_password):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    if admin.is_active == 0:
        raise HTTPException(status_code=403, detail="Ce compte a été désactivé")

    # 3. On génère le badge d'accès JWT
    access_token = security.create_access_token(
        data={"sub": admin.email, "role": admin.role}
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


# --- ROUTES DU TABLEAU DE BORD (PROTÉGÉES) ---

@app.get("/api/dashboard/stats")
def get_dashboard_stats(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    total_sites = db.query(models.ClientSite).count()
    total_alerts = db.query(models.SecurityAlert).count()
    
    health_score_value = 100 - (total_alerts * 2)
    health_score = f"{max(0, health_score_value)}%"
    
    today = datetime.utcnow()
    jour_noms = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
    chart_data = []
    
    for i in range(6, -1, -1):
        target_date = today - timedelta(days=i)
        
        start_of_day = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = target_date.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        # --- LA CORRECTION EST ICI (timestamp au lieu de created_at) ---
        count = db.query(models.SecurityAlert).filter(
            models.SecurityAlert.timestamp >= start_of_day,
            models.SecurityAlert.timestamp <= end_of_day
        ).count()
        
        chart_data.append({
            "name": jour_noms[target_date.weekday()],
            "alertes": count
        })

    return {
        "active_sites": total_sites,
        "vulnerabilities": total_alerts,
        "health_score": health_score,
        "chart_data": chart_data
    }


# --- 1. MODIFICATION DE LA ROUTE EXISTANTE : GET /api/sites ---
@app.get("/api/sites")
def get_all_sites(
    token: str = Depends(oauth2_scheme), 
    db: Session = Depends(get_db)
):
    # NETTOYAGE AUTOMATIQUE : On supprime physiquement les sites en attente depuis plus de 12h
    limite_retention = datetime.utcnow() - timedelta(hours=12)
    db.query(models.ClientSite).filter(models.ClientSite.deleted_at < limite_retention).delete()
    db.commit()

    # On renvoie tous les sites restants (actifs ET en cours de suppression)
    return db.query(models.ClientSite).all()

#**** Ajout d'un nouveau site client (protégé par JWT) ****
# --- SCHÉMA DE DONNÉES ---
# On définit ce que React a le droit de nous envoyer
class SiteCreate(BaseModel):
    site_name: str
    url: str

# --- 2. NOUVELLE ROUTE : MISE EN CORBEILLE (SOFT DELETE) ---
@app.delete("/api/sites/{site_id}")
def soft_delete_site(
    site_id: int, 
    token: str = Depends(oauth2_scheme), 
    db: Session = Depends(get_db)
):
    site = db.query(models.ClientSite).filter(models.ClientSite.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site introuvable")
    
    # On marque la date de suppression
    site.deleted_at = datetime.utcnow()
    db.commit()
    return {"message": "Le site a été placé en corbeille pour 12 heures."}


# --- 3. NOUVELLE ROUTE : RESTAURATION ---
@app.put("/api/sites/{site_id}/restore")
def restore_site(
    site_id: int, 
    token: str = Depends(oauth2_scheme), 
    db: Session = Depends(get_db)
):
    site = db.query(models.ClientSite).filter(models.ClientSite.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site introuvable")
    
    # On annule la suppression
    site.deleted_at = None
    db.commit()
    return {"message": "Le site a été restauré avec succès."}


# --- ROUTE DE CRÉATION des sites ---
@app.post("/api/sites")
def create_site(
    site_data: SiteCreate,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    # 1. Génération du token en clair (celui qu'on va montrer à l'admin)
    raw_token = f"IWEB_{secrets.token_urlsafe(32)}"
    
    # 2. CHIFFREMENT SYMÉTRIQUE (Réversible) au lieu du hachage
    encrypted_token = security.encrypt_token(raw_token)
    
    # 3. Préparation et sauvegarde dans PostgreSQL avec le hash
    nouveau_site = models.ClientSite(
        site_name=site_data.site_name,
        url=site_data.url,
        secret_token=encrypted_token  # 🔒 Le serveur ne connaît plus le vrai token
    )
    
    db.add(nouveau_site)
    db.commit()
    db.refresh(nouveau_site) 
    
    # 4. On renvoie une réponse personnalisée contenant le token en clair.
    # C'est la SEULE et UNIQUE fois que ce token sortira du backend !
    return {
        "id": nouveau_site.id,
        "site_name": nouveau_site.site_name,
        "url": nouveau_site.url,
        "secret_token": raw_token, 
        "status": "actif"
    }


# --- ROUTE DE RÉCUPÉRATION DES ALERTES D'UN ACTIF SPÉCIFIQUE ---
@app.get("/api/sites/{site_id}/alerts")
def get_site_alerts(
    site_id: int, 
    limit: int = 10,
    token: str = Depends(oauth2_scheme), 
    db: Session = Depends(get_db)
):
    # On récupère les X dernières alertes de ce site spécifique, de la plus récente à la plus ancienne
    alerts = db.query(models.SecurityAlert)\
        .filter(models.SecurityAlert.site_id == site_id)\
        .order_by(models.SecurityAlert.timestamp.desc())\
        .limit(limit)\
        .all()
    
    return alerts


# --- ROUTE DE RÉCUPÉRATION DES ALERTES POUR LE DASHBOARD ---
@app.get("/api/alerts")
def get_all_alerts(
    db: Session = Depends(get_db), 
    token: str = Depends(oauth2_scheme)
):
    # On fait une jointure entre SecurityAlert et ClientSite
    alerts_query = db.query(
        models.SecurityAlert, 
        models.ClientSite.site_name
    ).join(
        models.ClientSite, 
        models.SecurityAlert.site_id == models.ClientSite.id
    ).order_by(models.SecurityAlert.timestamp.desc()).all() # <-- CHANGEMENT ICI (timestamp au lieu de created_at)

    resultats = []
    for alerte, nom_du_site in alerts_query:
        resultats.append({
            "id": alerte.id,
            "site_name": nom_du_site,
            "event_type": alerte.event_type,
            "severity": alerte.severity,
            "message": alerte.message,
            "ip_address": alerte.ip_address,
            "timestamp": alerte.timestamp, # <-- CHANGEMENT ICI
            "site_id": alerte.site_id
        })

    return resultats


# --- ROUTE DE RÉCUPÉRATION D'UN SEUL SITE (VUE DÉTAILLÉE) ---
@app.get("/api/sites/{site_id}")
def get_single_site(
    site_id: int, 
    token: str = Depends(oauth2_scheme), 
    db: Session = Depends(get_db)
):
    # 1. Chercher le site ciblé dans la base de données
    site = db.query(models.ClientSite).filter(models.ClientSite.id == site_id).first()
    
    if not site:
        raise HTTPException(status_code=404, detail="Actif introuvable dans la flotte.")
        
    # 2. Calculer dynamiquement le nombre d'alertes associées à ce site
    alerts_count = db.query(models.SecurityAlert).filter(models.SecurityAlert.site_id == site_id).count()
    
    # 3. Construire le dictionnaire de réponse attendu par React
    return {
        "id": site.id,
        "site_name": site.site_name,
        "url": site.url,
        "status": "actif" if not site.deleted_at else "corbeille",
        # On utilise getattr pour éviter les erreurs si les colonnes n'existent pas encore
        "health_score": getattr(site, 'health_score', 0),
        "wp_version": getattr(site, 'wp_version', None),
        "php_version": getattr(site, 'php_version', None),
        "last_scan_at": getattr(site, 'last_scan_at', None),
        "plugins_inventory": getattr(site, 'plugins_inventory', []), 
        "alerts_count": alerts_count,
        # ✨ NOUVEAU : Envoi au Frontend
        "last_admin_login": getattr(site, 'last_admin_login', None),
        "last_admin_ip": getattr(site, 'last_admin_ip', None),
        # ✨ NOUVEAU : Envoi du rapport anti-malware au Frontend
        "malware_report": getattr(site, 'malware_report', [])
    }


# --- ROUTE DE SCAN FORÉNSIQUE D'UN SITE ---
@app.post("/api/sites/{site_id}/scan")
async def scan_site(
    site_id: int, 
    db: Session = Depends(get_db), 
    # current_user: models.User = Depends(get_current_user)
):
    # 1. Vérifier que le site existe dans la base de données
    site = db.query(models.ClientSite).filter(models.ClientSite.id == site_id).first()
    
    if not site:
        raise HTTPException(status_code=404, detail="Cible introuvable dans la flotte.")

    # 2. Construire l'URL de l'endpoint de santé de l'agent PHP
    # On utilise .rstrip('/') pour éviter les doubles slashes (ex: https://site.com//wp-json/...)
    base_url = site.url.rstrip('/')
    health_endpoint = f"{base_url}/wp-json/iwebcreative/v1/health"

    # ✨ DÉCHIFFREMENT À LA VOLÉE
    # On déchiffre le jeton stocké en BDD pour prouver notre identité à l'agent PHP
    try:
        decrypted_token = security.decrypt_token(site.secret_token)
    except Exception:
        raise HTTPException(status_code=500, detail="Erreur interne : Impossible de déchiffrer le jeton de l'actif.")

    # 3. Interroger l'agent PHP de manière asynchrone
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                health_endpoint,
                headers={"Authorization": f"Bearer {decrypted_token}"} # <-- On utilise le jeton déchiffré
            )
            
            # Vérification de l'authentification
            if response.status_code == 401:
                raise HTTPException(
                    status_code=401, 
                    detail="Accès refusé par la cible : Jeton de sécurité invalide ou révoqué."
                )
            
            # Déclenche une exception pour les autres erreurs HTTP (500, 404, 403)
            response.raise_for_status()
            
            scan_data = response.json()

    except httpx.ConnectTimeout:
        raise HTTPException(status_code=504, detail="Délai d'attente dépassé : Le site cible ne répond pas.")
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail=f"Erreur de communication avec la cible : {str(exc)}")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail="La sonde PHP a retourné une erreur inattendue.")

    # 4. Mettre à jour les données du site dans PostgreSQL
    try:
        site.last_scan_at = datetime.utcnow()
        site.wp_version = scan_data.get("core", {}).get("wp_version")
        site.php_version = scan_data.get("core", {}).get("php_version")
        # ✨ NOUVEAU : Sauvegarde de la liste des plugins
        site.plugins_inventory = scan_data.get("plugins", []) 

        # ✨ NOUVEAU : Enregistrement de l'audit Admin
        # On convertit la chaîne MySQL en objet datetime Python si elle existe
        admin_login_str = scan_data.get("last_admin_login")
        if admin_login_str:
            site.last_admin_login = datetime.strptime(admin_login_str, '%Y-%m-%d %H:%M:%S')
            
        site.last_admin_ip = scan_data.get("last_admin_ip")
        # ------------------------------------------------
        
        # site.health_score = 100 
        
        db.commit()
        db.refresh(site)
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erreur lors de la sauvegarde des résultats du scan.")

    # 5. Retourner le résultat au Frontend
    return {
        "message": "Analyse forensique terminée avec succès",
        "telemetry": scan_data
    }


# --- ROUTE DE SCAN ANTI-MALWARE D'UN SITE ---
@app.post("/api/sites/{site_id}/malware-scan")
async def run_malware_scan(
    site_id: int, 
    db: Session = Depends(get_db)
):
    try:
        # 1. Vérification de l'existence du site
        site = db.query(models.ClientSite).filter(models.ClientSite.id == site_id).first()
        if not site:
            raise HTTPException(status_code=404, detail="Cible introuvable dans la flotte.")

        # 2. Construction de l'URL vers la NOUVELLE route PHP
        base_url = site.url.rstrip('/')
        # ✨ CORRECTION : On ajoute un "Cache-Buster" à l'URL
        timestamp_actuel = int(time.time())
        scan_endpoint = f"{base_url}/wp-json/iwebcreative/v1/malware-scan?nocache={timestamp_actuel}"

        # 3. Déchiffrement du Token
        try:
            decrypted_token = security.decrypt_token(site.secret_token)
        except Exception:
            raise HTTPException(status_code=500, detail="Impossible de déchiffrer le jeton de l'actif.")

        # 4. Requête avec un TIMEOUT ÉTENDU (60 secondes) pour l'analyse des fichiers
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(
                scan_endpoint,
                headers={"Authorization": f"Bearer {decrypted_token}"} 
            )
            if response.status_code == 401:
                raise HTTPException(status_code=401, detail="Jeton de sécurité invalide ou révoqué.")
            
            response.raise_for_status()
            scan_data = response.json()

        # 5. Mise à jour de la base de données avec les résultats du scan
        malware_results = scan_data.get("malware_scan", [])
        site.malware_report = malware_results

        # Si des fichiers malveillants sont trouvés, on fait chuter le score de santé
        if len(malware_results) > 0:
            site.health_score = 0 
        
        db.commit()
        db.refresh(site)
        
        return {
            "message": "Analyse anti-malware terminée avec succès",
            "malware_report": malware_results
        }

    # --- LE FILET DE SÉCURITÉ ---
    except HTTPException:
        raise 
    except Exception as e:
        db.rollback()
        print("\n" + "="*50)
        print("🚨 ERREUR FATALE LORS DU MALWARE SCAN 🚨")
        print(traceback.format_exc())
        print("="*50 + "\n")
        raise HTTPException(status_code=500, detail=f"Erreur interne du serveur lors de l'analyse des fichiers. ({str(e)})")






# --- HACK TEMPORAIRE POUR INJECTER LE PREMIER ADMINISTRATEUR ---
@app.get("/setup-admin")
def setup_first_admin(db: Session = Depends(get_db)):
    # Vérifie si le compte existe déjà pour éviter les doublons
    admin_existe = db.query(models.DashboardAdmin).filter(models.DashboardAdmin.email == "admin@iweb.com").first()
    if admin_existe:
        return {"message": "Le compte admin@iweb.com existe déjà !"}
    
    # Hachage sécurisé du mot de passe
    mot_de_passe_hache = security.get_password_hash("SuperAdmin2026!")
    
    nouveau_admin = models.DashboardAdmin(
        email="admin@iweb.com",
        hashed_password=mot_de_passe_hache,
        role="superadmin"
    )
    db.add(nouveau_admin)
    db.commit()
    
    return {"message": "Compte administrateur créé avec succès : admin@iweb.com / SuperAdmin2026!"}

# --- HACK TEMPORAIRE POUR INJECTER UN SITE DE TEST ---
# Correction de "SessionLocal" en "Session"
# @app.get("/setup-test")
# def setup_test_site(db: Session = Depends(get_db)):
#     nouveau_site = models.ClientSite(
#         url="https://site-cobaye.com",
#         secret_token="IWEB_SECURE_TOKEN_2026_XYZ",
#         site_name="Site de Test Postman"
#     )
#     db.add(nouveau_site)
#     db.commit()
#     return {"message": "Site de test créé avec succès dans PostgreSQL !"}