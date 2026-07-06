"""POST /api/patrol-log 創建邏輯測試（main.py:297-350，_compute_tier + tier 抽獎）。

實際規則（讀自 main.py，非猜測）：
- regular = 三格中 "clean" 的數量；courage = 三格中 "accident_told" 的數量。
- regular == 3（三格全乾）→ tier = "legendary"（70%，random.random() < 0.7）或
  "normal"（30%）；否則（只要有一格不是 clean，不論 accident_told/accident_silent）
  → tier = "none"，pokemon_index = None，不呼叫 random。
- tier == "legendary" 時，若 CollectionState.slot_order 存在則從中依 unlocked_count
  取下一格，否則 random.randint(0, FULL_POOL_SIZE - 1)。
- tier == "normal" 時 pokemon_index = random.randint(0, WILD_POOL_SIZE - 1)。
- 同一 log_date 重複送出 → 409（PatrolLog.log_date UNIQUE）。
"""
from __future__ import annotations

from datetime import date as date_type

from fastapi.testclient import TestClient

import main as main_module
from main import FULL_POOL_SIZE, WILD_POOL_SIZE


def _payload(b1: str = "clean", b2: str = "clean", b3: str = "clean", d=None) -> dict:
    return {
        "log_date": (d or date_type.today()).isoformat(),
        "block_1": b1,
        "block_2": b2,
        "block_3": b3,
    }


def test_all_clean_forces_legendary_when_random_below_threshold(
    client: TestClient, monkeypatch
) -> None:
    monkeypatch.setattr(main_module.random, "random", lambda: 0.1)  # < 0.7 → legendary
    res = client.post("/api/patrol-log", json=_payload())
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["encounter_tier"] == "legendary"
    assert data["regular_stamps"] == 3
    assert data["courage_stamps"] == 0
    assert data["pokemon_index"] is not None
    assert 0 <= data["pokemon_index"] < FULL_POOL_SIZE


def test_all_clean_forces_normal_when_random_above_threshold(
    client: TestClient, monkeypatch
) -> None:
    monkeypatch.setattr(main_module.random, "random", lambda: 0.9)  # >= 0.7 → normal
    res = client.post("/api/patrol-log", json=_payload())
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["encounter_tier"] == "normal"
    assert data["pokemon_index"] is not None
    assert 0 <= data["pokemon_index"] < WILD_POOL_SIZE


def test_any_block_wet_forces_tier_none_no_random_call(
    client: TestClient, monkeypatch
) -> None:
    """只要有一格不是 clean（不論有沒有說）就是 tier=none，且不應呼叫 random.random()
    （regular != 3 時 _compute_tier 直接回傳 "none"，不進 random 分支）。"""

    def _boom() -> float:
        raise AssertionError("regular != 3 時不應呼叫 random.random()")

    monkeypatch.setattr(main_module.random, "random", _boom)
    res = client.post(
        "/api/patrol-log",
        json=_payload(b1="accident_silent", b2="clean", b3="clean"),
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["encounter_tier"] == "none"
    assert data["pokemon_index"] is None
    assert data["regular_stamps"] == 2


def test_accident_told_stamps_count_only_told_not_silent(client: TestClient) -> None:
    """courage_stamps 只計 accident_told，不計 accident_silent；
    這種情況 regular != 3，tier 必為 none。"""
    res = client.post(
        "/api/patrol-log",
        json=_payload(b1="accident_told", b2="accident_told", b3="clean"),
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["regular_stamps"] == 1
    assert data["courage_stamps"] == 2
    assert data["encounter_tier"] == "none"


def test_accident_silent_gives_zero_courage_stamps(client: TestClient) -> None:
    res = client.post(
        "/api/patrol-log",
        json=_payload(b1="accident_silent", b2="accident_silent", b3="clean"),
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["courage_stamps"] == 0
    assert data["regular_stamps"] == 1


def test_duplicate_same_day_submission_returns_409(client: TestClient) -> None:
    today = date_type.today()
    first = client.post("/api/patrol-log", json=_payload(d=today))
    assert first.status_code == 200, first.text

    second = client.post("/api/patrol-log", json=_payload(d=today))
    assert second.status_code == 409


def test_legendary_uses_slot_order_when_present(client: TestClient, monkeypatch) -> None:
    """slot_order 存在時，legendary 的 pokemon_index 應取自 slot_order[unlocked_count % ROUND_SIZE]，
    而不是走 random.randint 分支。"""
    from database import SessionLocal
    from models import CollectionState
    import json

    fixed_slot_order = list(range(30))  # [0, 1, 2, ..., 29]
    db = SessionLocal()
    try:
        row = db.get(CollectionState, 1)
        if row is None:
            row = CollectionState(id=1, energy=0, unlocked_count=0, coins=0)
            db.add(row)
        row.unlocked_count = 5
        row.slot_order = json.dumps(fixed_slot_order)
        db.commit()
    finally:
        db.close()

    monkeypatch.setattr(main_module.random, "random", lambda: 0.0)  # 強制 legendary
    res = client.post("/api/patrol-log", json=_payload())
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["encounter_tier"] == "legendary"
    # unlocked_count=5 % ROUND_SIZE(30) = 5 → slot_order[5] == 5
    assert data["pokemon_index"] == fixed_slot_order[5]


def test_slot_order_initialization_has_30_unique_valid_indices(client: TestClient) -> None:
    """GET /api/collection-state 首次觸發 _make_slot_order()：30 個不重複索引，
    範圍在 0..FULL_POOL_SIZE-1。"""
    res = client.get("/api/collection-state")
    assert res.status_code == 200, res.text
    slot_order = res.json()["slot_order"]
    assert len(slot_order) == 30
    assert len(set(slot_order)) == 30  # 不重複
    assert all(0 <= i < FULL_POOL_SIZE for i in slot_order)
