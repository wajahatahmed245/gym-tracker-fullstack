"""trainer phone number and per-set workout logging

Revision ID: 4d92cf36a5f9
Revises: 30f961db5a60
Create Date: 2026-06-13 18:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4d92cf36a5f9'
down_revision: Union[str, None] = '30f961db5a60'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # ---- trainer phone number ----
    trainer_profile_columns = {c['name'] for c in inspector.get_columns('trainer_profiles')}
    if 'phone' not in trainer_profile_columns:
        with op.batch_alter_table('trainer_profiles', schema=None) as batch_op:
            batch_op.add_column(sa.Column('phone', sa.String(length=30), nullable=True))

    # ---- per-set workout logging ----
    if 'workout_sets' not in inspector.get_table_names():
        op.create_table(
            'workout_sets',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('workout_id', sa.Integer(), nullable=False),
            sa.Column('set_number', sa.Integer(), nullable=False),
            sa.Column('reps', sa.Integer(), nullable=False),
            sa.Column('weight', sa.Float(), nullable=False),
            sa.ForeignKeyConstraint(['workout_id'], ['workouts.id'], name='fk_workout_sets_workout_id'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(op.f('ix_workout_sets_workout_id'), 'workout_sets', ['workout_id'], unique=False)

    # Backfill: each existing workouts row (sets, reps, weight) becomes `sets`
    # rows of (set_number, reps, weight) in workout_sets, so logs recorded
    # before this migration are preserved before the columns are dropped.
    workout_columns = {c['name'] for c in inspector.get_columns('workouts')}
    if {'sets', 'reps', 'weight'}.issubset(workout_columns):
        workouts_table = sa.table(
            'workouts',
            sa.column('id', sa.Integer),
            sa.column('sets', sa.Integer),
            sa.column('reps', sa.Integer),
            sa.column('weight', sa.Float),
        )
        workout_sets_table = sa.table(
            'workout_sets',
            sa.column('workout_id', sa.Integer),
            sa.column('set_number', sa.Integer),
            sa.column('reps', sa.Integer),
            sa.column('weight', sa.Float),
        )

        rows = bind.execute(
            sa.select(
                workouts_table.c.id,
                workouts_table.c.sets,
                workouts_table.c.reps,
                workouts_table.c.weight,
            )
        ).fetchall()

        for row in rows:
            for set_number in range(1, (row.sets or 0) + 1):
                bind.execute(
                    workout_sets_table.insert().values(
                        workout_id=row.id,
                        set_number=set_number,
                        reps=row.reps,
                        weight=row.weight,
                    )
                )

        with op.batch_alter_table('workouts', schema=None) as batch_op:
            batch_op.drop_column('sets')
            batch_op.drop_column('reps')
            batch_op.drop_column('weight')


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    workout_columns = {c['name'] for c in inspector.get_columns('workouts')}
    has_workout_sets = 'workout_sets' in inspector.get_table_names()

    if 'sets' not in workout_columns:
        with op.batch_alter_table('workouts', schema=None) as batch_op:
            batch_op.add_column(sa.Column('sets', sa.Integer(), nullable=False, server_default='1'))
            batch_op.add_column(sa.Column('reps', sa.Integer(), nullable=False, server_default='0'))
            batch_op.add_column(sa.Column('weight', sa.Float(), nullable=False, server_default='0'))

        if has_workout_sets:
            workouts_table = sa.table(
                'workouts',
                sa.column('id', sa.Integer),
                sa.column('sets', sa.Integer),
                sa.column('reps', sa.Integer),
                sa.column('weight', sa.Float),
            )
            workout_sets_table = sa.table(
                'workout_sets',
                sa.column('workout_id', sa.Integer),
                sa.column('set_number', sa.Integer),
                sa.column('reps', sa.Integer),
                sa.column('weight', sa.Float),
            )

            workout_ids = bind.execute(sa.select(workouts_table.c.id)).scalars().all()
            for workout_id in workout_ids:
                set_rows = bind.execute(
                    sa.select(workout_sets_table.c.reps, workout_sets_table.c.weight)
                    .where(workout_sets_table.c.workout_id == workout_id)
                    .order_by(workout_sets_table.c.set_number)
                ).fetchall()
                if not set_rows:
                    continue
                bind.execute(
                    workouts_table.update()
                    .where(workouts_table.c.id == workout_id)
                    .values(sets=len(set_rows), reps=set_rows[0].reps, weight=set_rows[0].weight)
                )

    if has_workout_sets:
        op.drop_index(op.f('ix_workout_sets_workout_id'), table_name='workout_sets')
        op.drop_table('workout_sets')

    trainer_profile_columns = {c['name'] for c in inspector.get_columns('trainer_profiles')}
    if 'phone' in trainer_profile_columns:
        with op.batch_alter_table('trainer_profiles', schema=None) as batch_op:
            batch_op.drop_column('phone')
