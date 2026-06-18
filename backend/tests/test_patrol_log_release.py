"""POST /api/patrol-log/release 測試（記憶體資料庫，見 conftest.py）。

放生＝標記已處理但不收進圖鑑（unlocked_count 不變），且與 claim 互斥。
"""
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
    released: bool = False,
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
            released=released,
        )
        db.add(log)
        db.commit()
    finally:
        db.close()


def test_release_success_does_not_increment_collection(client: TestClient) -> None:
    """成功路徑：claimed=True、released=True，但 unlocked_count 不變。"""
    _add_today_log()

    db = SessionLocal()
    try:
        state = db.get(CollectionState, 1)
        initial = state.unlocked_count if state else 0
    finally:
        db.close()

    res = client.post("/api/patrol-log/release")
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["claimed"] is True
    assert data["released"] is True

    db = SessionLocal()
    try:
        state = db.get(CollectionState, 1)
        # 沒有 CollectionState（None）代表從未 +1；有的話數字必須與初始相同。
        assert (state.unlocked_count if state else 0) == initial
        log = db.execute(
            select(PatrolLog).where(PatrolLog.log_date == date_type.today())
        ).scalar_one()
        assert log.released is True
        assert log.claimed is True
    finally:
        db.close()


def test_release_404_no_log(client: TestClient) -> None:
    res = client.post("/api/patrol-log/release")
    assert res.status_code == 404


def test_release_422_tier_none(client: TestClient) -> None:
    _add_today_log(encounter_tier="none", pokemon_index=None)
    res = client.post("/api/patrol-log/release")
    assert res.status_code == 422


def test_release_409_already_claimed(client: TestClient) -> None:
    """已收服 → 不能再放生（409）。"""
    _add_today_log(claimed=True)
    res = client.post("/api/patrol-log/release")
    assert res.status_code == 409


def test_release_then_claim_blocked(client: TestClient) -> None:
    """放生後今日不可再 claim（互斥）。"""
    _add_today_log()
    assert client.post("/api/patrol-log/release").status_code == 200
    res = client.post("/api/patrol-log/claim")
    assert res.status_code == 409


def test_release_409_already_released(client: TestClient) -> None:
    """重複放生 → 409（防呆，claimed 也為 True 故先觸發已領取訊息亦可）。"""
    _add_today_log(claimed=True, released=True)
    res = client.post("/api/patrol-log/release")
    assert res.status_code == 409
