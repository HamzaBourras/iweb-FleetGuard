"""
===============================================================================
Module      : sites.py (Routeur FastAPI)
Rôle        : Gestion du parc informatique (Cibles WordPress) et Investigations
Description : 
    Ce fichier centralise toutes les opérations liées aux sites clients. 
    Il gère le CRUD des sites, la rotation cryptographique des jetons (Key Rotation),
    ainsi que les requêtes actives (Pull) vers les agents distants pour 
    les audits forénsiques (SBOM, Versions) et les scans anti-malware (EDR).
    Il inclut également la logique de remédiation (Destruction de fichiers, Whitelist).
===============================================================================
"""

import os
import secrets
import time
import httpx
import traceback
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.orm.attributes import flag_modified
from pydantic import BaseModel

# Import des modèles, schémas et utilitaires de sécurité
import app.models.models as models
import app.schemas.schemas as schemas
import app.security.security as security

# Import des dépendances communes et services
from app.dependencies import get_db, get_current_admin
from app.services.email_service import send_soc_email

router = APIRouter(
    prefix="/api/sites",
    tags=["Gestion des Sites"]
)


# --- FONCTION UTILITAIRE : RECALCUL DU SCORE DE SANTÉ ---
def recalculate_health_score(site, db: Session):
    """
    Recalcule le score de santé du site basé sur les menaces actives.
    """
    has_malware = len(site.malware_report) > 0 if site.malware_report else False
    
    if has_malware:
        site.health_score = 0
    else:
        active_alerts = db.query(models.SecurityAlert).filter(
            models.SecurityAlert.site_id == site.id,
            models.SecurityAlert.status != "resolved"
        ).all()
        
        if not active_alerts:
            site.health_score = 100
        else:
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
            
            new_score = 100 - penalite_score
            site.health_score = max(20, new_score)

    db.commit()
    db.refresh(site)


# --- ROUTE : RÉCUPÉRATION DE TOUS LES SITES ---
@router.get("")
def get_all_sites(
    admin: models.DashboardAdmin = Depends(get_current_admin), 
    db: Session = Depends(get_db)
):
    # 1. NETTOYAGE AUTOMATIQUE : Suppression des sites en attente depuis plus de 12h
    limite_retention = datetime.utcnow() - timedelta(hours=12)
    db.query(models.ClientSite).filter(models.ClientSite.deleted_at < limite_retention).delete()
    db.commit()

    # 2. RÉCUPÉRATION DES SITES ET DE LEURS ALERTES
    sites = db.query(models.ClientSite).options(
        selectinload(models.ClientSite.alerts) 
    ).all()

    maintenant = datetime.utcnow()

    for site in sites:
        current_status = "en_attente"

        if site.last_seen:
            diff = maintenant - site.last_seen
            if diff.total_seconds() < 7200:
                current_status = "actif"
            else:
                current_status = "injoignable"
                
        if hasattr(site, 'alerts'):
            active_alerts = [a for a in site.alerts if a.status != "resolved"]
            site.alerts_count = len(active_alerts)
        else:
            site.alerts_count = 0

    return sites

# --- ROUTE : CRÉATION D'UN SITE ---
@router.post("")
def create_site(
    site_data: schemas.SiteCreate,
    admin: models.DashboardAdmin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    # 1. Génération du token en clair
    raw_token = f"IWEB_{secrets.token_urlsafe(32)}"
    
    # 2. Chiffrement symétrique
    encrypted_token = security.encrypt_token(raw_token)
    
    # 3. Sauvegarde dans PostgreSQL
    nouveau_site = models.ClientSite(
        site_name=site_data.site_name,
        url=site_data.url,
        secret_token=encrypted_token 
    )
    
    db.add(nouveau_site)
    db.commit()
    db.refresh(nouveau_site) 
    
    # 4. On renvoie le token en clair pour l'affichage unique
    return {
        "id": nouveau_site.id,
        "site_name": nouveau_site.site_name,
        "url": nouveau_site.url,
        "secret_token": raw_token
    }

# --- ROUTE : VUE DÉTAILLÉE D'UN SEUL SITE ---
@router.get("/{site_id:int}")
def get_single_site(
    site_id: int, 
    admin: models.DashboardAdmin = Depends(get_current_admin), 
    db: Session = Depends(get_db)
):
    site = db.query(models.ClientSite).filter(models.ClientSite.id == site_id).first()
    
    if not site:
        raise HTTPException(status_code=404, detail="Actif introuvable dans la flotte.")
        
    alerts_count = db.query(models.SecurityAlert).filter(models.SecurityAlert.site_id == site_id).count()

    # Recalculer le score avant de renvoyer
    recalculate_health_score(site, db)
    
    return {
        "id": site.id,
        "site_name": site.site_name,
        "url": site.url,
        "status": "actif" if not site.deleted_at else "corbeille",
        "health_score": getattr(site, 'health_score', 0),
        "wp_version": getattr(site, 'wp_version', None),
        "php_version": getattr(site, 'php_version', None),
        "last_scan_at": getattr(site, 'last_scan_at', None),
        "plugins_inventory": getattr(site, 'plugins_inventory', []), 
        "alerts_count": alerts_count,
        "last_admin_login": getattr(site, 'last_admin_login', None),
        "last_admin_ip": getattr(site, 'last_admin_ip', None),
        "malware_report": getattr(site, 'malware_report', []),
        "auto_scan_enabled": getattr(site, 'auto_scan_enabled', None),
        "scan_frequency": getattr(site, 'scan_frequency', None)
    }


# --- ROUTE : PING VERS L'AGENT (VÉRIFICATION DE CONNEXION LÉGÈRE) ---
@router.post("/{site_id:int}/ping")
async def ping_site_agent(
    site_id: int, 
    db: Session = Depends(get_db), 
    admin: Optional[models.DashboardAdmin] = Depends(get_current_admin), 
):
    site = db.query(models.ClientSite).filter(models.ClientSite.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Cible introuvable.")

    base_url = site.url.rstrip('/')
    timestamp_actuel = int(time.time())
    
    # ✨ LA CORRECTION EST ICI : On cible la nouvelle API /status
    status_endpoint = f"{base_url}/wp-json/iwebcreative/v1/status?nocache={timestamp_actuel}"

    try:
        decrypted_token = security.decrypt_token(site.secret_token)
    except Exception:
        raise HTTPException(status_code=500, detail="Jeton illisible.")

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                status_endpoint, # <-- On utilise la nouvelle variable ici
                headers={"Authorization": f"Bearer {decrypted_token}"}
            )
            
            if response.status_code == 200:
                site.last_seen = datetime.utcnow()
                db.commit()
                return {"status": "success", "message": "Site en ligne."}
            else:
                raise HTTPException(status_code=response.status_code, detail="Le site a refusé la connexion.")
                
    except Exception as e:
        raise HTTPException(status_code=503, detail="Site injoignable.")
    

# --- ROUTE : OBTENIR LE STATUT (LIVESTATUS) ---
@router.get("/{site_id:int}/status")
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
        if isinstance(derniere_vue, str):
            try:
                derniere_vue = datetime.fromisoformat(derniere_vue.replace("Z", "+00:00"))
            except ValueError:
                derniere_vue = maintenant

        diff = maintenant - derniere_vue
        
        if diff.total_seconds() < 7200:
            current_status = "actif"
        else:
            current_status = "injoignable"

    return {
        "status": current_status,
        "last_check": site.last_seen.isoformat() if site.last_seen else None
    }

# --- ROUTE : MISE EN CORBEILLE ---
@router.delete("/{site_id:int}")
def soft_delete_site(
    site_id: int, 
    admin: models.DashboardAdmin = Depends(get_current_admin), 
    db: Session = Depends(get_db)
):
    site = db.query(models.ClientSite).filter(models.ClientSite.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site introuvable")
    
    site.deleted_at = datetime.utcnow()
    db.commit()
    return {"message": "Le site a été placé en corbeille pour 12 heures."}

# --- ROUTE : RESTAURATION ---
@router.put("/{site_id:int}/restore")
def restore_site(
    site_id: int, 
    admin: models.DashboardAdmin = Depends(get_current_admin), 
    db: Session = Depends(get_db)
):
    site = db.query(models.ClientSite).filter(models.ClientSite.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site introuvable")
    
    site.deleted_at = None
    db.commit()
    return {"message": "Le site a été restauré avec succès."}

# --- ROUTE : RÉGÉNÉRATION DU TOKEN ---
@router.post("/{site_id:int}/regenerate-token")
def regenerate_site_token(
    site_id: int, 
    admin: models.DashboardAdmin = Depends(get_current_admin), 
    db: Session = Depends(get_db)
):
    site = db.query(models.ClientSite).filter(models.ClientSite.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Cible introuvable.")

    raw_token = f"IWEB_{secrets.token_urlsafe(32)}"
    encrypted_token = security.encrypt_token(raw_token)

    site.secret_token = encrypted_token 
    db.commit()
    db.refresh(site)

    return {
        "message": "Clé cryptographique révoquée et régénérée avec succès.",
        "site_id": site.id,
        "new_token": raw_token
    }

# --- ROUTE : MISE À JOUR DES PARAMÈTRES (Auto-scan) ---
@router.patch("/{site_id:int}/settings")
def update_site_settings(
    site_id: int,
    settings: schemas.SiteSettingsUpdate,
    admin: models.DashboardAdmin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    site = db.query(models.ClientSite).filter(models.ClientSite.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Cible introuvable.")
    
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

# =====================================================================
# SECTIONS : RÉSEAU & SCANS AGENT
# =====================================================================

# --- ROUTE : SCAN FORÉNSIQUE D'UN SITE ---
@router.post("/{site_id:int}/scan")
async def scan_site(
    site_id: int, 
    db: Session = Depends(get_db), 
    admin: models.DashboardAdmin = Depends(get_current_admin),
):
    site = db.query(models.ClientSite).filter(models.ClientSite.id == site_id).first()
    
    if not site:
        raise HTTPException(status_code=404, detail="Cible introuvable dans la flotte.")

    base_url = site.url.rstrip('/')
    timestamp_actuel = int(time.time())
    health_endpoint = f"{base_url}/wp-json/iwebcreative/v1/health?nocache={timestamp_actuel}"

    try:
        decrypted_token = security.decrypt_token(site.secret_token)
    except Exception:
        raise HTTPException(status_code=500, detail="Erreur interne : Impossible de déchiffrer le jeton de l'actif.")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                health_endpoint,
                headers={"Authorization": f"Bearer {decrypted_token}"}
            )
            if response.status_code == 401:
                raise HTTPException(status_code=401, detail="Accès refusé par la cible : Jeton de sécurité invalide ou révoqué.")
            response.raise_for_status()
            scan_data = response.json()
    except httpx.ConnectTimeout:
        raise HTTPException(status_code=504, detail="Délai d'attente dépassé : Le site cible ne répond pas.")
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail=f"Erreur de communication avec la cible")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail="La sonde PHP a retourné une erreur inattendue.")

    try:
        site.wp_version = scan_data.get("core", {}).get("wp_version")
        site.php_version = scan_data.get("core", {}).get("php_version")
        site.plugins_inventory = scan_data.get("plugins", []) 

        admin_login_str = scan_data.get("last_admin_login")
        if admin_login_str:
            site.last_admin_login = datetime.strptime(admin_login_str, '%Y-%m-%d %H:%M:%S')
            
        site.last_admin_ip = scan_data.get("last_admin_ip")
        
        db.commit()
        db.refresh(site)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erreur lors de la sauvegarde des résultats du scan.")

    return {
        "message": "Analyse forensique terminée avec succès",
        "telemetry": scan_data
    }

# --- ROUTE : SCAN ANTI-MALWARE ---
@router.post("/{site_id:int}/malware-scan")
async def run_malware_scan(
    site_id: int, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: models.DashboardAdmin = Depends(get_current_admin),
):
    try:
        site = db.query(models.ClientSite).filter(models.ClientSite.id == site_id).first()
        if not site:
            raise HTTPException(status_code=404, detail="Cible introuvable dans la flotte.")

        base_url = site.url.rstrip('/')
        timestamp_actuel = int(time.time())
        scan_endpoint = f"{base_url}/wp-json/iwebcreative/v1/malware-scan?nocache={timestamp_actuel}"

        try:
            decrypted_token = security.decrypt_token(site.secret_token)
        except Exception:
            raise HTTPException(status_code=500, detail="Impossible de déchiffrer le jeton de l'actif.")

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(
                scan_endpoint,
                headers={"Authorization": f"Bearer {decrypted_token}"} 
            )
            if response.status_code == 401:
                raise HTTPException(status_code=401, detail="Accès refusé par la cible : Jeton de sécurité invalide ou révoqué.")
            response.raise_for_status()
            scan_data = response.json()

        site.last_scan_at = datetime.utcnow()

        malwares_detectes = scan_data.get("malware_scan", [])
        liste_blanche = site.whitelisted_files or []

        menaces_reelles = [m for m in malwares_detectes if m['file'] not in liste_blanche]
        site.malware_report = menaces_reelles

        if len(menaces_reelles) > 0:
            site.health_score = 0 

            notif = models.Notification(
                type="fichier malvaillant trouvé",
                title=f"Malware(s) détecté(s) sur {site.site_name}",
                message=f"Le scan heuristique a détecté {len(menaces_reelles)} fichier(s) suspect(s) nécessitant une intervention immédiate.",
                site_id=site.id
            )
            db.add(notif)
            
            email_destinataire = os.getenv("SOC_ALERT_EMAIL", "admin@iweb.com")
            email_msg = f"L'analyse anti-malware a détecté {len(menaces_reelles)} fichier(s) malveillant(s) ou web shells sur {site.url}.\n\nRendez-vous dans la console SOC pour neutraliser la menace."
            
            if background_tasks:
                background_tasks.add_task(
                    send_soc_email, email_destinataire, f"Alerte Critique : Malware détecté sur {site.site_name}", "Fichier malvaillant trouvé", email_msg
                )
            else:
                send_soc_email(email_destinataire, f"Alerte Critique : Malware détecté sur {site.site_name}", "Fichier malvaillant trouvé", email_msg)
        
        db.commit()
        db.refresh(site)
        
        return {
            "message": "Analyse anti-malware terminée avec succès",
            "malware_report": menaces_reelles
        }

    except httpx.ConnectTimeout:
        raise HTTPException(status_code=504, detail="Délai d'attente dépassé : Le site cible ne répond pas.")
    except httpx.RequestError:
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

# --- ROUTE : SUPPRESSION D'UN FICHIER MALVEILLANT SUR LE SITE ---
@router.post("/{site_id:int}/delete-file")
async def delete_malicious_file(
    site_id: int, 
    payload: schemas.DeleteFileRequest,
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

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                delete_endpoint,
                headers={"Authorization": f"Bearer {decrypted_token}"},
                json={"file_path": payload.file_path}
            )
            
            if response.status_code == 401:
                raise HTTPException(status_code=401, detail="Jeton de sécurité invalide.")
            
            if response.status_code != 200:
                err_data = response.json()
                err_msg = err_data.get('message', 'Échec de la suppression sur le serveur distant.')
                raise HTTPException(status_code=response.status_code, detail=err_msg)

        if site.malware_report:
            updated_report = [f for f in site.malware_report if f.get('file') != payload.file_path]
            site.malware_report = updated_report
            
            if len(updated_report) == 0:
                site.health_score = 100 
                
            db.commit()
            recalculate_health_score(site, db)

        return {"message": "Payload détruit avec succès."}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# --- ROUTE : MARQUER UN FICHIER COMME SAIN (WHITELIST) ---
@router.post("/{site_id:int}/whitelist-file")
def whitelist_site_file(
    site_id: int,
    payload: schemas.FileActionRequest,
    admin: models.DashboardAdmin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    site = db.query(models.ClientSite).filter(models.ClientSite.id == site_id).first()
    
    if not site:
        raise HTTPException(status_code=404, detail="Cible introuvable.")

    if site.whitelisted_files is None:
        site.whitelisted_files = []

    if payload.file_path not in site.whitelisted_files:
        current_whitelist = list(site.whitelisted_files)
        current_whitelist.append(payload.file_path)
        site.whitelisted_files = current_whitelist

    if site.malware_report:
        updated_report = [
            fichier for fichier in site.malware_report 
            if fichier.get('file') != payload.file_path
        ]
        site.malware_report = updated_report
        
    flag_modified(site, "whitelisted_files")
    flag_modified(site, "malware_report")

    db.commit()
    recalculate_health_score(site, db)

    return {
        "success": True, 
        "message": "Fichier ajouté à la liste blanche d'exceptions avec succès."
    }

# =====================================================================
# SECTIONS : GESTION DES ALERTES LIÉES AU SITE
# =====================================================================

# --- ROUTE : RÉCUPÉRER LES ALERTES D'UN SITE ---
@router.get("/{site_id:int}/alerts")
def get_site_alerts(
    site_id: int, 
    limit: int = 10,
    admin: models.DashboardAdmin = Depends(get_current_admin), 
    db: Session = Depends(get_db)
):
    alerts = db.query(models.SecurityAlert)\
        .filter(models.SecurityAlert.site_id == site_id)\
        .order_by(models.SecurityAlert.timestamp.desc())\
        .limit(limit)\
        .all()
    
    return alerts

# --- ROUTE : RÉSOUDRE UNE ALERTE SPÉCIFIQUE ---
@router.patch("/{site_id:int}/alerts/{alert_id}/resolve")
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

        alert.status = "resolved"
        db.commit()

        site = db.query(models.ClientSite).filter(models.ClientSite.id == site_id).first()
        if site:
            recalculate_health_score(site, db)

        return {"message": "Alerte archivée avec succès."}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# --- SYSTÈME DE CACHE POUR LA THREAT INTELLIGENCE ---
# Évite d'interroger les API externes à chaque requête (Cache valide 12 heures)
THREAT_INTEL_CACHE = {
    "data": None,
    "last_updated": 0
}
CACHE_DURATION = 3600 * 12 # 12 heures en secondes

@router.get("/threat-intel")
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
