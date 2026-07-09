"""Title-case all exercise names across exercises, assigned_workouts, and cardio_exercises

Revision ID: c9d4e2f1a0b8
Revises: b5c8d1e3f7a2
Create Date: 2026-06-20

"""
from alembic import op
from sqlalchemy import text

revision = "c9d4e2f1a0b8"
down_revision = "b5c8d1e3f7a2"
branch_labels = None
depends_on = None


def _title(s: str) -> str:
    """Strip whitespace then title-case each word."""
    return s.strip().title()


def upgrade() -> None:
    conn = op.get_bind()

    # ── exercises (strength library) ─────────────────────────────────────────
    rows = conn.execute(text("SELECT id, name FROM exercises")).fetchall()
    for row_id, name in rows:
        new_name = _title(name)
        new_norm = new_name.lower()
        conn.execute(
            text("UPDATE exercises SET name = :n, name_normalized = :nn WHERE id = :id"),
            {"n": new_name, "nn": new_norm, "id": row_id},
        )

    # ── assigned_workouts (per-client exercise field) ────────────────────────
    rows = conn.execute(text("SELECT id, exercise FROM assigned_workouts")).fetchall()
    for row_id, exercise in rows:
        conn.execute(
            text("UPDATE assigned_workouts SET exercise = :e WHERE id = :id"),
            {"e": _title(exercise), "id": row_id},
        )

    # ── cardio_exercises ─────────────────────────────────────────────────────
    rows = conn.execute(text("SELECT id, name FROM cardio_exercises")).fetchall()
    for row_id, name in rows:
        conn.execute(
            text("UPDATE cardio_exercises SET name = :n WHERE id = :id"),
            {"n": _title(name), "id": row_id},
        )


def downgrade() -> None:
    # Names before this migration are unknown — downgrade is a no-op.
    pass
