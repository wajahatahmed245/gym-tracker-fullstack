"""add health profile fields to exerciser profiles

Revision ID: d3a6f9c2b1e8
Revises: c2f4a8d1e6b7
Create Date: 2026-06-14 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd3a6f9c2b1e8'
down_revision: Union[str, None] = 'c2f4a8d1e6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    columns = {c['name'] for c in inspector.get_columns('exerciser_profiles')}

    with op.batch_alter_table('exerciser_profiles', schema=None) as batch_op:
        if 'height_cm' not in columns:
            batch_op.add_column(sa.Column('height_cm', sa.Float(), nullable=True))
        if 'weight_kg' not in columns:
            batch_op.add_column(sa.Column('weight_kg', sa.Float(), nullable=True))
        if 'age' not in columns:
            batch_op.add_column(sa.Column('age', sa.Integer(), nullable=True))
        if 'gender' not in columns:
            batch_op.add_column(
                sa.Column('gender', sa.Enum('male', 'female', 'other', name='gender'), nullable=True)
            )
        if 'activity_level' not in columns:
            batch_op.add_column(
                sa.Column(
                    'activity_level',
                    sa.Enum(
                        'sedentary',
                        'lightly_active',
                        'moderately_active',
                        'very_active',
                        'extra_active',
                        name='activitylevel',
                    ),
                    nullable=True,
                )
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    columns = {c['name'] for c in inspector.get_columns('exerciser_profiles')}

    with op.batch_alter_table('exerciser_profiles', schema=None) as batch_op:
        if 'activity_level' in columns:
            batch_op.drop_column('activity_level')
        if 'gender' in columns:
            batch_op.drop_column('gender')
        if 'age' in columns:
            batch_op.drop_column('age')
        if 'weight_kg' in columns:
            batch_op.drop_column('weight_kg')
        if 'height_cm' in columns:
            batch_op.drop_column('height_cm')
