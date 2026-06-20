"""Add cardio_exercises and cardio_sessions tables

Revision ID: b5c8d1e3f7a2
Revises: a3f7b2e1d9c5
Create Date: 2026-06-20

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = "b5c8d1e3f7a2"
down_revision = "a3f7b2e1d9c5"
branch_labels = None
depends_on = None

# Seeded exercises available to every trainer
SEED_EXERCISES = [
    ("🏃", "Running",          True),
    ("🚴", "Cycling",          True),
    ("🏊", "Swimming",         True),
    ("🚶", "Walking",          True),
    ("🎽", "Jump Rope",        True),
    ("🥊", "Boxing",           True),
    ("🧘", "Yoga",             False),
    ("🚣", "Rowing",           True),
    ("🤸", "HIIT",             True),
    ("🏔️", "Stair Climbing",   True),
    ("⛹️", "Basketball",       True),
    ("⚽", "Football",         True),
    ("🎾", "Tennis",           True),
    ("🏸", "Badminton",        True),
    ("🏃", "Treadmill",        True),
    ("🧗", "Rock Climbing",    True),
    ("💨", "Sprint Training",  True),
    ("🤾", "Circuit Training", True),
    ("🏋️", "Elliptical",       True),
    ("🤼", "Wrestling / MMA",  True),
    ("🧠", "Pilates",          False),
    ("🎾", "Padel",            True),
    ("🏄", "Water Aerobics",   True),
]


def upgrade() -> None:
    conn = op.get_bind()

    # ── cardio_exercises ──────────────────────────────────────────────────────
    exists = conn.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name='cardio_exercises'")
    ).fetchone()
    if not exists:
        op.create_table(
            "cardio_exercises",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("trainer_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False, index=True),
            sa.Column("name", sa.String(120), nullable=False),
            sa.Column("icon", sa.String(10), nullable=False, server_default="🏃"),
            sa.Column("tracks_calories", sa.Boolean, nullable=False, server_default="1"),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
            sa.UniqueConstraint("trainer_id", "name", name="uq_cardio_exercise_trainer_name"),
        )

        # Seed all trainers
        trainer_ids = [
            row[0] for row in conn.execute(
                text("SELECT id FROM users WHERE role='trainer'")
            ).fetchall()
        ]
        for tid in trainer_ids:
            for icon, name, tracks_cal in SEED_EXERCISES:
                conn.execute(text(
                    "INSERT OR IGNORE INTO cardio_exercises (trainer_id, name, icon, tracks_calories) "
                    "VALUES (:tid, :name, :icon, :tc)"
                ), {"tid": tid, "name": name, "icon": icon, "tc": 1 if tracks_cal else 0})

    # ── cardio_sessions ───────────────────────────────────────────────────────
    exists2 = conn.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name='cardio_sessions'")
    ).fetchone()
    if not exists2:
        op.create_table(
            "cardio_sessions",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("exerciser_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False, index=True),
            sa.Column("cardio_exercise_id", sa.Integer, sa.ForeignKey("cardio_exercises.id"), nullable=True, index=True),
            sa.Column("duration_minutes", sa.Integer, nullable=False),
            sa.Column("calories_burned", sa.Integer, nullable=True),
            sa.Column("date", sa.Date, nullable=False),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        )


def downgrade() -> None:
    op.drop_table("cardio_sessions")
    op.drop_table("cardio_exercises")
