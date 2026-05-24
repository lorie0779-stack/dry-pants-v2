"""POST /api/patrol-log/claim 測試（記憶體資料庫，見 conftest.py）。"""
from __future__ import annotations

from datetime import date as date_type

from fastapi.testclient import TestClient
from sqlalchemy import select

from database import SessionLocal
from models import CollectionState, PatrolLog


def _add_today_log(
    encounter_tier: str = "legendary",
    pokemon_index: int | None = 5,
    claimed: bool = False,
) -> None:
    db = SessionLocal()
    try:
        log = PatrolLog(
            log_date=date_type.today(),
            block_1="clean",
            block_2="clean",
            block_3="clean",
            regular_stamps=3,
            courage_stamps=0,
            encounter_tier=encounter_tier,
            pokemon_index=pokemon_index,
            claimed=claimed,
        )
        db.add(log)
        db.commit()
    finally:
        db.close()


def test_claim_success(client: TestClient) -> None:
    """成功路徑：claimed=True, unlocked_count+1。"""
    _add_today_log()

    db = SessionLocal()
    try:
        state = db.get(CollectionState, 1)
        initial = state.unlocked_count if state else 0
    finally:
        db.close()

    res = client.post("/api/patrol-log/claim")
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["unlocked_count"] == initial + 1

    db = SessionLocal()
    try:
        log = db.execute(
            select(PatrolLog).where(PatrolLog.log_date == date_type.today())
        ).scalar_one()
        assert log.claimed is True
    finally:
        db.close()


def test_claim_404_no_log(client: TestClient) -> None:
    """今日無記錄 → 404。"""
    res = client.post("/api/patrol-log/claim")
    assert res.status_code == 404


def test_claim_422_tier_none(client: TestClient) -> None:
    """tier=none → 422。"""
    _add_today_log(encounter_tier="none", pokemon_index=None)
    res = client.post("/api/patrol-log/claim")
    assert res.status_code == 422


def test_claim_409_already_claimed(client: TestClient) -> None:
    """已 claimed → 409（幂等）。"""
    _add_today_log(claimed=True)
    res = client.post("/api/patrol-log/claim")
    assert res.status_code == 409
