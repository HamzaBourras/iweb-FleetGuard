import app.models.models as models


def recalculate_health_score(site, db):
    has_malware = bool(site.malware_report)

    if has_malware:
        site.health_score = 0
    else:
        active_alerts = db.query(models.SecurityAlert).filter(
            models.SecurityAlert.site_id == site.id,
            models.SecurityAlert.status != "resolved",
        ).all()
        if not active_alerts:
            site.health_score = 100
        else:
            penalties = sum(
                {"critical": 15, "high": 10, "medium": 5}.get(alert.severity, 2)
                for alert in active_alerts
            )
            site.health_score = max(20, 100 - penalties)

    db.commit()
    db.refresh(site)
