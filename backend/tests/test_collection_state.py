"""PUT /api/collection-state 測試（main.py:247-261）。

CollectionStateIn schema（schemas.py:102-106）只收 energy/unlocked_count/coins/
slot_order 四欄，handler（main.py:255-258）也只寫這四欄——courage_bands、
wild_collection 完全不在讀寫路徑上，因此理論上「PUT 缺欄位」不會清掉它們
（它們本來就不是這支 API 的職責範圍）。以下測試斷言「現況行為」。

同時涵蓋負值驗證：energy/unlocked_count/coins 有 Field(ge=0)，負值回 422。
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from database import SessionLocal
from models import CollectionState


def _seed_courage_and_wild(courage_bands: int, wild_collection: str) -> None:
    db = SessionLocal()
    try:
        row = db.get(CollectionState, 1)
        if row is None:
            row = CollectionState(id=1)
            db.add(row)
        row.courage_bands = courage_bands
        row.wild_collection = wild_collection
        db.commit()
    finally:
        db.close()


def test_put_collection_state_roundtrip(client: TestClient) -> None:
    """PUT 一組值 → GET 斷言等值（含 slot_order 順序保留）。"""
    payload = {
        "energy": 3,
        "unlocked_count": 17,
        "coins": 5,
        "slot_order": list(range(29, -1, -1)),  # 30 個倒序索引
    }
    put_res = client.put("/api/collection-state", json=payload)
    assert put_res.status_code == 200, put_res.text

    get_res = client.get("/api/collection-state")
    assert get_res.status_code == 200, get_res.text
    data = get_res.json()
    assert data["energy"] == 3
    assert data["unlocked_count"] == 17
    assert data["coins"] == 5
    assert data["slot_order"] == payload["slot_order"]


def test_put_collection_state_missing_optional_fields_preserves_them(
    client: TestClient,
) -> None:
    """現況行為：PUT payload 不含 wild_collection/courage_bands（schema 本來就不收這兩欄），
    handler 也不寫這兩個欄位 → DB 裡原值應維持不變（不是 bug，是設計上這支 API 的職責範圍
    本就不含這兩欄）。"""
    _seed_courage_and_wild(courage_bands=3, wild_collection='[{"species_id": 6, "mega": true}]')

    payload = {
        "energy": 1,
        "unlocked_count": 2,
        "coins": 1,
        "slot_order": list(range(30)),
    }
    put_res = client.put("/api/collection-state", json=payload)
    assert put_res.status_code == 200, put_res.text
    data = put_res.json()

    # 現況：courage_bands 與 wild_collection 被保留，未被這支 PUT 清掉
    assert data["courage_bands"] == 3
    assert data["wild_collection"] == [{"species_id": 6, "mega": True}]


def test_put_collection_state_rejects_negative_values(client: TestClient) -> None:
    """energy/unlocked_count/coins 均有 Field(ge=0) 驗證（schemas.py CollectionStateIn），
    負值 → 422，且 DB 內原值不受影響。"""
    baseline = {
        "energy": 1,
        "unlocked_count": 2,
        "coins": 3,
        "slot_order": list(range(30)),
    }
    assert client.put("/api/collection-state", json=baseline).status_code == 200

    for field in ("energy", "unlocked_count", "coins"):
        payload = {**baseline, field: -5}
        res = client.put("/api/collection-state", json=payload)
        assert res.status_code == 422, f"{field} 為負值時應回 422，實際 {res.status_code}"

    # 負值被擋下後，DB 原值不受影響
    data = client.get("/api/collection-state").json()
    assert data["energy"] == 1
    assert data["unlocked_count"] == 2
    assert data["coins"] == 3


def test_put_collection_state_creates_row_when_absent(client: TestClient) -> None:
    """CollectionState 尚不存在時 PUT 也應成功建立（row is None 分支，main.py:251-254）。"""
    db = SessionLocal()
    try:
        row = db.get(CollectionState, 1)
        if row is not None:
            db.delete(row)
            db.commit()
    finally:
        db.close()

    payload = {
        "energy": 2,
        "unlocked_count": 4,
        "coins": 1,
        "slot_order": list(range(30)),
    }
    res = client.put("/api/collection-state", json=payload)
    assert res.status_code == 200, res.text
    assert res.json()["unlocked_count"] == 4
