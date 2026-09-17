"""
===============================================================================
Module      : auth.py (Routeur FastAPI)
Rôle        : Gestion de l'authentification et de la sécurité des accès SOC
Description :
    Ce fichier gère l'authentification des administrateurs du tableau de bord.
    Il inclut la connexion via JWT (stocké en cookie HttpOnly pour bloquer le XSS), 
    la rotation des mots de passe, et la gestion complète de l'Authentification 
    Multi-Facteurs (MFA) avec génération de codes TOTP et de codes de secours.
===============================================================================
"""

import os
import json
import secrets
import pyotp
from fastapi import APIRouter, Depends, HTTPException, Response, BackgroundTasks, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

# Import des modèles, schémas et utilitaires de sécurité
import app.models.models as models
import app.schemas.schemas as schemas
import app.security.security as security

# Import des dépendances communes et services
from app.dependencies import get_db, get_current_admin
from app.services.email_service import send_soc_email

# Création du routeur avec son préfixe et son tag pour la documentation (Swagger)
router = APIRouter(
    prefix="/api/auth",
    tags=["Authentification"]
)

# Dictionnaire en mémoire pour le Rate Limiting { "ip_address": [timestamp1, timestamp2, ...] }
FAILED_LOGIN_ATTEMPTS = {}
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_TIME = timedelta(minutes=15)


# --- ROUTE DE CONNEXION ---
@router.post("/login")
def login_admin(
    request: Request,
    credentials: schemas.AdminLogin, 
    response: Response, 
    db: Session = Depends(get_db)
):
    client_ip = request.client.host
    now = datetime.utcnow()

    # 1. VÉRIFICATION DU RATE LIMITING
    if client_ip in FAILED_LOGIN_ATTEMPTS:
        # Nettoie les anciennes tentatives hors de la fenêtre de temps
        attempts = [t for t in FAILED_LOGIN_ATTEMPTS[client_ip] if now - t < LOCKOUT_TIME]
        FAILED_LOGIN_ATTEMPTS[client_ip] = attempts
        
        if len(attempts) >= MAX_LOGIN_ATTEMPTS:
            raise HTTPException(
                status_code=429, 
                detail="Trop de tentatives échouées. Compte verrouillé temporairement (15 min)."
            )

    # 2. On cherche l'administrateur par son email
    admin = db.query(models.DashboardAdmin).filter(models.DashboardAdmin.email == credentials.email).first()
    
    # 3. Vérification avec enregistrement de l'échec pour le Rate Limit
    if not admin or not security.verify_password(credentials.password, admin.hashed_password):
        FAILED_LOGIN_ATTEMPTS.setdefault(client_ip, []).append(now) # ✨ Enregistre l'échec
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    if admin.is_active == 0:
        raise HTTPException(status_code=403, detail="Ce compte a été désactivé")

    # Réinitialisation des compteurs d'échec
    if client_ip in FAILED_LOGIN_ATTEMPTS:
        del FAILED_LOGIN_ATTEMPTS[client_ip]
    
    

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
@router.get("/verify")
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

# --- ROUTE 1 : GÉNÉRATION DU SECRET ET DU QR CODE (SÉCURISÉ PAR MOT DE PASSE) ---
@router.post("/mfa/setup") # Attention : C'est un POST maintenant
def setup_mfa(
    payload: schemas.RecoveryCodesRequest, # On réutilise ton schéma qui demande un mot de passe
    admin: models.DashboardAdmin = Depends(get_current_admin), 
    db: Session = Depends(get_db)
):
    """
    Génère un nouveau secret TOTP pour l'administrateur après vérification du mot de passe.
    Retourne l'URI de provisionnement pour générer le QR Code côté frontend.
    """
    # 1. Vérification de l'identité (Le correctif de sécurité)
    if not security.verify_password(payload.password, admin.hashed_password):
        raise HTTPException(status_code=400, detail="Mot de passe incorrect.")

    # 2. On génère une clé secrète aléatoire en Base32
    secret = pyotp.random_base32()
    
    # 3. On sauvegarde ce secret dans la base de données
    admin.mfa_secret = secret
    admin.mfa_enabled = False
    db.commit()
    
    # 4. On crée l'URL compatible avec les applications d'authentification
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=admin.email, 
        issuer_name="FleetGuard SOC"
    )
    
    return {
        "secret": secret, 
        "qr_uri": provisioning_uri 
    }

# --- ROUTE 2 : VALIDATION ET ACTIVATION DÉFINITIVE ---
@router.post("/mfa/enable")
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
@router.post("/mfa/regenerate-recovery-codes")
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
@router.post("/logout")
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
@router.post("/change-password")
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

# --- ROUTE : DEMANDE DE RÉINITIALISATION (FORGOT PASSWORD) ---
@router.post("/forgot-password")
def forgot_password(
    payload: schemas.ForgotPasswordRequest, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db)
):
    try:
        admin = db.query(models.DashboardAdmin).filter(models.DashboardAdmin.email == payload.email).first()
        
        if admin:
            # ✨ SÉCURITÉ : Empreinte du mot de passe actuel
            pwd_fingerprint = admin.hashed_password[-10:] if admin.hashed_password else "none"

            # Création avec le rôle, l'empreinte, et une durée stricte de 30 minutes
            reset_token = security.create_access_token(
                data={
                    "sub": admin.email, 
                    "role": "reset_password",
                    "fingerprint": pwd_fingerprint
                },
                expires_delta=timedelta(minutes=30)
            )
            
            reset_link = f"http://localhost:5173/reset-password?token={reset_token}"
            
            background_tasks.add_task(
                send_soc_email,
                destinataire=admin.email,
                sujet="Demande de réinitialisation de mot de passe",
                type_alerte="Sécurité Compte",
                message_alerte=f"Cliquez sur ce lien pour configurer un nouveau mot de passe (valide 30 min) : {reset_link}"
            )

        return {"message": "Si cette adresse existe, un email contenant les instructions a été envoyé."}
        
    except Exception as e:
        import traceback
        print("\n🚨 ERREUR FORGOT PASSWORD 🚨\n", traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur interne du serveur.")
    
# --- ROUTE : VALIDATION DU NOUVEAU MOT DE PASSE ---
@router.post("/reset-password")
def reset_password(payload: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    # 1. Décodage et vérification de la signature
    decoded_data = security.decode_access_token(payload.token) 
    
    if not decoded_data or decoded_data.get("role") != "reset_password":
        raise HTTPException(status_code=400, detail="Lien invalide ou expiré.")
        
    admin_email = decoded_data.get("sub")
    admin = db.query(models.DashboardAdmin).filter(models.DashboardAdmin.email == admin_email).first()
    
    if not admin:
        raise HTTPException(status_code=404, detail="Compte introuvable.")

    # ✨ 2. SÉCURITÉ : VÉRIFICATION DE L'USAGE UNIQUE
    current_fingerprint = admin.hashed_password[-10:] if admin.hashed_password else "none"
    if decoded_data.get("fingerprint") != current_fingerprint:
        raise HTTPException(status_code=400, detail="Ce lien de réinitialisation a déjà été utilisé.")

    # 3. Validation réussie : on écrase l'ancien mot de passe
    admin.hashed_password = security.get_password_hash(payload.new_password)
    db.commit()

    return {"message": "Votre mot de passe a été modifié avec succès."}