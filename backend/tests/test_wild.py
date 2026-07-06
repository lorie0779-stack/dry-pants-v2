"""野生圖鑑 + 極巨化測試（記憶體資料庫，見 conftest.py）。

- claim 在 normal tier 時收進 wild_collection（去重、不動 unlocked_count）
- POST /api/wild/megamax 消耗 1 條 courage_band、將該 species mega=True
"""
from __future__ import annotations

import json
from datetime import date as date_type

from fastapi.testclient import TestClient
from sqlalchemy import select

from database import SessionLocal
from main import WILD_POOL_IDS
from models import CollectionState, PatrolLog


def _add_today_log(tier: str = "normal", pokemon_index: int = 0) -> None:
    db = SessionLocal()
    try:
        db.add(
            PatrolLog(
                log_date=date_type.today(),
                block_1="clean",
                block_2="clean",
                block_3="clean",
                regular_stamps=3,
                courage_stamps=0,
                encounter_tier=tier,
                pokemon_index=pokemon_index,
            )
        )
        db.commit()
    finally:
        db.close()


def _set_state(courage_bands: int = 0, wild: list | None = None) -> None:
    db = SessionLocal()
    try:
        row = db.get(CollectionState, 1)
        if row is None:
            row = CollectionState(id=1, energy=0, unlocked_count=0, coins=0)
            db.add(row)
        row.courage_bands = courage_bands
        row.wild_collection = json.dumps(wild) if wild is not None else None
        db.commit()
    finally:
        db.close()


def test_claim_normal_adds_to_wild_not_unlocked(client: TestClient) -> None:
    """normal tier claim → wild_collection +1、unlocked_count 不變。"""
    _add_today_log(tier="normal", pokemon_index=0)  # WILD_POOL_IDS[0]
    res = client.post("/api/patrol-log/claim")
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["unlocked_count"] == 0
    assert data["wild_collection"] == [{"species_id": WILD_POOL_IDS[0], "mega": False}]


def test_claim_normal_dedupes_same_species(client: TestClient) -> None:
    """同一隻野生重複收服不重複入庫。"""
    _set_state(wild=[{"species_id": WILD_POOL_IDS[5], "mega": False}])
    _add_today_log(tier="normal", pokemon_index=5)
    res = client.post("/api/patrol-log/claim")
    assert res.status_code == 200, res.text
    assert res.json()["wild_collection"] == [{"species_id": WILD_POOL_IDS[5], "mega": False}]


def test_megamax_success(client: TestClient) -> None:
    sid = WILD_POOL_IDS[0]
    _set_state(courage_bands=1, wild=[{"species_id": sid, "mega": False}])
    res = client.post("/api/wild/megamax", json={"species_id": sid})
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["courage_bands"] == 0
    assert data["wild_collection"] == [{"species_id": sid, "mega": True}]


def test_megamax_422_no_bands(client: TestClient) -> None:
    sid = WILD_POOL_IDS[0]
    _set_state(courage_bands=0, wild=[{"species_id": sid, "mega": False}])
    res = client.post("/api/wild/megamax", json={"species_id": sid})
    assert res.status_code == 422


def test_megamax_404_not_owned(client: TestClient) -> None:
    _set_state(courage_bands=1, wild=[])
    res = client.post("/api/wild/megamax", json={"species_id": WILD_POOL_IDS[0]})
    assert res.status_code == 404


def test_megamax_409_already_mega(client: TestClient) -> None:
    sid = WILD_POOL_IDS[0]
    _set_state(courage_bands=1, wild=[{"species_id": sid, "mega": True}])
    res = client.post("/api/wild/megamax", json={"species_id": sid})
    assert res.status_code == 409
