"""add user_gyms table for persistent gym name suggestions

Revision ID: c3e5f7a9b2d1
Revises: b8d2e4f9c1a7
Create Date: 2026-11-07
"""
from alembic import op
import sqlalchemy as sa

revision = "c3e5f7a9b2d1"
down_revision = "b8d2e4f9c1a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_gyms",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("exerciser_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.ForeignKeyConstraint(["exerciser_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("exerciser_id", "name", name="uq_user_gym_exerciser_name"),
    )
    op.create_index("ix_user_gyms_exerciser_id", "user_gyms", ["exerciser_id"])
    # Seed from existing workout gym_name values so nothing is lost
    op.execute(
        "INSERT OR IGNORE INTO user_gyms (exerciser_id, name) "
        "SELECT DISTINCT exerciser_id, gym_name FROM workouts WHERE gym_name IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_index("ix_user_gyms_exerciser_id", table_name="user_gyms")
    op.drop_table("user_gyms")
