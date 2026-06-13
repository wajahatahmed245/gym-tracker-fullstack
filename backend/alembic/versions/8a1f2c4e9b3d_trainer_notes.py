"""trainer notes for client removal/leave reasons

Revision ID: 8a1f2c4e9b3d
Revises: 4d92cf36a5f9
Create Date: 2026-06-13 19:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8a1f2c4e9b3d'
down_revision: Union[str, None] = '4d92cf36a5f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'trainer_notes' not in inspector.get_table_names():
        op.create_table(
            'trainer_notes',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('trainer_id', sa.Integer(), nullable=False),
            sa.Column('exerciser_id', sa.Integer(), nullable=False),
            sa.Column('exerciser_name', sa.String(length=120), nullable=False),
            sa.Column('author', sa.Enum('trainer', 'exerciser', name='noteauthor'), nullable=False),
            sa.Column('note', sa.String(length=1000), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
            sa.ForeignKeyConstraint(['trainer_id'], ['users.id'], name='fk_trainer_notes_trainer_id'),
            sa.ForeignKeyConstraint(['exerciser_id'], ['users.id'], name='fk_trainer_notes_exerciser_id'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(op.f('ix_trainer_notes_trainer_id'), 'trainer_notes', ['trainer_id'], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'trainer_notes' in inspector.get_table_names():
        op.drop_index(op.f('ix_trainer_notes_trainer_id'), table_name='trainer_notes')
        op.drop_table('trainer_notes')
