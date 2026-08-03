import os

from fastapi import FastAPI, Request, Depends, HTTPException, Header, APIRouter, Response, BackgroundTasks
from email_service import send_soc_email
from jose import jwt, JWTError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, selectinload
from sqlalchemy.ext.declarative import declarative_base
from fastapi.middleware.cors import CORSMiddleware
import secrets
import json
from pydantic import BaseModel
from datetime import datetime, timedelta
import httpx
import time
from pydantic import BaseModel
import pyotp
from typing import Optional

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

# Nouvelle version sécurisée par Cookie
def get_current_admin(request: Request, db: Session = Depends(get_db)):
    # 1. On extrait le token du cookie HttpOnly
    token = request.cookies.get("fleetguard_token")
    
    if not token:
        raise HTTPException(status_code=401, detail="Non authentifié (Cookie introuvable)")
    
    try:
        # 2. On utilise ta clé secrète définie dans security.py pour décoder
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Token invalide")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expiré ou corrompu")
        
    # 3. On vérifie que l'admin existe toujours en BDD
    admin = db.query(models.DashboardAdmin).filter(models.DashboardAdmin.email == email).first()
    if admin is None:
        raise HTTPException(status_code=401, detail="Administrateur introuvable")
        
    return admin

# --- FONCTION DE RECALCUL DU SCORE DE SANTÉ du site ---
def recalculate_health_score(site, db: Session):
    """
    Recalcule le score de santé du site basé sur les menaces actives.
    - Présence de malware = 0/100 immédiat
    - Par alerte active : critical (-15), high (-10), medium (-5), low/autres (-2)
    - Plancher à 20/100 pour différencier d'une infection malware
    - Zéro menace = 100/100
    """
    # 1. Vérification des malwares
    has_malware = len(site.malware_report) > 0 if site.malware_report else False
    
    if has_malware:
        site.health_score = 0
    else:
        # 2. Récupération des objets alertes non résolues (on utilise .all() au lieu de .count())
        active_alerts = db.query(models.SecurityAlert).filter(
            models.SecurityAlert.site_id == site.id,
            models.SecurityAlert.status != "resolved"
        ).all()
        
        if not active_alerts:
            site.health_score = 100
        else:
            # 3. Calcul de la pénalité selon la gravité de l'alerte
            penalite_score = 0
            for event in active_alerts:
                if event.severity == "critical":
                    penalite_score += 15
                elif event.severity == "high":
                    penalite_score += 10
                elif event.severity == "medium":
                    penalite_score += 5
                else:
                    penalite_score += 2
            
            # On soustrait la pénalité totale de 100
            new_score = 100 - penalite_score
            
            # On s'assure que le score ne tombe pas sous 20 (sauf en cas de malware)
            site.health_score = max(20, new_score)
    

    db.commit()
    db.refresh(site)
    

# 4. Route pour recevoir les alertes de l'agent PHP
@app.post("/api/alerts")
def receive_agent_alerts(
    payload: schemas.AgentPayload,  
    background_tasks: BackgroundTasks,        
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

    email_destinataire = os.getenv("SOC_ALERT_EMAIL", "")

    for event in payload.security_events:
        # 1. Enregistrement de l'Alerte dans la BDD
        nouvelle_alerte = models.SecurityAlert(
            site_id=site_client.id,
            event_type=event.event_type,
            severity=event.severity,
            message=event.message,
            ip_address=event.ip_address
        )
        db.add(nouvelle_alerte)

        # 2. Enregistrement de la Notification In-App (Frontend)
        nouvelle_notification = models.Notification(
            type="alerte de sécurité",
            title=f"Menace {event.severity.upper()} sur {site_client.site_name}",
            message=f"[{event.event_type}] {event.message} (IP: {event.ip_address})",
            site_id=site_client.id
        )
        db.add(nouvelle_notification)

        # 3. Filtrage et Envoi de l'Email
        if event.severity in ["critical", "high"]:
            background_tasks.add_task(
                send_soc_email,
                destinataire=email_destinataire,
                sujet=f"Menace {event.severity.upper()} détectée sur {site_client.site_name}",
                type_alerte="Alerte de sécurité",
                message_alerte=f"L'agent de sécurité a intercepté une attaque de niveau {event.severity.upper()}.\n\nCible: {site_client.site_name} ({site_client.url})\nMenace: {event.event_type}\nSource: {event.ip_address}\nDétails: {event.message}"
            )

        # 4. Calcul de la pénalité selon la gravité de l'alerte
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
@app.post("/api/auth/login")
def login_admin(
    credentials: schemas.AdminLogin, 
    response: Response, 
    db: Session = Depends(get_db)
):
    # 1. On cherche l'administrateur par son email
    admin = db.query(models.DashboardAdmin).filter(models.DashboardAdmin.email == credentials.email).first()
    
    # 2. On vérifie si le compte existe et si le mot de passe correspond au hash
    if not admin or not security.verify_password(credentials.password, admin.hashed_password):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    if admin.is_active == 0:
        raise HTTPException(status_code=403, detail="Ce compte a été désactivé")

    # ✨ 3. VERROU MFA (MULTI-FACTOR AUTHENTICATION) ✨
    if admin.mfa_enabled:
        if not credentials.mfa_code:
            raise HTTPException(status_code=403, detail="MFA_REQUIRED")
        
        mfa_input = credentials.mfa_code.strip().upper() # On nettoie et on met en majuscules
        
        # A. On vérifie d'abord si c'est un code TOTP classique (Application)
        totp = pyotp.TOTP(admin.mfa_secret)
        is_valid_totp = totp.verify(mfa_input)
        is_valid_recovery = False

        # B. Si le TOTP échoue, on vérifie si c'est un code de secours
        if not is_valid_totp and admin.mfa_recovery_codes:
            import json
            try:
                hashed_codes = json.loads(admin.mfa_recovery_codes)
            except json.JSONDecodeError:
                hashed_codes = []
                
            for idx, hashed_code in enumerate(hashed_codes):
                # On compare le code saisi avec le hachage en BDD
                if security.verify_password(mfa_input, hashed_code):
                    is_valid_recovery = True
                    # 🚨 RÈGLE D'OR : On supprime le code de secours utilisé !
                    hashed_codes.pop(idx)
                    admin.mfa_recovery_codes = json.dumps(hashed_codes)
                    db.commit()
                    break # On sort de la boucle, on a trouvé le bon code
                    
        # C. Si ni le TOTP ni le code de secours ne sont bons
        if not is_valid_totp and not is_valid_recovery:
            raise HTTPException(status_code=401, detail="Code MFA ou de secours invalide")

    # 4. Si tout est bon (ou si le MFA n'est pas activé), on génère le JWT
    access_token = security.create_access_token(
        data={"sub": admin.email, "role": admin.role}
    )

    # 5. INJECTION SÉCURISÉE DU COOKIE HTTPONLY
    response.set_cookie(
        key="fleetguard_token",
        value=access_token, 
        httponly=True,  
        secure=False,   # ⚠️ À passer à True en Production (HTTPS)
        samesite="lax", 
        max_age=86400   
    )
    
    return {"message": "Authentification réussie"}

# --- ROUTE DE VÉRIFICATION DE SESSION (POUR LE FRONTEND) ---
@app.get("/api/auth/verify")
def verify_session(admin: models.DashboardAdmin = Depends(get_current_admin)):
    """
    Sert uniquement au front-end React pour vérifier si le cookie est toujours valide 
    sans avoir à télécharger de grosses données.
    """
    return {
        "status": "authenticated", 
        "admin_email": admin.email,
        "mfa_enabled": admin.mfa_enabled  # ✨ Le frontend saura immédiatement si le compte est protégé
    }

# --- ROUTE 1 : GÉNÉRATION DU SECRET ET DU QR CODE ---
@app.get("/api/auth/mfa/setup")
def setup_mfa(
    admin: models.DashboardAdmin = Depends(get_current_admin), 
    db: Session = Depends(get_db)
):
    """
    Génère un nouveau secret TOTP pour l'administrateur.
    Retourne l'URI de provisionnement pour générer le QR Code côté frontend.
    """
    # 1. On génère une clé secrète aléatoire en Base32
    secret = pyotp.random_base32()
    
    # 2. On sauvegarde ce secret dans la base de données
    # IMPORTANT : On laisse mfa_enabled à False tant qu'il n'a pas validé son premier code
    admin.mfa_secret = secret
    admin.mfa_enabled = False
    db.commit()
    
    # 3. On crée l'URL compatible avec Google Authenticator / Authy / Microsoft Authenticator
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=admin.email, 
        issuer_name="FleetGuard SOC" # C'est le nom qui s'affichera dans l'application mobile
    )
    
    return {
        "secret": secret, # Optionnel : à afficher si la caméra du téléphone est cassée
        "qr_uri": provisioning_uri # À transformer en QR Code côté React
    }

# --- ROUTE 2 : VALIDATION ET ACTIVATION DÉFINITIVE ---
@app.post("/api/auth/mfa/enable")
def enable_mfa(
    payload: schemas.MfaEnableRequest, 
    background_tasks: BackgroundTasks,
    admin: models.DashboardAdmin = Depends(get_current_admin), 
    db: Session = Depends(get_db)
):
    """
    Vérifie le premier code à 6 chiffres tapé par l'admin.
    Si le code est bon, on active le MFA et on génère 10 codes de secours à usage unique.
    """
    if not admin.mfa_secret:
        raise HTTPException(status_code=400, detail="Veuillez d'abord initialiser la configuration MFA.")

    # 1. Vérification du code TOTP
    totp = pyotp.TOTP(admin.mfa_secret)
    if not totp.verify(payload.code):
        raise HTTPException(status_code=400, detail="Code MFA invalide ou expiré.")

    # ✨ 2. GÉNÉRATION DES CODES DE SECOURS (Nouveau) ✨
    # On génère 10 codes au format "XXXX-XXXX-XXXX" (ex: "A1B2-C3D4-E5F6")
    plain_recovery_codes = [
        f"{secrets.token_hex(2)}-{secrets.token_hex(2)}-{secrets.token_hex(2)}".upper() 
        for _ in range(10)
    ]
    
    # 3. On hache ces codes avant de les stocker en BDD (Sécurité maximale)
    hashed_codes = [security.get_password_hash(code) for code in plain_recovery_codes]
    
    # 4. Enregistrement en base de données
    admin.mfa_enabled = 1
    admin.mfa_recovery_codes = json.dumps(hashed_codes) # On stocke la liste sous forme de chaîne JSON
    db.commit()

    # Notification In-App
    notif = models.Notification(
        type="activation de mfa",
        title="Sécurité Renforcée (MFA)",
        message=f"L'authentification multifacteur a été activée sur votre compte.",
        admin_id=admin.id
    )
    db.add(notif)
    db.commit()

    # Envoi de l'Email en arrière-plan
    background_tasks.add_task(
        send_soc_email,
        destinataire=os.getenv("SOC_ALERT_EMAIL", ""),
        sujet="MFA activé sur votre compte FleetGuard",
        type_alerte="Activation de MFA",
        message_alerte="L'authentification à double facteur (MFA) vient d'être activée sur votre compte d'administration. Si vous n'êtes pas à l'origine de cette action, contactez immédiatement le support."
    )

    # 5. On renvoie les codes EN CLAIR au frontend. 
    # C'est la SEULE fois où ils existeront hors de la BDD !
    return {
        "message": "Authentification multifacteur (MFA) activée avec succès !",
        "recovery_codes": plain_recovery_codes 
    }


# --- ROUTE DE REGENERATION DES CODES DE SECOURS ---
@app.post("/api/auth/mfa/regenerate-recovery-codes")
def regenerate_recovery_codes(
    payload: schemas.RecoveryCodesRequest,
    background_tasks: BackgroundTasks,
    admin: models.DashboardAdmin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    
    # 1. Vérification de l'identité
    if not security.verify_password(payload.password, admin.hashed_password):
        raise HTTPException(status_code=400, detail="Mot de passe incorrect.")
    
    # 2. Génération de 10 nouveaux codes
    plain_codes = [
        f"{secrets.token_hex(2)}-{secrets.token_hex(2)}-{secrets.token_hex(2)}".upper() 
        for _ in range(10)
    ]
    
    # 3. Hachage et enregistrement (écrase les anciens)
    hashed_codes = [security.get_password_hash(code) for code in plain_codes]
    admin.mfa_recovery_codes = json.dumps(hashed_codes)

    # Notification In-App
    notif = models.Notification(
        type="récupération de codes de secours",
        title="Codes de secours régénérés",
        message="Vos codes de secours d'urgence ont été renouvelés.",
        admin_id=admin.id
    )
    db.add(notif)
    db.commit()

    # Envoi de l'Email
    background_tasks.add_task(
        send_soc_email,
        destinataire=os.getenv("SOC_ALERT_EMAIL", ""),
        sujet="Vos codes de secours ont été régénérés",
        type_alerte="Récupération de codes de secours",
        message_alerte="De nouveaux codes de secours ont été générés pour votre compte. Vos anciens codes ont été révoqués et ne sont plus valides."
    )
    
    # 4. Envoi de la version en clair pour affichage unique
    return {
        "message": "Nouveaux codes générés avec succès.",
        "recovery_codes": plain_codes
    }



# --- ROUTE DE DÉCONNEXION (SUPPRESSION DU COOKIE) ---
@app.post("/api/auth/logout")
def logout_admin(response: Response, admin: models.DashboardAdmin = Depends(get_current_admin)):
    """
    Détruit la session en demandant au navigateur de supprimer le cookie.
    """
    response.delete_cookie(
        key="fleetguard_token",
        httponly=True,
        secure=False, # ⚠️ À passer à True en production
        samesite="lax"
    )
    return {"message": "Déconnexion réussie et cookie détruit."}

# --- ROUTE DE CHANGEMENT DE MOT DE PASSE ---
@app.post("/api/auth/change-password")
def change_password(
    payload: schemas.PasswordChangeRequest,
    background_tasks: BackgroundTasks,
    admin: models.DashboardAdmin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    # 1. Vérifier si l'ancien mot de passe tapé correspond bien au hachage en BDD
    if not security.verify_password(payload.current_password, admin.hashed_password):
        raise HTTPException(status_code=400, detail="Le mot de passe actuel est incorrect.")
    
    # 2. Sécurité supplémentaire : vérifier que le nouveau n'est pas identique à l'ancien
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="Le nouveau mot de passe doit être différent de l'ancien.")

    # 3. Hacher le nouveau mot de passe et l'enregistrer
    admin.hashed_password = security.get_password_hash(payload.new_password)

    # Notification In-App
    notif = models.Notification(
        type="mot de passe modifié",
        title="Mot de passe modifié",
        message="Le mot de passe de votre compte a été changé avec succès.",
        admin_id=admin.id
    )
    db.add(notif)
    db.commit()

    # Envoi de l'Email
    background_tasks.add_task(
        send_soc_email,
        destinataire=os.getenv("SOC_ALERT_EMAIL", ""),
        sujet="Modification de votre mot de passe",
        type_alerte="Mot de passe modifié",
        message_alerte="Le mot de passe de votre compte d'administration a été modifié avec succès. Si vous n'êtes pas à l'origine de cette action, votre compte est potentiellement compromis."
    )

    return {"message": "Votre mot de passe a été modifié avec succès."}

# --- ROUTES DU TABLEAU DE BORD (PROTÉGÉES) ---

@app.get("/api/dashboard/stats")
def get_dashboard_stats(
    admin: models.DashboardAdmin = Depends(get_current_admin),
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
    admin: models.DashboardAdmin = Depends(get_current_admin), 
    db: Session = Depends(get_db)
):
    # 1. NETTOYAGE AUTOMATIQUE : Suppression des sites en attente depuis plus de 12h
    limite_retention = datetime.utcnow() - timedelta(hours=12)
    db.query(models.ClientSite).filter(models.ClientSite.deleted_at < limite_retention).delete()
    db.commit()

    # 2. RÉCUPÉRATION DES SITES ET DE LEURS ALERTES
    # selectinload attache la liste des objets SecurityAlert directement au modèle ClientSite
    sites = db.query(models.ClientSite).options(
        selectinload(models.ClientSite.alerts) 
    ).all()

    # 3. AJOUT DES MÉTRIQUES POUR LE DASHBOARD
    sites_with_dynamic_status = []
    maintenant = datetime.utcnow()

    for site in sites:
        # A. Déduction du statut basée sur le Heartbeat (ex: 2 heures de tolérance)
        current_status = "en_attente"

        if site.last_seen:
            diff = maintenant - site.last_seen
            # Si le dernier signal date de moins de 2 heures (7200 secondes), il est actif
            if diff.total_seconds() < 7200:
                current_status = "actif"
            else:
                current_status = "injoignable"
                
        # On s'assure d'avoir la variable alerts_count pour le composant React
        if hasattr(site, 'alerts'):
            # On filtre pour ne compter que les alertes non archivées/résolues
            active_alerts = [a for a in site.alerts if a.status != "resolved"]
            site.alerts_count = len(active_alerts)
        else:
            site.alerts_count = 0

    return sites

# --- 4. NOUVELLE ROUTE : OBTENIR LE STATUT D'UN SITE ---
@app.get("/api/sites/{site_id}/status")
def get_site_status(
    site_id: int, 
    admin: models.DashboardAdmin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    site = db.query(models.ClientSite).filter(models.ClientSite.id == site_id).first()
    
    if not site:
        raise HTTPException(status_code=404, detail="Site introuvable")

    if site.deleted_at:
        return {"status": "en_corbeille"}

    maintenant = datetime.utcnow()
    current_status = "en_attente"

    if site.last_seen:
        derniere_vue = site.last_seen
        # Sécurité de format
        if isinstance(derniere_vue, str):
            try:
                derniere_vue = datetime.fromisoformat(derniere_vue.replace("Z", "+00:00"))
            except ValueError:
                derniere_vue = maintenant

        diff = maintenant - derniere_vue
        
        # Validation du Heartbeat (2 heures max)
        if diff.total_seconds() < 7200:
            current_status = "actif"
        else:
            current_status = "injoignable"

    return {
        "status": current_status,
        "last_check": site.last_seen.isoformat() if site.last_seen else None
    }

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
    admin: models.DashboardAdmin = Depends(get_current_admin), 
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
    admin: models.DashboardAdmin = Depends(get_current_admin), 
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
    admin: models.DashboardAdmin = Depends(get_current_admin),
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
        "secret_token": raw_token
    }


# --- ROUTE DE RÉCUPÉRATION DES ALERTES D'UN ACTIF SPÉCIFIQUE ---
@app.get("/api/sites/{site_id}/alerts")
def get_site_alerts(
    site_id: int, 
    limit: int = 10,
    admin: models.DashboardAdmin = Depends(get_current_admin), 
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
    admin: models.DashboardAdmin = Depends(get_current_admin)
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

# --- ROUTE DE RÉSOLUTION D'UNE ALERTE SPÉCIFIQUE ---
@app.patch("/api/sites/{site_id}/alerts/{alert_id}/resolve")
async def resolve_security_alert(
    site_id: int, 
    alert_id: int, 
    db: Session = Depends(get_db)
):
    try:
        
        alert = db.query(models.SecurityAlert).filter(
            models.SecurityAlert.id == alert_id,
            models.SecurityAlert.site_id == site_id
        ).first()

        if not alert:
            raise HTTPException(status_code=404, detail="Alerte introuvable.")

        # On archive l'alerte
        alert.status = "resolved"
        db.commit()

        # On récupère le site et on met à jour son score
        site = db.query(models.ClientSite).filter(models.ClientSite.id == site_id).first()
        if site:
            recalculate_health_score(site, db)

        return {"message": "Alerte archivée avec succès."}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# --- ROUTE DE RÉCUPÉRATION D'UN SEUL SITE (VUE DÉTAILLÉE) ---
@app.get("/api/sites/{site_id}")
def get_single_site(
    site_id: int, 
    admin: models.DashboardAdmin = Depends(get_current_admin), 
    db: Session = Depends(get_db)
):
    # 1. Chercher le site ciblé dans la base de données
    site = db.query(models.ClientSite).filter(models.ClientSite.id == site_id).first()
    
    if not site:
        raise HTTPException(status_code=404, detail="Actif introuvable dans la flotte.")
        
    # 2. Calculer dynamiquement le nombre d'alertes associées à ce site
    alerts_count = db.query(models.SecurityAlert).filter(models.SecurityAlert.site_id == site_id).count()

     # On récupère le site et on met à jour son score
    site = db.query(models.ClientSite).filter(models.ClientSite.id == site_id).first()
    if site:
        recalculate_health_score(site, db)
    
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
        "malware_report": getattr(site, 'malware_report', []),
        "auto_scan_enabled": getattr(site, 'auto_scan_enabled', None),
        "scan_frequency": getattr(site, 'scan_frequency', None)
    }


# --- ROUTE DE SCAN FORÉNSIQUE D'UN SITE ---
@app.post("/api/sites/{site_id}/scan")
async def scan_site(
    site_id: int, 
    db: Session = Depends(get_db), 
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
        raise HTTPException(status_code=503, detail=f"Erreur de communication avec la cible")
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


# --- SYSTÈME DE CACHE POUR LA THREAT INTELLIGENCE ---
# Évite d'interroger les API externes à chaque requête (Cache valide 12 heures)
THREAT_INTEL_CACHE = {
    "data": None,
    "last_updated": 0
}
CACHE_DURATION = 3600 * 12 # 12 heures en secondes

@app.get("/api/site/threat-intel")
async def get_threat_intelligence(admin: models.DashboardAdmin = Depends(get_current_admin)):
    """
    Récupère les dernières versions sécurisées de WP et PHP.
    Agit comme un proxy pour isoler le front-end d'Internet.
    """
    global THREAT_INTEL_CACHE
    current_time = time.time()
    
    # 1. Vérification du cache : s'il est récent, on le retourne directement
    if THREAT_INTEL_CACHE["data"] and (current_time - THREAT_INTEL_CACHE["last_updated"]) < CACHE_DURATION:
        return THREAT_INTEL_CACHE["data"]
        
    # 2. Si le cache est vide ou expiré, on interroge les sources officielles
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Récupération de la version WordPress
            wp_res = await client.get("https://api.wordpress.org/core/version-check/1.7/")
            wp_res.raise_for_status()
            wp_data = wp_res.json()
            latest_wp = wp_data.get("offers", [{}])[0].get("version", None)
            
            # Récupération des versions PHP maintenues
            php_res = await client.get("https://endoflife.date/api/php.json")
            php_res.raise_for_status()
            php_data = php_res.json()
            
            today = datetime.utcnow().strftime('%Y-%m-%d')
            # On ne garde que les branches dont la date de fin de vie (eol) est dans le futur
            active_php_cycles = [v["cycle"] for v in php_data if v.get("eol", "") > today]
            latest_php = php_data[0].get("latest") if php_data else None
            
            intel_data = {
                "wp": latest_wp,
                "phpLatest": latest_php,
                "activePhpCycles": active_php_cycles
            }
            
            # Mise à jour du cache local
            THREAT_INTEL_CACHE["data"] = intel_data
            THREAT_INTEL_CACHE["last_updated"] = current_time
            
            return intel_data
            
    except Exception as e:
        # Filet de sécurité : en cas de coupure internet du serveur, on renvoie le vieux cache s'il existe
        if THREAT_INTEL_CACHE["data"]:
            return THREAT_INTEL_CACHE["data"]
        raise HTTPException(status_code=503, detail="Service de Threat Intelligence temporairement indisponible.")


# --- ROUTE DE SCAN ANTI-MALWARE D'UN SITE ---
@app.post("/api/sites/{site_id}/malware-scan")
async def run_malware_scan(
    site_id: int, 
    background_tasks: BackgroundTasks,
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
       # Dans ta fonction de scan malware (lors de la réception de la réponse PHP) :
        malwares_detectes = scan_data.get("malware_scan", [])
        liste_blanche = site.whitelisted_files or []

        # On ne garde que les malwares qui NE SONT PAS dans la liste blanche
        menaces_reelles = [m for m in malwares_detectes if m['file'] not in liste_blanche]

        site.malware_report = menaces_reelles

        # Si des fichiers malveillants sont trouvés, on fait chuter le score de santé
        if len(menaces_reelles) > 0:
            site.health_score = 0 

            # ✨ NOUVEAU : Notification In-App
            notif = models.Notification(
                type="fichier malvaillant trouvé",
                title=f"Malware(s) détecté(s) sur {site.site_name}",
                message=f"Le scan heuristique a détecté {len(menaces_reelles)} fichier(s) suspect(s) nécessitant une intervention immédiate.",
                site_id=site.id
            )
            db.add(notif)
            
            # ✨ NOUVEAU : Alerte Email à l'adresse globale du SOC
            email_destinataire = os.getenv("SOC_ALERT_EMAIL", "admin@iweb.com")
            email_msg = f"L'analyse anti-malware a détecté {len(menaces_reelles)} fichier(s) malveillant(s) ou web shells sur {site.url}.\n\nRendez-vous dans la console SOC pour neutraliser la menace."
            
            if background_tasks:
                background_tasks.add_task(
                    send_soc_email, email_destinataire, f"Alerte Critique : Malware détecté sur {site.site_name}", "Fichier malvaillant trouvé", email_msg
                )
            else:
                # Si déclenché par le Cron (qui tourne déjà en arrière-plan), on exécute directement
                send_soc_email(email_destinataire, f"Alerte Critique : Malware détecté sur {site.site_name}", "Fichier malvaillant trouvé", email_msg)
        
        db.commit()
        db.refresh(site)
        
        return {
            "message": "Analyse anti-malware terminée avec succès",
            "malware_report": menaces_reelles
        }

    # --- LE FILET DE SÉCURITÉ ---
    except httpx.ConnectTimeout:
        raise HTTPException(status_code=504, detail="Délai d'attente dépassé : Le site cible ne répond pas.")
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail=f"Erreur de communication avec la cible")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail="La sonde PHP a retourné une erreur inattendue.")
    except HTTPException:
        raise 
    except Exception as e:
        db.rollback()
        print("\n" + "="*50)
        print("🚨 ERREUR FATALE LORS DU MALWARE SCAN 🚨")
        print(traceback.format_exc())
        print("="*50 + "\n")
        raise HTTPException(status_code=500, detail=f"Erreur interne du serveur lors de l'analyse des fichiers. ({str(e)})")


# --- ROUTE DE SUPPRESSION D'UN FICHIER MALVEILLANT SUR LE SITE ---
# Modèle pour la requête de suppression
class DeleteFileRequest(BaseModel):
    file_path: str

@app.post("/api/sites/{site_id}/delete-file")
async def delete_malicious_file(
    site_id: int, 
    payload: DeleteFileRequest,
    db: Session = Depends(get_db)
):
    try:
        site = db.query(models.ClientSite).filter(models.ClientSite.id == site_id).first()
        if not site:
            raise HTTPException(status_code=404, detail="Cible introuvable.")

        base_url = site.url.rstrip('/')
        delete_endpoint = f"{base_url}/wp-json/iwebcreative/v1/delete-file"
        
        try:
            decrypted_token = security.decrypt_token(site.secret_token)
        except Exception:
            raise HTTPException(status_code=500, detail="Erreur de déchiffrement du jeton.")

        # Requête vers l'agent PHP
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                delete_endpoint,
                headers={"Authorization": f"Bearer {decrypted_token}"},
                json={"file_path": payload.file_path}
            )
            
            if response.status_code == 401:
                raise HTTPException(status_code=401, detail="Jeton de sécurité invalide.")
            
            # Si WordPress renvoie une erreur (ex: tentative de supprimer wp-config)
            if response.status_code != 200:
                err_data = response.json()
                err_msg = err_data.get('message', 'Échec de la suppression sur le serveur distant.')
                raise HTTPException(status_code=response.status_code, detail=err_msg)

        # Si le fichier est bien supprimé, on le retire du JSON dans la base de données PostgreSQL
        if site.malware_report:
            updated_report = [f for f in site.malware_report if f.get('file') != payload.file_path]
            site.malware_report = updated_report
            
            # Si c'était la dernière menace, on remonte le score de santé à 100
            if len(updated_report) == 0:
                site.health_score = 100 
                
            db.commit()

            # ✨ NOUVEAU : On recalcule le score global
            recalculate_health_score(site, db)

        return {"message": "Payload détruit avec succès."}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# --- ROUTE DE RÉGÉNÉRATION DU TOKEN D'UN SITE ---
@app.post("/api/sites/{site_id}/regenerate-token")
def regenerate_site_token(
    site_id: int, 
    admin: models.DashboardAdmin = Depends(get_current_admin), 
    db: Session = Depends(get_db)
):
    """
    Révoque l'ancien token d'un site et en génère un nouveau cryptographiquement sécurisé.
    Action critique (Key Rotation).
    """
    # 1. Vérification de l'existence du site
    site = db.query(models.ClientSite).filter(models.ClientSite.id == site_id).first()
    
    if not site:
        raise HTTPException(status_code=404, detail="Cible introuvable.")

    # 1. Génération du token en clair (celui qu'on va montrer à l'admin)
    raw_token = f"IWEB_{secrets.token_urlsafe(32)}"
    
    # 2. CHIFFREMENT SYMÉTRIQUE (Réversible) au lieu du hachage
    encrypted_token = security.encrypt_token(raw_token)

    # 3. Révocation et mise à jour dans la base de données
    # ⚠️ IMPORTANT : Remplace 'site_token' par le nom exact de ta colonne dans ton modèle (ex: api_key, token, etc.)
    site.secret_token = encrypted_token 
    
    db.commit()
    db.refresh(site)

    # 4. Retour des nouvelles informations
    return {
        "message": "Clé cryptographique révoquée et régénérée avec succès.",
        "site_id": site.id,
        "new_token": raw_token  # 🔑 Le token en clair pour l'admin (à copier immédiatement)
    }


from pydantic import BaseModel

class FileActionRequest(BaseModel):
    file_path: str

from sqlalchemy.orm.attributes import flag_modified

@app.post("/api/sites/{site_id}/whitelist-file")
def whitelist_site_file(
    site_id: int,
    payload: FileActionRequest,
    admin: models.DashboardAdmin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Marque un fichier comme "Sain" (Faux Positif).
    Il sera retiré des alertes actuelles et ignoré lors des prochains scans.
    """
    # 1. Vérifier que le site existe
    site = db.query(models.ClientSite).filter(models.ClientSite.id == site_id).first()
    
    if not site:
        raise HTTPException(status_code=404, detail="Cible introuvable.")

    # 2. Initialiser la liste blanche si elle est vide
    if site.whitelisted_files is None:
        site.whitelisted_files = []

    # 3. Ajouter le fichier à la liste blanche (s'il n'y est pas déjà)
    if payload.file_path not in site.whitelisted_files:
        # On clone la liste, on ajoute, puis on réaffecte pour forcer SQLAlchemy à voir le changement du JSON
        current_whitelist = list(site.whitelisted_files)
        current_whitelist.append(payload.file_path)
        site.whitelisted_files = current_whitelist

    # 4. Nettoyer le rapport actuel (supprimer le fichier des malwares détectés)
    if site.malware_report:
        # On filtre pour garder tous les fichiers SAUF celui qu'on vient de whitelister
        updated_report = [
            fichier for fichier in site.malware_report 
            if fichier.get('file') != payload.file_path
        ]
        site.malware_report = updated_report
        
    # 5. Forcer la mise à jour des colonnes JSON dans PostgreSQL
    flag_modified(site, "whitelisted_files")
    flag_modified(site, "malware_report")

    db.commit()

     # On récupère le site et on met à jour son score
    site = db.query(models.ClientSite).filter(models.ClientSite.id == site_id).first()
    if site:
        recalculate_health_score(site, db)

    return {
        "success": True, 
        "message": "Fichier ajouté à la liste blanche d'exceptions avec succès."
    }

# --- ROUTE DE MISE À JOUR DES PARAMÈTRES D'UN SITE (auto scan) ---
@app.patch("/api/sites/{site_id}/settings")
def update_site_settings(
    site_id: int,
    settings: schemas.SiteSettingsUpdate,
    admin: models.DashboardAdmin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Met à jour la configuration (ex: Auto-scan) d'un site."""
    site = db.query(models.ClientSite).filter(models.ClientSite.id == site_id).first()
    
    if not site:
        raise HTTPException(status_code=404, detail="Cible introuvable.")
    
    # On met à jour uniquement les champs envoyés
    if settings.auto_scan_enabled is not None:
        site.auto_scan_enabled = settings.auto_scan_enabled
    if settings.scan_frequency is not None:
        site.scan_frequency = settings.scan_frequency
        
    db.commit()
    
    return {
        "message": "Configuration mise à jour",
        "auto_scan_enabled": site.auto_scan_enabled,
        "scan_frequency": site.scan_frequency
    }


# --- ROUTE : Récupérer toutes les notifications de l'admin ---
@app.get("/api/notifications")
def get_admin_notifications(
    admin: models.DashboardAdmin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    # On récupère les 30 dernières notifications, de la plus récente à la plus ancienne
    notifications = db.query(models.Notification)\
        .order_by(models.Notification.created_at.desc())\
        .limit(30)\
        .all()
    return notifications

# --- ROUTE : Marquer une notification comme lue ---
@app.patch("/api/notifications/{notification_id}/read")
def mark_notification_as_read(
    notification_id: int,
    admin: models.DashboardAdmin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    notif = db.query(models.Notification).filter(models.Notification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification introuvable.")
    
    notif.is_read = True
    db.commit()
    return {"status": "success", "message": "Notification marquée comme lue."}


# --- ROUTE DE HEARTBEAT DE L'AGENT PHP POUR SIGNALER SON ÉTAT ---
@app.post("/api/agent/heartbeat")
def agent_heartbeat(request: Request, db: Session = Depends(get_db)):
    # 1. Récupération du token depuis le header HTTP
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token manquant ou invalide")
    
    token_recu = auth_header.split(" ")[1]

    # 2. Recherche du site correspondant via la DÉCHIFFREMENT sécurisé (Fernet)
    sites = db.query(models.ClientSite).all()
    site_trouve = None
    
    for site in sites:
        try:
            # On utilise la même logique que pour la réception des alertes
            decrypted_token = security.decrypt_token(site.secret_token)
            if token_recu == decrypted_token:
                site_trouve = site
                break
        except Exception:
            continue
            
    if not site_trouve:
        raise HTTPException(status_code=401, detail="Agent non autorisé : Jeton invalide.")

    # 3. Mise à jour de l'heure du dernier signe de vie
    site_trouve.last_seen = datetime.utcnow()
    db.commit()

    return {"status": "success", "message": "Heartbeat enregistré avec succès."}

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
import asyncio

# --- MOTEUR DE TÂCHES AUTOMATIQUES (CRON) ---
scheduler = BackgroundScheduler()

def run_automated_scans():
    """
    Fonction exécutée en tâche de fond. 
    Elle ouvre une session BDD séparée car elle tourne hors du contexte web classique.
    """
    print("🤖 [Scheduler] Vérification des scans automatiques en attente...")
    db = SessionLocal()
    try:
        # On cherche tous les sites avec auto_scan activé
        sites_to_scan = db.query(models.ClientSite).filter(models.ClientSite.auto_scan_enabled == True).all()
        
        for site in sites_to_scan:
            # Si le site n'a jamais été scanné, ou si le dernier scan date de plus de X heures
            needs_scan = False
            if not site.last_scan_at:
                needs_scan = True
            else:
                heures_ecoulees = (datetime.utcnow() - site.last_scan_at).total_seconds() / 3600
                if heures_ecoulees >= site.scan_frequency:
                    needs_scan = True
            
            if needs_scan:
                print(f"🔄 [Scheduler] Démarrage du scan automatique pour le site #{site.id}...")
                # Étant donné que tes fonctions de scan (run_malware_scan, scan_site) sont asynchrones,
                # il faut les lancer proprement depuis ce thread synchrone
                asyncio.run(scan_site(site.id, db))
                asyncio.run(run_malware_scan(site.id, db))
                print(f"✅ [Scheduler] Scan terminé pour le site #{site.id}.")

                # ✨ LA SÉCURITÉ RÉSEAU EST ICI ✨
                # On force le backend à souffler pendant 5 secondes avant d'attaquer le site suivant
                time.sleep(5)
                
    except Exception as e:
        print(f"🚨 [Scheduler] Erreur critique : {str(e)}")
    finally:
        db.close()

# On attache le planificateur au cycle de vie de FastAPI
@app.on_event("startup")
def start_scheduler():
    # Le planificateur vérifie toutes les 1 heures (hours=1) s'il y a des scans à faire
    scheduler.add_job(run_automated_scans, IntervalTrigger(hours=1))
    scheduler.start()
    print("⏱️ Planificateur de tâches (APScheduler) démarré.")

@app.on_event("shutdown")
def stop_scheduler():
    scheduler.shutdown()





# --- HACK TEMPORAIRE POUR INJECTER LE PREMIER ADMINISTRATEUR ---
# @app.get("/setup-admin")
# def setup_first_admin(db: Session = Depends(get_db)):
#     # Vérifie si le compte existe déjà pour éviter les doublons
#     admin_existe = db.query(models.DashboardAdmin).filter(models.DashboardAdmin.email == "admin@iweb.com").first()
#     if admin_existe:
#         return {"message": "Le compte admin@iweb.com existe déjà !"}
    
#     # Hachage sécurisé du mot de passe
#     mot_de_passe_hache = security.get_password_hash("SuperAdmin2026!")
    
#     nouveau_admin = models.DashboardAdmin(
#         email="admin@iweb.com",
#         hashed_password=mot_de_passe_hache,
#         role="superadmin"
#     )
#     db.add(nouveau_admin)
#     db.commit()
    
#     return {"message": "Compte administrateur créé avec succès : admin@iweb.com / SuperAdmin2026!"}

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

