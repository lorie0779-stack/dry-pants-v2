"""經濟邊界測試：滿輪兌換扭蛋幣（main.py:390-397）、勇氣印章兌換腕帶（main.py:434-450）。"""
from __future__ import annotations

import json
from datetime import date as date_type

from fastapi.testclient import TestClient

from database import SessionLocal
from main import ROUND_SIZE
from models import CollectionState, PatrolLog


def _add_legendary_log_for_claim(log_date=None) -> None:
    db = SessionLocal()
    try:
        db.add(
            PatrolLog(
                log_date=log_date or date_type.today(),
                block_1="clean",
                block_2="clean",
                block_3="clean",
                regular_stamps=3,
                courage_stamps=0,
                encounter_tier="legendary",
                pokemon_index=1,
            )
        )
        db.commit()
    finally:
        db.close()


def test_claim_at_round_boundary_29_to_30_converts_to_coin_and_reshuffles(
    client: TestClient,
) -> None:
    """unlocked_count=29 時 claim 一次傳說 → 29+1=30 >= ROUND_SIZE(30)：
    coins_gained = 30 // 30 = 1，unlocked_count 歸 0，coins +1，slot_order 重洗
    （main.py:392-397 實際行為）。"""
    db = SessionLocal()
    try:
        row = db.get(CollectionState, 1)
        if row is None:
            row = CollectionState(id=1)
            db.add(row)
        row.energy = 0
        row.unlocked_count = ROUND_SIZE - 1  # 29
        row.coins = 0
        row.slot_order = json.dumps(list(range(ROUND_SIZE)))
        db.commit()
    finally:
        db.close()

    _add_legendary_log_for_claim()

    res = client.post("/api/patrol-log/claim")
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["unlocked_count"] == 0
    assert data["coins"] == 1
    # slot_order 重新產生：仍是合法的 30 個索引
    assert len(data["slot_order"]) == ROUND_SIZE
    assert len(set(data["slot_order"])) == ROUND_SIZE


def test_courage_redeem_insufficient_stamps_returns_422(client: TestClient) -> None:
    """勇氣印章總數 < 5（不足兌換 1 條腕帶）→ 422。"""
    db = SessionLocal()
    try:
        db.add(
            PatrolLog(
                log_date=date_type.today(),
                block_1="accident_told",
                block_2="accident_told",
                block_3="accident_told",
                regular_stamps=0,
                courage_stamps=4,  # 不足 5
                encounter_tier="none",
            )
        )
        db.commit()
    finally:
        db.close()

    res = client.post("/api/patrol-log/courage-redeem")
    assert res.status_code == 422


def test_courage_redeem_sufficient_stamps_increments_courage_bands(
    client: TestClient,
) -> None:
    """勇氣印章總數 >= 5 → bands_earned(1) > current_bands(0) → 成功，courage_bands +1。"""
    db = SessionLocal()
    try:
        db.add(
            PatrolLog(
                log_date=date_type.today(),
                block_1="accident_told",
                block_2="accident_told",
                block_3="accident_told",
                regular_stamps=0,
                courage_stamps=5,
                encounter_tier="none",
            )
        )
        db.commit()
    finally:
        db.close()

    res = client.post("/api/patrol-log/courage-redeem")
    assert res.status_code == 200, res.text
    assert res.json()["courage_bands"] == 1


def test_courage_redeem_blocked_when_already_redeemed_all_earned_bands(
    client: TestClient,
) -> None:
    """已經把賺到的腕帶都兌換完（current_bands == bands_earned）→ 再兌換一次應 422
    （main.py:445-446：bands_earned <= current_bands 才擋，示範現況的「一次只能兌 1 條」規則）。"""
    # 兩筆巡邏，累積 courage_stamps 加總 = 5 → bands_earned = 1
    db = SessionLocal()
    try:
        db.add(
            PatrolLog(
                log_date=date_type.today(),
                block_1="accident_told",
                block_2="accident_told",
                block_3="accident_told",
                regular_stamps=0,
                courage_stamps=5,
                encounter_tier="none",
            )
        )
        db.commit()
    finally:
        db.close()

    first = client.post("/api/patrol-log/courage-redeem")
    assert first.status_code == 200, first.text
    assert first.json()["courage_bands"] == 1

    second = client.post("/api/patrol-log/courage-redeem")
    assert second.status_code == 422
