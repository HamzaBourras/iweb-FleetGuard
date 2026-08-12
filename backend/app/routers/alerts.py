import os
from fastapi import APIRouter, Depends, HTTPException, Header, BackgroundTasks
from sqlalchemy.orm import Session

# Import des modèles, schémas et utilitaires de sécurité
import app.models.models as models
import app.schemas.schemas as schemas
import app.security.security as security

# Import des dépendances communes et services
from app.dependencies import get_db, get_current_admin
from app.services.email_service import send_soc_email

router = APIRouter(
    prefix="/api/alerts",
    tags=["Alertes de Sécurité"]
)

# --- ROUTE POUR RECEVOIR LES ALERTES DE L'AGENT PHP ---
@router.post("")
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
    score_actuel = getattr(site_client, 'health_score', 100)
    if score_actuel is None:
        score_actuel = 100
        
    nouveau_score = max(0, score_actuel - penalite_score)
    site_client.health_score = nouveau_score

    db.commit()

    return {
        "status": "success",
        "message": f"{len(payload.security_events)} alerte(s) enregistrée(s). Score de santé mis à jour à {nouveau_score}/100."
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
            "site_id": alerte.site_id
        })

    return resultats