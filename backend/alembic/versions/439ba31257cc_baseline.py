"""baseline

Revision ID: 439ba31257cc
Revises: 
Create Date: 2026-11-03 18:54:34.543285
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa



revision: str = '439ba31257cc'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
