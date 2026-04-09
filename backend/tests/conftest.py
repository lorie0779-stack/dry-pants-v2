"""Pytest 設定：在匯入應用程式前強制使用獨立記憶體 SQLite，避免觸碰 dry_pants.db。"""

from __future__ import annotations

import os

os.environ["SQLALCHEMY_DATABASE_URL"] = "sqlite:///:memory:"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from database import Base, SessionLocal, engine
from main import DEFAULT_REASON_SEEDS, app
from models import ErrorReason


@pytest.fixture(autouse=True)
def _reset_database() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        for text in DEFAULT_REASON_SEEDS:
            db.add(ErrorReason(reason_text=text))
        db.commit()
    finally:
        db.close()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client() -> TestClient:
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def first_reason_id() -> int:
    db = SessionLocal()
    try:
        row = db.execute(select(ErrorReason).order_by(ErrorReason.id)).scalars().first()
        assert row is not None
        return row.id
    finally:
        db.close()
