"""assigned workout drives workout logging

Revision ID: 30f961db5a60
Revises: f49cb6d52010
Create Date: 2026-06-13 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '30f961db5a60'
down_revision: Union[str, None] = 'f49cb6d52010'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('assigned_workouts', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False)
        )

    with op.batch_alter_table('workouts', schema=None) as batch_op:
        batch_op.add_column(sa.Column('assigned_workout_id', sa.Integer(), nullable=True))
        batch_op.create_index(
            op.f('ix_workouts_assigned_workout_id'), ['assigned_workout_id'], unique=False
        )
        batch_op.create_foreign_key(
            'fk_workouts_assigned_workout_id', 'assigned_workouts', ['assigned_workout_id'], ['id']
        )
        batch_op.drop_column('body_part')
        batch_op.drop_column('exercise')

    # No existing workout rows reference an assigned exercise (pre-feature test data
    # only), so remove them rather than leave assigned_workout_id null.
    op.execute('DELETE FROM workouts')

    with op.batch_alter_table('workouts', schema=None) as batch_op:
        batch_op.alter_column('assigned_workout_id', existing_type=sa.Integer(), nullable=False)


def downgrade() -> None:
    with op.batch_alter_table('workouts', schema=None) as batch_op:
        batch_op.add_column(sa.Column('exercise', sa.String(length=120), nullable=False, server_default=''))
        batch_op.add_column(
            sa.Column(
                'body_part',
                sa.Enum('chest', 'back', 'legs', 'shoulders', 'arms', 'core', name='bodypart'),
                nullable=False,
                server_default='chest',
            )
        )
        batch_op.drop_constraint('fk_workouts_assigned_workout_id', type_='foreignkey')
        batch_op.drop_index(op.f('ix_workouts_assigned_workout_id'))
        batch_op.drop_column('assigned_workout_id')

    with op.batch_alter_table('assigned_workouts', schema=None) as batch_op:
        batch_op.drop_column('updated_at')
