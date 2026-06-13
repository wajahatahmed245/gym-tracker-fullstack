"""add active flag to assigned workouts

Revision ID: b7e3a1c9f2d4
Revises: 8a1f2c4e9b3d
Create Date: 2026-06-14 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7e3a1c9f2d4'
down_revision: Union[str, None] = '8a1f2c4e9b3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    columns = [c['name'] for c in inspector.get_columns('assigned_workouts')]
    if 'active' not in columns:
        with op.batch_alter_table('assigned_workouts', schema=None) as batch_op:
            batch_op.add_column(
                sa.Column('active', sa.Boolean(), server_default=sa.text('1'), nullable=False)
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    columns = [c['name'] for c in inspector.get_columns('assigned_workouts')]
    if 'active' in columns:
        with op.batch_alter_table('assigned_workouts', schema=None) as batch_op:
            batch_op.drop_column('active')
