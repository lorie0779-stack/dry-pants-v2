"""POST /api/collection-state/reset 測試（main.py:478-494，記憶體資料庫，見 conftest.py）。

驗證：honor_entries、patrol_logs 全清空，CollectionState 各欄歸零，
且 error_records（失誤紀錄）完全不受影響——reset 是遊戲進度重置，不是資料清除。
"""
from __future__ import annotations

from datetime import date as date_type

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from database import SessionLocal
from models import CollectionState, ErrorRecord, HonorEntry, PatrolLog


def test_reset_clears_honor_and_patrol_and_state_but_not_errors(client: TestClient) -> None:
    db = SessionLocal()
    try:
        db.add(HonorEntry(entry_time="2026/01/01 08:00", entry_text="測試榮譽"))
        db.add(
            PatrolLog(
                log_date=date_type.today(),
                block_1="clean",
                block_2="clean",
                block_3="clean",
                regular_stamps=3,
                courage_stamps=0,
                encounter_tier="legendary",
                pokemon_index=5,
                claimed=True,
            )
        )
        db.commit()
    finally:
        db.close()

    # 建立一筆失誤紀錄（走真實 API，確保 reason 存在）
    res = client.post(
        "/api/errors",
        json={
            "type": "💩",
            "location": "客廳",
            "time_of_day": "早上",
            "reason": "測試原因-reset不應清除",
        },
    )
    assert res.status_code == 200, res.text
    error_record_id = res.json()["id"]

    # 把 CollectionState 設成非零值
    db = SessionLocal()
    try:
        row = db.get(CollectionState, 1)
        if row is None:
            row = CollectionState(id=1)
            db.add(row)
        row.energy = 3
        row.unlocked_count = 12
        row.coins = 4
        row.courage_bands = 2
        row.wild_collection = '[{"species_id": 3, "mega": false}]'
        row.slot_order = "[1,2,3]"
        db.commit()
    finally:
        db.close()

    res = client.post("/api/collection-state/reset")
    assert res.status_code == 204, res.text

    db = SessionLocal()
    try:
        honor_count = db.execute(select(func.count()).select_from(HonorEntry)).scalar_one()
        patrol_count = db.execute(select(func.count()).select_from(PatrolLog)).scalar_one()
        assert honor_count == 0
        assert patrol_count == 0

        state = db.get(CollectionState, 1)
        assert state is not None
        assert state.energy == 0
        assert state.unlocked_count == 0
        assert state.coins == 0
        assert state.courage_bands == 0
        assert state.wild_collection == "[]"
        # slot_order 應重新產生（非 None、且為 30 個索引的 JSON）
        assert state.slot_order is not None

        # error_records 完全不受影響：筆數與內容不變
        error_count = db.execute(select(func.count()).select_from(ErrorRecord)).scalar_one()
        assert error_count == 1
        error_row = db.get(ErrorRecord, error_record_id)
        assert error_row is not None
        assert error_row.location == "客廳"
        assert error_row.time_of_day == "早上"
    finally:
        db.close()


def test_reset_when_no_prior_state_row(client: TestClient) -> None:
    """CollectionState 尚不存在時 reset 也不應炸掉（走 row is None 分支）。"""
    db = SessionLocal()
    try:
        row = db.get(CollectionState, 1)
        if row is not None:
            db.delete(row)
            db.commit()
    finally:
        db.close()

    res = client.post("/api/collection-state/reset")
    assert res.status_code == 204, res.text

    db = SessionLocal()
    try:
        state = db.get(CollectionState, 1)
        assert state is not None
        assert state.energy == 0
        assert state.coins == 0
    finally:
        db.close()
