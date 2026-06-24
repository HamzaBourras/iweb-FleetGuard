from fastapi import FastAPI, Depends, HTTPException, Header
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base

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

    sites = db.query(models.ClientSite).all()
    site_client = next((site for site in sites if site.secret_token == token_recu), None)

    if not site_client:
        raise HTTPException(status_code=403, detail="Token refusé : Site inconnu ou accès révoqué")

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