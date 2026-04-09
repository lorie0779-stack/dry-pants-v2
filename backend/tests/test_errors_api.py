"""POST /api/errors 單元測試（記憶體資料庫，見 conftest.py）。"""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from database import SessionLocal
from models import ErrorReason, ErrorRecord


def test_post_error_with_existing_reason_id(
    client: TestClient,
    first_reason_id: int,
) -> None:
    """情境 A：以既有 reason_id 建立失誤紀錄。"""
    res = client.post(
        "/api/errors",
        json={
            "type": "💧",
            "location": "學校",
            "time_of_day": "上午",
            "reason_id": first_reason_id,
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["reason_id"] == first_reason_id
    assert data["type"] == "💧"
    assert data["location"] == "學校"
    assert data["time_of_day"] == "上午"
    assert "reason_text" in data

    db = SessionLocal()
    try:
        count = db.execute(select(func.count()).select_from(ErrorRecord)).scalar_one()
        assert count == 1
    finally:
        db.close()


def test_post_error_custom_reason_get_or_create(client: TestClient) -> None:
    """情境 B：custom_reason 字串觸發 Get or Create，並寫入 ErrorRecord。"""
    custom = "情境專用_全新自訂原因"
    res = client.post(
        "/api/errors",
        json={
            "type": "💩",
            "location": "家中",
            "time_of_day": "晚上",
            "custom_reason": custom,
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["reason_text"] == custom

    db = SessionLocal()
    try:
        reasons = db.execute(select(ErrorReason)).scalars().all()
        texts = {r.reason_text for r in reasons}
        assert custom in texts
        rec_count = db.execute(select(func.count()).select_from(ErrorRecord)).scalar_one()
        assert rec_count >= 1
    finally:
        db.close()


def test_post_error_rejects_reason_id_and_text_together(client: TestClient) -> None:
    res = client.post(
        "/api/errors",
        json={
            "type": "💧",
            "location": "外面",
            "time_of_day": "下午",
            "reason_id": 1,
            "reason": "不該同時出現",
        },
    )
    assert res.status_code == 422
