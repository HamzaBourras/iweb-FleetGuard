from fastapi import FastAPI, Depends, HTTPException, Header
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
import secrets
from pydantic import BaseModel
from datetime import datetime, timedelta

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

    # --- LA NOUVELLE LOGIQUE DE SÉCURITÉ EST ICI ---
    sites = db.query(models.ClientSite).all()
    site_client = None
    
    # On boucle sur les sites et on utilise la fonction de vérification cryptographique
    for site in sites:
        if security.verify_password(token_recu, site.secret_token):
            site_client = site
            break

    if not site_client:
        raise HTTPException(status_code=403, detail="Token refusé : Site inconnu, token invalide ou accès révoqué")

    # ... (Le reste du code d'enregistrement de l'alerte reste identique) ...
    for event in payload.security_events:
        nouvelle_alerte = models.SecurityAlert(
            site_id=site_client.id,
            event_type=event.event_type,
            severity=event.severity,
            message=event.message,
            ip_address=event.ip_address
        )
        db.add(nouvelle_alerte)
    
    db.commit()

    return {
        "status": "success",
        "message": f"{len(payload.security_events)} alerte(s) enregistrée(s) avec succès pour le site ID {site_client.id}"
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
    token: str = Depends(oauth2_scheme), # 🔒 Le vigile bloque si pas de token !
    db: Session = Depends(get_db)
):
    # Idéalement, ici on utilise un module security.verify_token(token) 
    # pour s'assurer que le token n'est pas expiré ou falsifié.
    
    # 1. Requêtes réelles à ta base PostgreSQL
    total_sites = db.query(models.ClientSite).count()
    total_alerts = db.query(models.SecurityAlert).count()
    
    # 2. Calcul dynamique d'un score de santé (algorithme simple)
    # S'il y a 0 alerte = 100%. Chaque alerte fait baisser le score de 2%.
    health_score_value = 100 - (total_alerts * 2)
    health_score = f"{max(0, health_score_value)}%"
    
    # 3. On renvoie les données formatées pour React
    return {
        "active_sites": total_sites,
        "vulnerabilities": total_alerts,
        "health_score": health_score
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
    
    # 2. Hachage cryptographique du token (celui qu'on garde)
    hashed_token = security.get_password_hash(raw_token)
    
    # 3. Préparation et sauvegarde dans PostgreSQL avec le hash
    nouveau_site = models.ClientSite(
        site_name=site_data.site_name,
        url=site_data.url,
        secret_token=hashed_token  # 🔒 Le serveur ne connaît plus le vrai token
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
            "timestamp": alerte.timestamp # <-- CHANGEMENT ICI
        })

    return resultats








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