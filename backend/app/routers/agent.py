"""
===============================================================================
Module      : agent.py (Routeur FastAPI & APScheduler)
Rôle        : Planificateur de Tâches Automatisées (Cron) et Télémétrie
Description : 
    Ce fichier héberge le moteur de tâches en arrière-plan (APScheduler) qui 
    garantit la surveillance continue de la flotte sans intervention humaine.
    Il orchestre deux cycles distincts :
    1. Un "Ping" léger (toutes les 2 heures) pour le suivi de connectivité (Live Status).
    2. Le déclenchement des scans lourds (Anti-Malware & Infrastructure) selon 
       la politique de sécurité définie pour chaque actif (Auto-Scan).
===============================================================================
"""

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
from app.routers.sites import scan_site, run_malware_scan, ping_site_agent

router = APIRouter(
    prefix="/api/agent",
    tags=["Agent Distant & Tâches Automatiques"]
)


# --- TÂCHE 1 : LE PING LÉGER VERS L'AGENT POUR VERFIER SON STATUT (Toutes les 2 heures) ---
def run_hourly_pings():
    print("🤖 [Scheduler] Lancement du ping léger de tous les sites...")
    db = SessionLocal()
    try:
        tous_les_sites = db.query(models.ClientSite).all()
        for site in tous_les_sites:
            try:
                # On appelle le ping en mode synchrone/asynchrone
                asyncio.run(ping_site_agent(site_id=site.id, db=db, admin=None))
            except Exception:
                pass # Si le site est éteint, on ignore pour passer au suivant
            
            time.sleep(1) # Petite pause réseau
    except Exception as e:
        print(f"🚨 [Scheduler] Erreur lors des pings : {str(e)}")
    finally:
        db.close()



# --- TÂCHE 2 : LES SCANS LOURDS () (Toutes les 24h ) ---
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
                asyncio.run(scan_site(
                    site_id=site.id, 
                    admin=None, 
                    db=db
                ))
                
                asyncio.run(run_malware_scan(
                    site_id=site.id, 
                    background_tasks=None, 
                    admin=None, 
                    db=db
                ))
                
                print(f"✅ [Scheduler] Scan terminé pour le site #{site.id}.")

                # On force le backend à souffler pendant 5 secondes avant d'attaquer le site suivant
                time.sleep(5)
                
    except Exception as e:
        print(f"🚨 [Scheduler] Erreur critique : {str(e)}")
    finally:
        db.close()

# On attache le planificateur au cycle de vie du Routeur
@router.on_event("startup")
# On attache le planificateur au cycle de vie du Routeur
@router.on_event("startup")
def start_scheduler():
    # On vérifie si le planificateur ne tourne pas déjà pour éviter le crash avec l'auto-reload d'Uvicorn
    if not scheduler.running:
        # 1. Le Ping léger exécuté toutes les 2 heures
        scheduler.add_job(run_hourly_pings, IntervalTrigger(hours=2))
        
        # 2. Les scans lourds vérifiés toutes les heures (qui se déclencheront selon leur propre fréquence de 12h/24h)
        scheduler.add_job(run_automated_scans, IntervalTrigger(hours=1))
        scheduler.start()
        print("⏱️ Planificateur de tâches (APScheduler) démarré.")

@router.on_event("shutdown")
def stop_scheduler():
    scheduler.shutdown()
