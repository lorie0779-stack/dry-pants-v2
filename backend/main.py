from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from database import SessionLocal, engine, get_db
from models import Base, ErrorReason, ErrorRecord
from schemas import ErrorCreate, ErrorReasonOut, ErrorRecordOut, ErrorRecordRow

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

    db = SessionLocal()
    try:
        existing = db.execute(select(func.count()).select_from(ErrorReason)).scalar_one()
        if existing == 0:
            for seed_text in DEFAULT_REASON_SEEDS:
                db.add(ErrorReason(reason_text=seed_text))
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

#修正 `create_error` 回應中的 `reason_id` 錯誤。


