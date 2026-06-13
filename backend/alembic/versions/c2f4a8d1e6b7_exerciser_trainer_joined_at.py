"""add trainer_joined_at to exerciser profiles

Revision ID: c2f4a8d1e6b7
Revises: b7e3a1c9f2d4
Create Date: 2026-06-14 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c2f4a8d1e6b7'
down_revision: Union[str, None] = 'b7e3a1c9f2d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    columns = [c['name'] for c in inspector.get_columns('exerciser_profiles')]
    if 'trainer_joined_at' not in columns:
        with op.batch_alter_table('exerciser_profiles', schema=None) as batch_op:
            batch_op.add_column(sa.Column('trainer_joined_at', sa.DateTime(), nullable=True))

        # Backfill existing relationships with the exerciser's account
        # creation date as a reasonable approximation of "joined on".
        op.execute(
            """
            UPDATE exerciser_profiles
            SET trainer_joined_at = (
                SELECT users.created_at FROM users WHERE users.id = exerciser_profiles.user_id
            )
            WHERE trainer_id IS NOT NULL AND trainer_joined_at IS NULL
            """
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    columns = [c['name'] for c in inspector.get_columns('exerciser_profiles')]
    if 'trainer_joined_at' in columns:
        with op.batch_alter_table('exerciser_profiles', schema=None) as batch_op:
            batch_op.drop_column('trainer_joined_at')
