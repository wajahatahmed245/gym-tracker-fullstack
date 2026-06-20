"""Add exercise library for trainers

Revision ID: a3f7b2e1d9c5
Revises: e1b4c7d9a2f3
Create Date: 2026-06-20

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = "a3f7b2e1d9c5"
down_revision = "e1b4c7d9a2f3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Skip if table already exists (re-run safety)
    existing = conn.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name='exercises'")
    ).fetchone()
    if existing:
        return

    op.create_table(
        "exercises",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("trainer_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("body_part", sa.String(30), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("name_normalized", sa.String(120), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("trainer_id", "name_normalized", name="uq_exercise_trainer_name"),
    )

    # Backfill from existing assigned_workouts — one library entry per unique
    # (trainer_id, exercise name) combination, earliest assignment wins.
    conn.execute(text("""
        INSERT INTO exercises (trainer_id, body_part, name, name_normalized, created_at)
        SELECT
            trainer_id,
            body_part,
            exercise,
            LOWER(TRIM(exercise)),
            MIN(created_at)
        FROM assigned_workouts
        GROUP BY trainer_id, LOWER(TRIM(exercise))
    """))


def downgrade() -> None:
    op.drop_table("exercises")
