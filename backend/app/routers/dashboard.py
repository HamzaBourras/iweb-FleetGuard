from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

# Import des modèles
import app.models.models as models

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
    chart_data = []
    
    for i in range(6, -1, -1):
        target_date = today - timedelta(days=i)
        
        start_of_day = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = target_date.replace(hour=23, minute=59, second=59, microsecond=999999)
        
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



# ===== === ROUTES POUR LES NOTIFICATIONS DE L'ADMIN (PROTÉGÉES) ===
# --- ROUTE : Récupérer toutes les notifications de l'admin ---
@router.get("/notifications")
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
@router.patch("/notifications/{notification_id}/read")
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
