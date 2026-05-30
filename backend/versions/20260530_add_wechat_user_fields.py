"""add phone and openid to users

Revision ID: 20260530_add_wechat_user_fields
Revises: febae0a64eed
Create Date: 2026-05-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260530_add_wechat_user_fields"
down_revision: Union[str, Sequence[str], None] = "febae0a64eed"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("phone", sa.String(length=20), nullable=True))
    op.add_column("users", sa.Column("openid", sa.String(length=100), nullable=True))
    op.create_unique_constraint("uq_users_phone", "users", ["phone"])
    op.create_unique_constraint("uq_users_openid", "users", ["openid"])


def downgrade() -> None:
    op.drop_constraint("uq_users_openid", "users", type_="unique")
    op.drop_constraint("uq_users_phone", "users", type_="unique")
    op.drop_column("users", "openid")
    op.drop_column("users", "phone")
