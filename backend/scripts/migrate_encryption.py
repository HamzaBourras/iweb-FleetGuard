"""Migrate legacy site tokens and MFA secrets to the current encryption format."""

from cryptography.fernet import InvalidToken
from sqlalchemy import text

from app.database import SessionLocal
from app.security.security import cipher_suite


def _decrypt_once(value: str) -> str:
    return cipher_suite.decrypt(value.encode("utf-8")).decode("utf-8")


def migrate() -> None:
    db = SessionLocal()
    try:
        for site_id, raw in db.execute(
            text("SELECT id, secret_token FROM client_sites")
        ).all():
            if not raw:
                continue
            try:
                once = _decrypt_once(raw)
            except (InvalidToken, ValueError, TypeError):
                print(f"site {site_id} : illisible, ignoré")
                continue
            try:
                _decrypt_once(once)
            except (InvalidToken, ValueError, TypeError):
                continue
            db.execute(
                text(
                    "UPDATE client_sites "
                    "SET secret_token = :value WHERE id = :site_id"
                ),
                {"value": once, "site_id": site_id},
            )
            print(f"site {site_id} : double chiffrement corrigé")

        for admin_id, value in db.execute(
            text(
                "SELECT id, mfa_secret FROM dashboard_admins "
                "WHERE mfa_secret IS NOT NULL"
            )
        ).all():
            if not value:
                continue
            try:
                _decrypt_once(value)
                continue
            except (InvalidToken, ValueError, TypeError):
                pass
            db.execute(
                text(
                    "UPDATE dashboard_admins SET mfa_secret = :value "
                    "WHERE id = :admin_id"
                ),
                {
                    "value": cipher_suite.encrypt(value.encode("utf-8")).decode(
                        "utf-8"
                    ),
                    "admin_id": admin_id,
                },
            )
            print(f"admin {admin_id} : mfa_secret chiffré")

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
