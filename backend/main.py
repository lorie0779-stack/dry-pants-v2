import json
import random

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from database import SessionLocal, engine, get_db
from models import Base, CollectionState, ErrorReason, ErrorRecord, HonorEntry
from schemas import (
    CollectionStateIn,
    CollectionStateOut,
    ErrorCreate,
    ErrorReasonOut,
    ErrorRecordOut,
    ErrorRecordRow,
    HonorEntryIn,
    HonorEntryOut,
)

FULL_POOL_SIZE = 94   # 完整傳說池大小（71 is_legendary + 23 is_mythical，Gen 1–9）
ROUND_SIZE = 30       # 每輪隨機取的數量


def _make_slot_order() -> str:
    """從 FULL_POOL_SIZE 中隨機抽取 ROUND_SIZE 個不重複索引"""
    return json.dumps(random.sample(range(FULL_POOL_SIZE), ROUND_SIZE))


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
    )


@app.get("/api/collection-state", response_model=CollectionStateOut)
def get_collection_state(db: Session = Depends(get_db)) -> CollectionStateOut:
    row = db.get(CollectionState, 1)
    if row is None:
        row = CollectionState(id=1, energy=0, unlocked_count=0, coins=0, slot_order=_make_slot_order())
        db.add(row)
        db.commit()
        db.refresh(row)
    elif row.slot_order is None:
        row.slot_order = _make_slot_order()
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
    db.commit()
    db.refresh(row)
    return _state_to_out(row)


@app.get("/api/honor-entries", response_model=list[HonorEntryOut])
def list_honor_entries(db: Session = Depends(get_db)) -> list[HonorEntryOut]:
    rows = (
        db.execute(select(HonorEntry).order_by(HonorEntry.id.desc())).scalars().all()
    )
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


@app.post("/api/collection-state/reset", status_code=204)
def reset_collection_state(db: Session = Depends(get_db)) -> None:
    db.execute(text("DELETE FROM honor_entries"))
    row = db.get(CollectionState, 1)
    if row is None:
        row = CollectionState(id=1)
        db.add(row)
    row.energy = 0
    row.unlocked_count = 0
    row.coins = 0
    row.slot_order = _make_slot_order()  # 重置時產生新隨機排列
    db.commit()


