"""Initial migration with foreign keys

Revision ID: 759dd1da1e5d
Revises: e078f84da8f3
Create Date: 2026-03-29 22:01:33.667539

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '759dd1da1e5d'
down_revision: Union[str, Sequence[str], None] = 'e078f84da8f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_foreign_key(
        "fk_analysis_tasks_user_id_users",
        "analysis_tasks",
        "users",
        ["user_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_groups_user_id_users",
        "groups",
        "users",
        ["user_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_sessions_user_id_users",
        "sessions",
        "users",
        ["user_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_user_cookies_user_id_users",
        "user_cookies",
        "users",
        ["user_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_user_cookies_user_id_users", "user_cookies", type_="foreignkey")
    op.drop_constraint("fk_sessions_user_id_users", "sessions", type_="foreignkey")
    op.drop_constraint("fk_groups_user_id_users", "groups", type_="foreignkey")
    op.drop_constraint("fk_analysis_tasks_user_id_users", "analysis_tasks", type_="foreignkey")
