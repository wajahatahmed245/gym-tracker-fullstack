"""Add weight_unit to workout_sets

Revision ID: a1b2c3d4e5f6
Revises: c9d4e2f1a0b8
Create Date: 2026-11-07

"""
from alembic import op
import sqlalchemy as sa

revision = "a1b2c3d4e5f6"
down_revision = "c9d4e2f1a0b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "workout_sets",
        sa.Column("weight_unit", sa.String(10), nullable=False, server_default="kg"),
    )


def downgrade() -> None:
    op.drop_column("workout_sets", "weight_unit")
