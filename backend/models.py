from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class CollectionState(Base):
    __tablename__ = "collection_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    energy: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unlocked_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    coins: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    slot_order: Mapped[str | None] = mapped_column(String(256), nullable=True, default=None)


class HonorEntry(Base):
    __tablename__ = "honor_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entry_time: Mapped[str] = mapped_column(String(32), nullable=False)
    entry_text: Mapped[str] = mapped_column(String(255), nullable=False)


class ErrorReason(Base):
    __tablename__ = "error_reasons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    reason_text: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)

    records: Mapped[list["ErrorRecord"]] = relationship("ErrorRecord", back_populates="reason")


class ErrorRecord(Base):
    __tablename__ = "error_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    type: Mapped[str] = mapped_column(String(8), nullable=False)
    location: Mapped[str] = mapped_column(String(32), nullable=False)
    time_of_day: Mapped[str] = mapped_column(String(16), nullable=False)
    reason_id: Mapped[int] = mapped_column(Integer, ForeignKey("error_reasons.id"), nullable=False)
    incident_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    reason: Mapped["ErrorReason"] = relationship("ErrorReason", back_populates="records")
