"""傳說圖鑑「物種身分制」測試（記憶體資料庫，見 conftest.py）。

修的 bug：位置計數制下，slot_order 被自癒重洗會讓已解鎖格整批換成別隻寶可夢
（抓到的寶可夢與名字對不上）。身分制以 unlocked_species（species_id 清單）
持久化「捕到了誰」，slot_order 只決定接下來會遇到誰。
"""
from __future__ import annotations

import json
from datetime import date as date_type

from fastapi.testclient import TestClient

from database import SessionLocal
from main import FULL_POOL_SIZE, LEGENDARY_POOL_IDS, ROUND_SIZE
from models import CollectionState, PatrolLog


def _seed_state(
    unlocked_count: int = 0,
    slot_order: list[int] | None = None,
    unlocked_species: list[int] | None | str = "unset",
    coins: int = 0,
) -> None:
    """建立 singleton 收集狀態。unlocked_species 傳 None 模擬未回填的舊資料。"""
    db = SessionLocal()
    try:
        row = db.get(CollectionState, 1)
        if row is None:
            row = CollectionState(id=1, energy=0, coins=0)
            db.add(row)
        row.unlocked_count = unlocked_count
        row.coins = coins
        row.slot_order = json.dumps(slot_order) if slot_order is not None else None
        if unlocked_species == "unset":
            row.unlocked_species = None
        else:
            row.unlocked_species = (
                json.dumps(unlocked_species) if unlocked_species is not None else None
            )
        db.commit()
    finally:
        db.close()


def _add_today_legendary_log(pokemon_index: int) -> None:
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
                encounter_tier="legendary",
                pokemon_index=pokemon_index,
            )
        )
        db.commit()
    finally:
        db.close()


# ── 回填（舊資料 migration）──────────────────────────────────────────────────

def test_backfill_maps_slot_order_prefix_to_species(client: TestClient) -> None:
    """unlocked_species=NULL、count=19 → GET 以 slot_order 前 19 格回填身分清單。"""
    order = list(range(19, 49))  # 已知的 30 個合法索引
    _seed_state(unlocked_count=19, slot_order=order, unlocked_species=None)

    res = client.get("/api/collection-state")
    assert res.status_code == 200, res.text
    data = res.json()
    expected = [LEGENDARY_POOL_IDS[i] for i in order[:19]]
    assert data["unlocked_species"] == expected
    assert data["unlocked_count"] == 19
    # 回填已持久化（第二次 GET 結果一致，不是每次重算）
    assert client.get("/api/collection-state").json()["unlocked_species"] == expected


def test_backfill_skips_out_of_range_and_shrinks_count(client: TestClient) -> None:
    """舊 94 池殘留的越界索引不可映射 → 跳過並同步縮小 count，維持不變式。"""
    # 前 3 格中夾一個越界索引 92（舊池殘留）；長度 30 合法 → 不觸發自癒重洗
    order = [0, 92, 1] + list(range(40, 67))
    assert len(order) == ROUND_SIZE
    _seed_state(unlocked_count=3, slot_order=order, unlocked_species=None)

    data = client.get("/api/collection-state").json()
    # 92 越界被跳過：身分清單只有 2 筆，count 同步縮為 2
    assert data["unlocked_species"] == [LEGENDARY_POOL_IDS[0], LEGENDARY_POOL_IDS[1]]
    assert data["unlocked_count"] == 2


# ── 自癒重洗不再動已捕獲身分（本 bug 的回歸測試）─────────────────────────────

def test_self_heal_reshuffle_preserves_captured_species(client: TestClient) -> None:
    """slot_order 含越界值觸發自癒重洗 → 身分清單不變、新排列排除已捕獲物種。"""
    captured = [LEGENDARY_POOL_IDS[0], LEGENDARY_POOL_IDS[5], LEGENDARY_POOL_IDS[10]]
    bad_order = [92, 93] + list(range(28))  # 越界 → 觸發重洗
    _seed_state(unlocked_count=3, slot_order=bad_order, unlocked_species=captured)

    data = client.get("/api/collection-state").json()
    assert data["unlocked_species"] == captured  # 身分完全不受重洗影響
    new_order = data["slot_order"]
    assert len(new_order) == ROUND_SIZE
    assert all(0 <= i < FULL_POOL_SIZE for i in new_order)
    new_species = {LEGENDARY_POOL_IDS[i] for i in new_order}
    assert new_species.isdisjoint(set(captured))  # 不再抽到已捕獲的物種


# ── claim 記錄身分 ───────────────────────────────────────────────────────────

def test_claim_legendary_appends_species(client: TestClient) -> None:
    """claim 傳說 → unlocked_species 尾端多一筆，且是 pokemon_index 對應物種。"""
    order = list(range(30))
    _seed_state(unlocked_count=2, slot_order=order,
                unlocked_species=[LEGENDARY_POOL_IDS[0], LEGENDARY_POOL_IDS[1]])
    _add_today_legendary_log(pokemon_index=order[2])

    res = client.post("/api/patrol-log/claim")
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["unlocked_count"] == 3
    assert data["unlocked_species"] == [
        LEGENDARY_POOL_IDS[0], LEGENDARY_POOL_IDS[1], LEGENDARY_POOL_IDS[2]
    ]


def test_claim_full_round_clears_species(client: TestClient) -> None:
    """第 30 隻 claim → 換 1 金幣、count 歸零、身分清單清空、slot_order 重洗。"""
    order = list(range(30))
    species29 = [LEGENDARY_POOL_IDS[i] for i in order[:29]]
    _seed_state(unlocked_count=29, slot_order=order, unlocked_species=species29, coins=0)
    _add_today_legendary_log(pokemon_index=order[29])

    data = client.post("/api/patrol-log/claim").json()
    assert data["unlocked_count"] == 0
    assert data["unlocked_species"] == []
    assert data["coins"] == 1


# ── reset / PUT ──────────────────────────────────────────────────────────────

def test_reset_clears_species(client: TestClient) -> None:
    _seed_state(unlocked_count=3, slot_order=list(range(30)),
                unlocked_species=[LEGENDARY_POOL_IDS[0]])
    assert client.post("/api/collection-state/reset").status_code == 204
    assert client.get("/api/collection-state").json()["unlocked_species"] == []


def test_put_without_species_preserves_existing(client: TestClient) -> None:
    """舊客戶端 PUT（不帶 unlocked_species）→ 後端保留現值，不得清空。"""
    captured = [LEGENDARY_POOL_IDS[0], LEGENDARY_POOL_IDS[1]]
    _seed_state(unlocked_count=2, slot_order=list(range(30)), unlocked_species=captured)

    res = client.put("/api/collection-state", json={
        "energy": 1, "unlocked_count": 2, "coins": 0, "slot_order": list(range(30)),
    })
    assert res.status_code == 200, res.text
    assert res.json()["unlocked_species"] == captured


def test_put_rejects_unknown_species(client: TestClient) -> None:
    """PUT 帶非傳說池的 species_id → 422（防呆：不讓壞資料進 DB）。"""
    _seed_state(unlocked_count=0, slot_order=list(range(30)), unlocked_species=[])
    res = client.put("/api/collection-state", json={
        "energy": 0, "unlocked_count": 1, "coins": 0,
        "slot_order": list(range(30)),
        "unlocked_species": [99999],
    })
    assert res.status_code == 422


def test_pool_constants_in_sync() -> None:
    """後端 LEGENDARY_POOL_IDS 長度 == FULL_POOL_SIZE 且無重複（與前端同步的前提）。"""
    assert len(LEGENDARY_POOL_IDS) == FULL_POOL_SIZE
    assert len(set(LEGENDARY_POOL_IDS)) == FULL_POOL_SIZE


def test_pool_matches_shared_fixture() -> None:
    """LEGENDARY_POOL_IDS 與 shared/legendary_pool_ids.json 逐項一致。

    前端 jest 有對稱測試比對同一份 fixture——內容漂移（換隻、調序）在 CI 就抓到，
    不會等到錯誤身分寫進 DB。
    """
    import os
    fixture_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "shared", "legendary_pool_ids.json"
    )
    with open(fixture_path) as f:
        shared = json.load(f)
    assert shared == list(LEGENDARY_POOL_IDS)


# ── 不變式自癒（count 與清單長度漂移的常駐修復）──────────────────────────────

def test_heal_count_gt_species_extends_from_slot_order(client: TestClient) -> None:
    """count > len(species)（舊快取前端只加計數）→ 以 slot_order 對應位置補身分。"""
    order = list(range(30))
    _seed_state(unlocked_count=4, slot_order=order,
                unlocked_species=[LEGENDARY_POOL_IDS[0], LEGENDARY_POOL_IDS[1]])

    data = client.get("/api/collection-state").json()
    assert data["unlocked_species"] == [LEGENDARY_POOL_IDS[i] for i in range(4)]
    assert data["unlocked_count"] == 4
    # 已持久化（再 GET 一次不變）
    assert client.get("/api/collection-state").json()["unlocked_count"] == 4


def test_heal_count_lt_species_uses_list_length(client: TestClient) -> None:
    """count < len(species) → 清單是真相，count 修正為清單長度。"""
    captured = [LEGENDARY_POOL_IDS[0], LEGENDARY_POOL_IDS[1], LEGENDARY_POOL_IDS[2]]
    _seed_state(unlocked_count=1, slot_order=list(range(30)), unlocked_species=captured)

    data = client.get("/api/collection-state").json()
    assert data["unlocked_count"] == 3
    assert data["unlocked_species"] == captured


def test_put_with_species_binds_count_to_list_length(client: TestClient) -> None:
    """PUT 帶身分清單時，count 以清單長度為準（忽略 payload 的計數）。"""
    _seed_state(unlocked_count=0, slot_order=list(range(30)), unlocked_species=[])
    res = client.put("/api/collection-state", json={
        "energy": 0, "unlocked_count": 7, "coins": 0,
        "slot_order": list(range(30)),
        "unlocked_species": [LEGENDARY_POOL_IDS[0], LEGENDARY_POOL_IDS[1]],
    })
    assert res.status_code == 200, res.text
    assert res.json()["unlocked_count"] == 2
