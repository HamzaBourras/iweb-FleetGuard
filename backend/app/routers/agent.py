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

import asyncio
from datetime import datetime
from fastapi import APIRouter
from sqlalchemy.orm import Session
# ✨ CORRECTION : Utilisation du planificateur asynchrone natif
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

# Imports internes
import app.models.models as models
from app.database import SessionLocal
from app.routers.sites import scan_site, run_malware_scan, ping_site_agent

router = APIRouter(
    prefix="/api/agent",
    tags=["Agent Distant & Tâches Automatiques"]
)

# --- TÂCHE 1 : LE PING LÉGER VERS L'AGENT ---
async def run_hourly_pings():
    print("🤖 [Scheduler] Lancement du ping léger de tous les sites...")
    db = SessionLocal()
    try:
        tous_les_sites = db.query(models.ClientSite).all()
        for site in tous_les_sites:
            try:
                # On await directement la fonction au lieu de asyncio.run()
                await ping_site_agent(site_id=site.id, db=db, admin=None)
            except Exception:
                pass 
            
            # Pause non bloquante pour laisser respirer l'Event Loop
            await asyncio.sleep(1) 
    except Exception as e:
        print(f"🚨 [Scheduler] Erreur lors des pings : {str(e)}")
    finally:
        db.close()


# --- TÂCHE 2 : LES SCANS LOURDS AUTOMATIQUES ---
scheduler = AsyncIOScheduler()

async def run_automated_scans():
    print("🤖 [Scheduler] Vérification des scans automatiques en attente...")
    db = SessionLocal()
    try:
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
                
                # Exécution asynchrone native
                await scan_site(site_id=site.id, admin=None, db=db)
                
                await run_malware_scan(
                    site_id=site.id, 
                    background_tasks=None, 
                    admin=None, 
                    db=db
                )
                
                print(f"✅ [Scheduler] Scan terminé pour le site #{site.id}.")
                await asyncio.sleep(5)
                
    except Exception as e:
        print(f"🚨 [Scheduler] Erreur critique : {str(e)}")
    finally:
        db.close()


@router.on_event("startup")
def start_scheduler():
    if not scheduler.running:
        # misfire_grace_time augmenté pour éviter l'annulation si le serveur est en charge
        # max_instances=1 empêche le chevauchement si un scan est plus long que l'intervalle
        
        # Exemple de test à 10 secondes (à remettre à 2h en production via hours=2)
        scheduler.add_job(
            run_hourly_pings, 
            IntervalTrigger(hours=2), 
            misfire_grace_time=60, 
            max_instances=1
        )
        
        # Scans lourds vérifiés toutes les heures
        scheduler.add_job(
            run_automated_scans, 
            IntervalTrigger(hours=1), 
            misfire_grace_time=300, 
            max_instances=1
        )
        
        scheduler.start()
        print("⏱️ Planificateur de tâches (AsyncIOScheduler) démarré.")

@router.on_event("shutdown")
def stop_scheduler():
    scheduler.shutdown()