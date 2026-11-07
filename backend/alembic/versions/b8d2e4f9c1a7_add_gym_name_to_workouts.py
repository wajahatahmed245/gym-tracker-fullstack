"""Add gym_name to workouts

Revision ID: b8d2e4f9c1a7
Revises: a1b2c3d4e5f6
Create Date: 2026-11-07

"""
from alembic import op
import sqlalchemy as sa

revision = "b8d2e4f9c1a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "workouts",
        sa.Column("gym_name", sa.String(120), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("workouts", "gym_name")
