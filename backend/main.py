import json
import random

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import date as date_type, datetime

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from database import SessionLocal, engine, get_db
from models import Base, CollectionState, ErrorReason, ErrorRecord, HonorEntry, PatrolLog
from schemas import (
    CollectionStateIn,
    CollectionStateOut,
    CourageTotalOut,
    ErrorCreate,
    ErrorReasonOut,
    ErrorRecordOut,
    ErrorRecordRow,
    HonorEntryIn,
    HonorEntryOut,
    PatrolLogIn,
    PatrolLogOut,
    WildMegamaxIn,
)

FULL_POOL_SIZE = 92   # 傳說池大小（原 94，移除武道熊師/美錄梅塔→歸野生池可巨大化）
ROUND_SIZE = 30       # 每輪隨機取的數量
WILD_POOL_SIZE = 30   # 野生圖鑑大小（有 Gmax 型態的 30 隻）

# 野生池 species_id，順序須與前端 WILD_POOL 陣列完全一致（pokemon_index 兩邊共用）。
# 改動順序時兩邊一起改。
WILD_POOL_IDS = [
    3, 6, 9, 12, 25, 52, 68, 94, 99, 131, 133, 143,        # 國民級 12
    812, 815, 818, 823, 869, 892, 809, 569,                # 中段 8（892 武道熊師、809 美錄梅塔）
    834, 839, 841, 842, 844, 849, 851, 858, 861, 879,      # 中後段 10
]

# 傳說池 species_id（92 隻），順序須與前端 DryPantsApp.tsx 的 LEGENDARY_POOL 完全一致
# （slot_order / pokemon_index 都是指進這張表的索引）。改動時兩邊一起改。
LEGENDARY_POOL_IDS = [
    # Gen 1–2
    144, 145, 146, 150, 151,
    243, 244, 245, 249, 250, 251,
    # Gen 3
    377, 378, 379, 380, 381, 382, 383, 384, 385, 386,
    # Gen 4
    480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493,
    # Gen 5
    494, 638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649,
    # Gen 6
    716, 717, 718, 719, 720, 721,
    # Gen 7
    772, 773, 785, 786, 787, 788, 789, 790, 791, 792, 800, 801, 802, 807, 808,
    # Gen 8（892 武道熊師、809 美錄梅塔已歸野生池）
    888, 889, 890, 891, 893, 894, 895, 896, 897, 898, 905,
    # Gen 9
    1001, 1002, 1003, 1004, 1005, 1006, 1014, 1015, 1016, 1017, 1024, 1025,
]
LEGENDARY_ID_SET = set(LEGENDARY_POOL_IDS)
# 兩邊常數失步時直接開機失敗，好過上線後靜默錯位
assert len(LEGENDARY_POOL_IDS) == FULL_POOL_SIZE


def _make_slot_order(exclude_species: list[int] | None = None) -> str:
    """從 FULL_POOL_SIZE 中隨機抽取 ROUND_SIZE 個不重複索引。

    exclude_species：已捕獲的 species_id 清單。自癒重洗時傳入，避免新排列
    再抽到本輪已捕獲的物種（同輪重複）。排除後不足一輪則退回全池。
    """
    candidates = list(range(FULL_POOL_SIZE))
    if exclude_species:
        excluded = set(exclude_species)
        filtered = [i for i in candidates if LEGENDARY_POOL_IDS[i] not in excluded]
        if len(filtered) >= ROUND_SIZE:
            candidates = filtered
    return json.dumps(random.sample(candidates, ROUND_SIZE))


DEFAULT_REASON_SEEDS = [
    "廁所都有人",
    "來不及脫褲子",
    "玩得太專心忘了",
    "睡覺時沒醒來",
]

app = FastAPI(title="Dry-Pants Adventure API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)

    # Migration: add incident_date column to existing DBs that predate this field
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE error_records ADD COLUMN incident_date DATE"))
            conn.commit()
        except Exception:
            pass  # column already exists

    # Migration: add slot_order column to collection_state
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE collection_state ADD COLUMN slot_order VARCHAR(256)"))
            conn.commit()
        except Exception:
            pass  # column already exists

    # Migration: add claimed column to patrol_logs
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE patrol_logs ADD COLUMN claimed INTEGER DEFAULT 0"))
            conn.commit()
        except Exception:
            pass  # column already exists

    # Migration: add released column to patrol_logs
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE patrol_logs ADD COLUMN released INTEGER DEFAULT 0"))
            conn.commit()
        except Exception:
            pass  # column already exists

    # Migration: add courage_bands column to collection_state
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE collection_state ADD COLUMN courage_bands INTEGER DEFAULT 0"))
            conn.commit()
        except Exception:
            pass  # column already exists

    # Migration: add wild_collection column to collection_state
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE collection_state ADD COLUMN wild_collection VARCHAR(2048)"))
            conn.commit()
        except Exception:
            pass  # column already exists

    # Migration: add unlocked_species column to collection_state（傳說圖鑑身分制）
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE collection_state ADD COLUMN unlocked_species VARCHAR(512)"))
            conn.commit()
        except Exception:
            pass  # column already exists

    db = SessionLocal()
    try:
        existing = db.execute(select(func.count()).select_from(ErrorReason)).scalar_one()
        if existing == 0:
            for seed_text in DEFAULT_REASON_SEEDS:
                db.add(ErrorReason(reason_text=seed_text))
            db.commit()

        # Ensure singleton CollectionState row exists
        if db.get(CollectionState, 1) is None:
            db.add(CollectionState(id=1, energy=0, unlocked_count=0, coins=0))
            db.commit()
    finally:
        db.close()


@app.on_event("startup")
def on_startup() -> None:
    init_db()


def get_or_create_reason(db: Session, reason_text: str) -> ErrorReason:
    normalized = reason_text.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="reason 不可為空")

    row = db.execute(
        select(ErrorReason).where(ErrorReason.reason_text == normalized)
    ).scalar_one_or_none()
    if row:
        return row

    new_reason = ErrorReason(reason_text=normalized)
    db.add(new_reason)
    db.commit()
    db.refresh(new_reason)
    return new_reason


@app.post("/api/errors", response_model=ErrorRecordOut)
def create_error(payload: ErrorCreate, db: Session = Depends(get_db)) -> ErrorRecordOut:
    if payload.type not in ("💩", "💧"):
        raise HTTPException(status_code=400, detail="type 必須為 💩 或 💧")

    if payload.reason_id is not None:
        reason = db.get(ErrorReason, payload.reason_id)
        if reason is None:
            raise HTTPException(status_code=404, detail="reason_id 不存在")
    else:
        reason_text = payload.resolved_reason_text_for_create()
        assert reason_text is not None
        reason = get_or_create_reason(db, reason_text)

    record = ErrorRecord(
        type=payload.type,
        location=payload.location,
        time_of_day=payload.time_of_day,
        reason_id=reason.id,
        incident_date=payload.incident_date,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return ErrorRecordOut(
        id=record.id,
        type=record.type,
        location=record.location,
        time_of_day=record.time_of_day,
        incident_date=record.incident_date,
        reason_id=reason.id,
        reason_text=reason.reason_text,
        created_at=record.created_at,
    )


@app.get("/api/error-reasons", response_model=list[ErrorReasonOut])
def list_error_reasons(db: Session = Depends(get_db)) -> list[ErrorReasonOut]:
    rows = db.execute(select(ErrorReason).order_by(ErrorReason.id)).scalars().all()
    return [ErrorReasonOut.model_validate(r) for r in rows]


@app.get("/api/errors", response_model=list[ErrorRecordRow])
def list_errors(db: Session = Depends(get_db)) -> list[ErrorRecordRow]:
    rows = (
        db.execute(select(ErrorRecord).order_by(ErrorRecord.created_at.desc()))
        .scalars()
        .all()
    )
    return [ErrorRecordRow.model_validate(r) for r in rows]


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# ── Collection State ──────────────────────────────────────────────────────────

def _state_to_out(row: CollectionState) -> CollectionStateOut:
    return CollectionStateOut(
        energy=row.energy,
        unlocked_count=row.unlocked_count,
        coins=row.coins,
        slot_order=json.loads(row.slot_order) if row.slot_order else list(range(ROUND_SIZE)),
        courage_bands=row.courage_bands if row.courage_bands is not None else 0,
        wild_collection=json.loads(row.wild_collection) if row.wild_collection else [],
        unlocked_species=json.loads(row.unlocked_species) if row.unlocked_species else [],
    )


@app.get("/api/collection-state", response_model=CollectionStateOut)
def get_collection_state(db: Session = Depends(get_db)) -> CollectionStateOut:
    row = db.get(CollectionState, 1)
    if row is None:
        row = CollectionState(
            id=1, energy=0, unlocked_count=0, coins=0,
            slot_order=_make_slot_order(), unlocked_species="[]",
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return _state_to_out(row)

    changed = False
    if row.slot_order is None:
        row.slot_order = _make_slot_order()
        changed = True
    elif row.unlocked_species is None:
        # 回填（身分制 migration）：舊資料只有位置計數，以「當下」slot_order 前綴
        # 映射成物種身分清單（承認現況為既成事實）。越界索引（舊 94 池殘留）
        # 無法映射則跳過，計數同步縮小以維持 count == len(species) 不變式。
        order = json.loads(row.slot_order)
        prefix = order[: max(row.unlocked_count or 0, 0)]
        species = [LEGENDARY_POOL_IDS[i] for i in prefix if 0 <= i < FULL_POOL_SIZE]
        row.unlocked_species = json.dumps(species)
        row.unlocked_count = len(species)
        changed = True

    if row.slot_order is not None:
        # 自癒：舊 slot_order 可能含已縮小的池越界 index（94→92 後的 92/93），重洗。
        # 已解鎖格的身分存在 unlocked_species，不受重洗影響；重洗時排除已捕獲物種
        # 避免同輪重複。
        existing = json.loads(row.slot_order)
        if any(i >= FULL_POOL_SIZE for i in existing) or len(existing) != ROUND_SIZE:
            captured = json.loads(row.unlocked_species) if row.unlocked_species else []
            row.slot_order = _make_slot_order(exclude_species=captured)
            changed = True
    if row.unlocked_species is None:
        row.unlocked_species = "[]"
        changed = True

    if changed:
        db.commit()
        db.refresh(row)
    return _state_to_out(row)


@app.put("/api/collection-state", response_model=CollectionStateOut)
def save_collection_state(
    payload: CollectionStateIn, db: Session = Depends(get_db)
) -> CollectionStateOut:
    row = db.get(CollectionState, 1)
    if row is None:
        row = CollectionState(id=1)
        db.add(row)
    row.energy = payload.energy
    row.unlocked_count = payload.unlocked_count
    row.coins = payload.coins
    row.slot_order = json.dumps(payload.slot_order)
    if payload.unlocked_species is not None:
        # 身分制：前端能量兌換路徑會帶完整清單；舊客戶端未帶則保留現值。
        invalid = [s for s in payload.unlocked_species if s not in LEGENDARY_ID_SET]
        if invalid:
            raise HTTPException(status_code=422, detail=f"未知的傳說 species_id：{invalid}")
        row.unlocked_species = json.dumps(payload.unlocked_species)
    db.commit()
    db.refresh(row)
    return _state_to_out(row)


@app.get("/api/honor-entries", response_model=list[HonorEntryOut])
def list_honor_entries(db: Session = Depends(get_db)) -> list[HonorEntryOut]:
    rows = db.execute(select(HonorEntry)).scalars().all()

    # 依兌換時間降冪（最新在最上面）。entry_time 為字串，舊資料未補零、
    # 新資料補零，純字串排序不可靠，故解析成 datetime 後排序；
    # 解析失敗者退回 id 當次序，排在最後。
    def sort_key(r: HonorEntry) -> tuple[datetime, int]:
        try:
            return (datetime.strptime(r.entry_time, "%Y/%m/%d %H:%M"), r.id)
        except (ValueError, TypeError):
            return (datetime.min, r.id)

    rows = sorted(rows, key=sort_key, reverse=True)
    return [HonorEntryOut.model_validate(r) for r in rows]


@app.post("/api/honor-entries", response_model=HonorEntryOut)
def create_honor_entry(
    payload: HonorEntryIn, db: Session = Depends(get_db)
) -> HonorEntryOut:
    entry = HonorEntry(entry_time=payload.entry_time, entry_text=payload.entry_text)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return HonorEntryOut.model_validate(entry)


# ── Patrol Log ───────────────────────────────────────────────────────────────

VALID_BLOCKS = {"clean", "accident_told", "accident_silent"}


def _compute_tier(blocks: list[str]) -> tuple[str, int, int]:
    # 規則：乾爽是收服寶可夢的「入場券」——三格全乾才開戰；
    # 只要有一格尿濕（有說或沒說）當天就不開戰，讓 Ryder 清楚「尿濕＝失去收服機會」。
    # 勇氣印章獨立計算：每一格「有說」（尿濕但主動說）+1 枚，鼓勵誠實。
    regular = sum(1 for b in blocks if b == "clean")
    courage = sum(1 for b in blocks if b == "accident_told")
    if regular == 3:
        tier = "legendary" if random.random() < 0.7 else "normal"
    else:
        tier = "none"
    return tier, regular, courage


@app.post("/api/patrol-log", response_model=PatrolLogOut)
def create_patrol_log(
    payload: PatrolLogIn, db: Session = Depends(get_db)
) -> PatrolLogOut:
    existing = db.execute(
        select(PatrolLog).where(PatrolLog.log_date == payload.log_date)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="今日巡邏已記錄")

    blocks = [payload.block_1, payload.block_2, payload.block_3]
    tier, regular, courage = _compute_tier(blocks)

    pokemon_idx: int | None = None
    if tier == "legendary":
        # 傳說：依 slot_order 取下一格（index 指進前端 LEGENDARY_POOL）
        state = db.get(CollectionState, 1)
        if state and state.slot_order:
            slot_order = json.loads(state.slot_order)
            next_pos = state.unlocked_count % ROUND_SIZE
            pokemon_idx = slot_order[next_pos]
        else:
            pokemon_idx = random.randint(0, FULL_POOL_SIZE - 1)
    elif tier == "normal":
        # 野生：隨機抽一隻（index 指進前端 WILD_POOL / 後端 WILD_POOL_IDS）
        pokemon_idx = random.randint(0, WILD_POOL_SIZE - 1)

    log = PatrolLog(
        log_date=payload.log_date,
        block_1=payload.block_1,
        block_2=payload.block_2,
        block_3=payload.block_3,
        regular_stamps=regular,
        courage_stamps=courage,
        encounter_tier=tier,
        pokemon_index=pokemon_idx,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return PatrolLogOut.model_validate(log)


@app.get("/api/patrol-log/today", response_model=PatrolLogOut | None)
def get_today_patrol_log(db: Session = Depends(get_db)) -> PatrolLogOut | None:
    today = date_type.today()
    row = db.execute(
        select(PatrolLog).where(PatrolLog.log_date == today)
    ).scalar_one_or_none()
    if row is None:
        return None
    return PatrolLogOut.model_validate(row)


@app.post("/api/patrol-log/claim", response_model=CollectionStateOut)
def claim_patrol_encounter(db: Session = Depends(get_db)) -> CollectionStateOut:
    today = date_type.today()
    log = db.execute(
        select(PatrolLog).where(PatrolLog.log_date == today)
    ).scalar_one_or_none()
    if log is None:
        raise HTTPException(status_code=404, detail="今日尚無巡邏記錄")
    if log.encounter_tier == "none" or log.pokemon_index is None:
        raise HTTPException(status_code=422, detail="今日遭遇等級為 none，無法領取")
    if log.claimed:
        raise HTTPException(status_code=409, detail="今日遭遇戰已領取")

    log.claimed = True
    row = db.get(CollectionState, 1)
    if row is None:
        row = CollectionState(id=1, energy=0, unlocked_count=0, coins=0)
        db.add(row)

    if log.encounter_tier == "normal":
        # 野生：收進野生圖鑑（依 species_id 去重，已擁有則略過不重複加）
        species_id = WILD_POOL_IDS[log.pokemon_index]
        wild = json.loads(row.wild_collection) if row.wild_collection else []
        if not any(w["species_id"] == species_id for w in wild):
            wild.append({"species_id": species_id, "mega": False})
            row.wild_collection = json.dumps(wild)
    else:
        # 傳說：記錄物種身分＋填格；滿一輪換金幣、清空本輪身分並重洗
        species = json.loads(row.unlocked_species) if row.unlocked_species else []
        if 0 <= log.pokemon_index < FULL_POOL_SIZE:
            species.append(LEGENDARY_POOL_IDS[log.pokemon_index])
        row.unlocked_count += 1
        if row.unlocked_count >= ROUND_SIZE:
            coins_gained = row.unlocked_count // ROUND_SIZE
            row.unlocked_count = row.unlocked_count % ROUND_SIZE
            row.coins += coins_gained
            row.slot_order = _make_slot_order()
            species = []
        row.unlocked_species = json.dumps(species)

    db.commit()
    db.refresh(row)
    return _state_to_out(row)


@app.post("/api/patrol-log/release", response_model=PatrolLogOut)
def release_patrol_encounter(db: Session = Depends(get_db)) -> PatrolLogOut:
    """放生今日遭遇戰的寶可夢：標記已處理但不收進圖鑑（unlocked_count 不變）。
    與 claim 互斥——放生後今日不可再領取。"""
    today = date_type.today()
    log = db.execute(
        select(PatrolLog).where(PatrolLog.log_date == today)
    ).scalar_one_or_none()
    if log is None:
        raise HTTPException(status_code=404, detail="今日尚無巡邏記錄")
    if log.encounter_tier == "none" or log.pokemon_index is None:
        raise HTTPException(status_code=422, detail="今日遭遇等級為 none，無法放生")
    if log.claimed:
        raise HTTPException(status_code=409, detail="今日遭遇戰已領取，無法放生")
    if log.released:
        raise HTTPException(status_code=409, detail="今日已放生")

    log.claimed = True  # 標記已處理，擋掉後續 claim
    log.released = True
    db.commit()
    db.refresh(log)
    return PatrolLogOut.model_validate(log)


@app.get("/api/patrol-log/courage-total", response_model=CourageTotalOut)
def get_courage_total(db: Session = Depends(get_db)) -> CourageTotalOut:
    total = db.execute(select(func.sum(PatrolLog.courage_stamps))).scalar_one() or 0
    return CourageTotalOut(total_courage=total)


@app.post("/api/patrol-log/courage-redeem", response_model=CollectionStateOut)
def redeem_courage_band(db: Session = Depends(get_db)) -> CollectionStateOut:
    total = db.execute(select(func.sum(PatrolLog.courage_stamps))).scalar_one() or 0
    row = db.get(CollectionState, 1)
    if row is None:
        row = CollectionState(id=1, energy=0, unlocked_count=0, coins=0, courage_bands=0, slot_order=_make_slot_order())
        db.add(row)
        db.commit()
        db.refresh(row)
    bands_earned = total // 5
    current_bands = row.courage_bands if row.courage_bands is not None else 0
    if bands_earned <= current_bands:
        raise HTTPException(status_code=422, detail="勇氣印章不足，無法兌換極巨腕帶")
    row.courage_bands = current_bands + 1
    db.commit()
    db.refresh(row)
    return _state_to_out(row)


@app.post("/api/wild/megamax", response_model=CollectionStateOut)
def megamax_wild(payload: WildMegamaxIn, db: Session = Depends(get_db)) -> CollectionStateOut:
    """對一隻已擁有的野生寶可夢極巨化：消耗 1 條極巨腕帶，將該筆 mega 設為 True。"""
    row = db.get(CollectionState, 1)
    if row is None:
        raise HTTPException(status_code=404, detail="尚無收集狀態")
    bands = row.courage_bands if row.courage_bands is not None else 0
    if bands < 1:
        raise HTTPException(status_code=422, detail="沒有極巨腕帶，無法極巨化")

    wild = json.loads(row.wild_collection) if row.wild_collection else []
    entry = next((w for w in wild if w["species_id"] == payload.species_id), None)
    if entry is None:
        raise HTTPException(status_code=404, detail="尚未擁有這隻野生寶可夢")
    if entry.get("mega"):
        raise HTTPException(status_code=409, detail="這隻已經極巨化過了")

    entry["mega"] = True
    row.wild_collection = json.dumps(wild)
    row.courage_bands = bands - 1
    db.commit()
    db.refresh(row)
    return _state_to_out(row)


@app.post("/api/collection-state/reset", status_code=204)
def reset_collection_state(db: Session = Depends(get_db)) -> None:
    db.execute(text("DELETE FROM honor_entries"))
    # 同步清空巡邏紀錄：否則今日 log 仍在會擋住重新測試（409），
    # 且勇氣印章總計是從 patrol_logs 加總，不清就無法歸零。
    db.execute(text("DELETE FROM patrol_logs"))
    row = db.get(CollectionState, 1)
    if row is None:
        row = CollectionState(id=1)
        db.add(row)
    row.energy = 0
    row.unlocked_count = 0
    row.coins = 0
    row.courage_bands = 0
    row.wild_collection = "[]"
    row.unlocked_species = "[]"
    row.slot_order = _make_slot_order()  # 重置時產生新隨機排列
    db.commit()


