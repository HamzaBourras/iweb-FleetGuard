import time
import asyncio
from datetime import datetime
from fastapi import APIRouter, Request, Depends, HTTPException
from sqlalchemy.orm import Session
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

# Imports internes
import app.models.models as models
import app.security.security as security
from app.database import SessionLocal
from app.dependencies import get_db

# On importe les fonctions de scan depuis le routeur des sites
from app.routers.sites import scan_site, run_malware_scan

router = APIRouter(
    prefix="/api/agent",
    tags=["Agent Distant & Tâches Automatiques"]
)

# --- ROUTE DE HEARTBEAT DE L'AGENT PHP POUR QUE L'AGENT PUISSE ÊTRE IDENTIFIÉ ---
@router.post("/heartbeat")
def agent_heartbeat(request: Request, db: Session = Depends(get_db)):
    # 1. Récupération du token depuis le header HTTP
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token manquant ou invalide")
    
    token_recu = auth_header.split(" ")[1]

    # 2. Recherche du site correspondant via le DÉCHIFFREMENT sécurisé (Fernet)
    sites = db.query(models.ClientSite).all()
    site_trouve = None
    
    for site in sites:
        try:
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



# --- MOTEUR DE TÂCHES AUTOMATIQUES (CRON) POUR LES SCANS AUTOMATIQUES ---
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
            needs_scan = False
            if not site.last_scan_at:
                needs_scan = True
            else:
                heures_ecoulees = (datetime.utcnow() - site.last_scan_at).total_seconds() / 3600
                if heures_ecoulees >= site.scan_frequency:
                    needs_scan = True
            
            if needs_scan:
                print(f"🔄 [Scheduler] Démarrage du scan automatique pour le site #{site.id}...")
                
                # Exécution des fonctions de scan asynchrones depuis ce thread synchrone
                asyncio.run(scan_site(site.id, db))
                
                # ✨ CORRECTION : Ajout de 'None' pour le paramètre background_tasks
                asyncio.run(run_malware_scan(site.id, None, db))
                
                print(f"✅ [Scheduler] Scan terminé pour le site #{site.id}.")

                # On force le backend à souffler pendant 5 secondes avant d'attaquer le site suivant
                time.sleep(5)
                
    except Exception as e:
        print(f"🚨 [Scheduler] Erreur critique : {str(e)}")
    finally:
        db.close()

# On attache le planificateur au cycle de vie du Routeur
@router.on_event("startup")
def start_scheduler():
    # Le planificateur vérifie toutes les 1 heures s'il y a des scans à faire
    scheduler.add_job(run_automated_scans, IntervalTrigger(hours=1))
    scheduler.start()
    print("⏱️ Planificateur de tâches (APScheduler) démarré.")

@router.on_event("shutdown")
def stop_scheduler():
    scheduler.shutdown()
