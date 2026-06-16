"""add unavailable_dates table and exerciser phone

Revision ID: e1b4c7d9a2f3
Revises: d3a6f9c2b1e8
Create Date: 2026-06-16 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1b4c7d9a2f3'
down_revision: Union[str, None] = 'd3a6f9c2b1e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    columns = {c['name'] for c in inspector.get_columns('exerciser_profiles')}
    if 'phone' not in columns:
        with op.batch_alter_table('exerciser_profiles', schema=None) as batch_op:
            batch_op.add_column(sa.Column('phone', sa.String(length=30), nullable=True))

    if 'unavailable_dates' not in inspector.get_table_names():
        op.create_table(
            'unavailable_dates',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('date', sa.Date(), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('user_id', 'date', name='uq_unavailable_dates_user_date'),
        )
        op.create_index(
            op.f('ix_unavailable_dates_user_id'), 'unavailable_dates', ['user_id'], unique=False
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'unavailable_dates' in inspector.get_table_names():
        op.drop_index(op.f('ix_unavailable_dates_user_id'), table_name='unavailable_dates')
        op.drop_table('unavailable_dates')

    columns = {c['name'] for c in inspector.get_columns('exerciser_profiles')}
    if 'phone' in columns:
        with op.batch_alter_table('exerciser_profiles', schema=None) as batch_op:
            batch_op.drop_column('phone')
