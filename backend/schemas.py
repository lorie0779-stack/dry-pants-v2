from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator


class ErrorReasonOut(BaseModel):
    id: int
    reason_text: str

    model_config = {"from_attributes": True}


class ErrorCreate(BaseModel):
    type: str = Field(..., description="💩 或 💧")
    location: str
    time_of_day: str
    incident_date: date | None = Field(
        default=None,
        description="失誤發生的日期（YYYY-MM-DD）；不填則為 null",
    )
    reason: str | None = Field(
        default=None,
        description="失誤原因文字；與 reason_id 擇一；後端會 Get or Create ErrorReason",
    )
    reason_id: int | None = Field(
        default=None,
        description="使用既有原因 ID；與字串原因擇一",
    )
    custom_reason: str | None = Field(
        default=None,
        description="自訂原因字串（語意同 reason）；與 reason_id 擇一",
    )

    @model_validator(mode="after")
    def exactly_one_reason_source(self) -> "ErrorCreate":
        has_id = self.reason_id is not None
        text = ""
        for candidate in (self.reason, self.custom_reason):
            if candidate is not None and candidate.strip():
                text = candidate.strip()
                break
        has_text = bool(text)
        if has_id and has_text:
            raise ValueError("不可同時提供 reason_id 與字串原因（reason／custom_reason）")
        if not has_id and not has_text:
            raise ValueError("必須提供 reason_id 或 reason／custom_reason 其一")
        return self

    def resolved_reason_text_for_create(self) -> str | None:
        for candidate in (self.custom_reason, self.reason):
            if candidate is not None and candidate.strip():
                return candidate.strip()
        return None


class ErrorRecordOut(BaseModel):
    id: int
    type: str
    location: str
    time_of_day: str
    incident_date: date | None
    reason_id: int
    reason_text: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ErrorRecordRow(BaseModel):
    id: int
    type: str
    location: str
    time_of_day: str
    incident_date: date | None
    reason_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class CollectionStateOut(BaseModel):
    energy: int
    unlocked_count: int
    coins: int

    model_config = {"from_attributes": True}


class CollectionStateIn(BaseModel):
    energy: int
    unlocked_count: int
    coins: int


class HonorEntryOut(BaseModel):
    id: int
    entry_time: str
    entry_text: str

    model_config = {"from_attributes": True}


class HonorEntryIn(BaseModel):
    entry_time: str
    entry_text: str
