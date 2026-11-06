"""add public site identifiers

Revision ID: 20261106_public_id
Revises: 439ba31257cc
"""

from alembic import op
import sqlalchemy as sa


revision = "20261106_public_id"
down_revision = "439ba31257cc"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.add_column(
        "client_sites",
        sa.Column("public_id", sa.String(length=36), nullable=True),
    )
    op.execute(
        "UPDATE client_sites SET public_id = gen_random_uuid()::text "
        "WHERE public_id IS NULL"
    )
    op.alter_column("client_sites", "public_id", nullable=False)
    op.create_index(
        "ix_client_sites_public_id",
        "client_sites",
        ["public_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_client_sites_public_id", table_name="client_sites")
    op.drop_column("client_sites", "public_id")
