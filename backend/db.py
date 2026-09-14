"""Database layer. SQLite by default (fine for beta scale); set DATABASE_URL
to a Postgres URL on Railway and nothing else changes."""

import os
from pathlib import Path

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    Integer,
    MetaData,
    String,
    Table,
    UniqueConstraint,
    create_engine,
    func,
)

_default_sqlite = f"sqlite:///{Path(__file__).parent / 'canvas_digest.db'}"
_url = os.environ.get("DATABASE_URL", _default_sqlite)
# Railway hands out postgres://, SQLAlchemy 2.x wants postgresql://
if _url.startswith("postgres://"):
    _url = _url.replace("postgres://", "postgresql://", 1)

engine = create_engine(_url, pool_pre_ping=True)
metadata = MetaData()

feedback = Table(
    "feedback",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("device_id", String(64), nullable=False),
    Column("message", String(2000), nullable=False),
    Column("version", String(20), nullable=False, default=""),
    Column("host", String(120), nullable=False, default=""),
    Column("created_at", DateTime(timezone=True), server_default=func.now()),
)


def init_db() -> None:
    metadata.create_all(engine)
    _migrate()


def _migrate() -> None:
    """Idempotent forward migrations for tables create_all already made."""
    from sqlalchemy import inspect, text

    # the time-report program was removed from the product; its tables go with it
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS reports"))
        conn.execute(text("DROP TABLE IF EXISTS devices"))
    # ledgers.created_at: milestone reachability is judged against device age
    if "ledgers" in inspect(engine).get_table_names():
        lcols = {c["name"] for c in inspect(engine).get_columns("ledgers")}
        if "created_at" not in lcols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE ledgers ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP"))
