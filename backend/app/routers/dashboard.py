"""
===============================================================================
Module      : dashboard.py (Routeur FastAPI)
Rôle        : Agrégation des statistiques et Centre de Notifications
Description :
    Ce routeur fournit les données globales nécessaires à l'affichage du
    tableau de bord principal. Il calcule en temps réel le score de santé global,
    le volume d'attaques sur 7 jours (KPI), et gère le flux des notifications 
    système destinées aux administrateurs (ex: alertes critiques, événements MFA).
===============================================================================
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional

# Import des modèles
import app.models.models as models
import app.schemas.schemas as schemas

# Import des dépendances communes
from app.dependencies import get_db, get_current_admin

# Création du routeur avec son préfixe et son tag pour la documentation (Swagger)
router = APIRouter(
    prefix="/api/dashboard",
    tags=["Dashboard & Statistiques"]
)

# --- ROUTES DU TABLEAU DE BORD (PROTÉGÉES) ---
@router.get("/stats")
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
    start = today.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=6)
    rows = db.query(
        func.date(models.SecurityAlert.timestamp),
        func.count(),
    ).filter(
        models.SecurityAlert.timestamp >= start
    ).group_by(func.date(models.SecurityAlert.timestamp)).all()
    counts = {day.isoformat(): count for day, count in rows}
    chart_data = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        chart_data.append({
            "name": jour_noms[day.weekday()],
            "alertes": counts.get(day.date().isoformat(), 0),
        })

    return {
        "active_sites": total_sites,
        "vulnerabilities": total_alerts,
        "health_score": health_score,
        "chart_data": chart_data
    }



# ===== === ROUTES POUR LES NOTIFICATIONS DE L'ADMIN (PROTÉGÉES) ===
# --- ROUTE : Récupérer toutes les notifications de l'admin ---
@router.get("/notifications", response_model=List[schemas.NotificationResponse])
def get_admin_notifications(
    admin: models.DashboardAdmin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    # On récupère les 30 dernières notifications, de la plus récente à la plus ancienne
    visible = or_(
        models.Notification.admin_id.is_(None),
        models.Notification.admin_id == admin.id,
    )
    notifications = db.query(models.Notification)\
        .filter(visible)\
        .order_by(models.Notification.created_at.desc())\
        .limit(30)\
        .all()
    return notifications

# --- ROUTE : Marquer une notification comme lue ---
@router.patch("/notifications/{notification_id}/read")
def mark_notification_as_read(
    notification_id: int,
    admin: models.DashboardAdmin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    visible = or_(
        models.Notification.admin_id.is_(None),
        models.Notification.admin_id == admin.id,
    )
    notif = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        visible,
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification introuvable.")
    
    notif.is_read = True
    db.commit()
    return {"status": "success", "message": "Notification marquée comme lue."}
