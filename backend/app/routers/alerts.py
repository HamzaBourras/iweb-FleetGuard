"""
===============================================================================
Module      : alerts.py (Routeur FastAPI)
Rôle        : Centre de réception des incidents (SOC) et Notifications
Description : 
    Ce routeur agit comme le point d'entrée pour les requêtes "Push" envoyées 
    par les sondes PHP lorsqu'une attaque est interceptée (Pare-feu applicatif).
    Il est responsable de l'enregistrement des alertes de sécurité, du calcul 
    dynamique des malus sur le score de santé, et du déclenchement asynchrone 
    des notifications par e-mail aux administrateurs du SOC.
===============================================================================
"""

from datetime import datetime, timedelta
import os
from fastapi import APIRouter, Depends, HTTPException, Header, BackgroundTasks, Request
from sqlalchemy.orm import Session

# Import des modèles, schémas et utilitaires de sécurité
import app.models.models as models
import app.schemas.schemas as schemas
# Import des dépendances communes et services
from app.dependencies import get_db, get_current_admin
from app.services.email_service import send_soc_email
from app.rate_limit import limiter
from app.security.signing import verify_signature
from app.services.health import recalculate_health_score

router = APIRouter(
    prefix="/api/alerts",
    tags=["Alertes de Sécurité"]
)

# --- ROUTE POUR RECEVOIR LES ALERTES DE L'AGENT PHP ---
@router.post("")
@limiter.limit("120/minute")
async def receive_agent_alerts(
    request: Request,
    payload: schemas.AgentPayload,
    background_tasks: BackgroundTasks,
    x_iweb_site: str = Header(None),
    x_iweb_timestamp: str = Header(None),
    x_iweb_signature: str = Header(None),
    db: Session = Depends(get_db),
):
    raw = await request.body()
    site_client = None
    if x_iweb_site and len(x_iweb_site) <= 36:
        site_client = db.query(models.ClientSite).filter(
            models.ClientSite.public_id == x_iweb_site,
            models.ClientSite.deleted_at.is_(None),
        ).first()

    if not site_client or not verify_signature(
        site_client.secret_token,
        "POST",
        "/api/alerts",
        x_iweb_timestamp,
        x_iweb_signature,
        raw,
    ):
        raise HTTPException(
            status_code=403,
            detail="Signature refusée : site inconnu, jeton invalide ou requête expirée.",
        )

    since = datetime.utcnow() - timedelta(seconds=60)
    email_destinataire = os.getenv("SOC_ALERT_EMAIL", "")
    serious_alert_exists = db.query(models.SecurityAlert.id).filter(
        models.SecurityAlert.site_id == site_client.id,
        models.SecurityAlert.severity.in_(["critical", "high"]),
        models.SecurityAlert.timestamp >= since,
    ).first() is not None
    seen = set()
    email_sent = False
    stored = 0

    for event in payload.security_events:
        dedup_key = (event.event_type, event.ip_address)
        duplicate = dedup_key in seen or db.query(models.SecurityAlert.id).filter(
            models.SecurityAlert.site_id == site_client.id,
            models.SecurityAlert.event_type == event.event_type,
            models.SecurityAlert.ip_address == event.ip_address,
            models.SecurityAlert.timestamp >= since,
        ).first()
        if duplicate:
            continue
        seen.add(dedup_key)
        stored += 1

        db.add(models.SecurityAlert(
            site_id=site_client.id,
            event_type=event.event_type,
            severity=event.severity,
            message=event.message,
            ip_address=event.ip_address,
        ))
        db.add(models.Notification(
            type="alerte de sécurité",
            title=f"Menace {event.severity.upper()} sur {site_client.site_name}",
            message=f"[{event.event_type}] {event.message} (IP: {event.ip_address})",
            site_id=site_client.id,
        ))

        if event.severity in ("critical", "high") and not serious_alert_exists and not email_sent:
            email_sent = True
            background_tasks.add_task(
                send_soc_email,
                destinataire=email_destinataire,
                sujet=f"Menace {event.severity.upper()} détectée sur {site_client.site_name}",
                type_alerte="Alerte de sécurité",
                message_alerte=f"L'agent de sécurité a intercepté une attaque de niveau {event.severity.upper()}.\n\nCible: {site_client.site_name} ({site_client.url})\nMenace: {event.event_type}\nSource: {event.ip_address}\nDétails: {event.message}"
            )

    db.commit()
    recalculate_health_score(site_client, db)

    return {
        "status": "success",
        "message": f"{stored} alerte(s) enregistrée(s).",
    }
# --- ROUTE DE RÉCUPÉRATION DES ALERTES POUR LE DASHBOARD ---
@router.get("")
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
    ).order_by(models.SecurityAlert.timestamp.desc()).all() 

    resultats = []
    for alerte, nom_du_site in alerts_query:
        resultats.append({
            "id": alerte.id,
            "site_name": nom_du_site,
            "event_type": alerte.event_type,
            "severity": alerte.severity,
            "message": alerte.message,
            "ip_address": alerte.ip_address,
            "timestamp": alerte.timestamp,
            "site_id": alerte.site_id,
            "status": alerte.status  
        })

    return resultats