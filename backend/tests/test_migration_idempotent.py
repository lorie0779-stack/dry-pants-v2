"""init_db() migration 冪等測試（main.py:64-128）。

模擬「舊 schema」：手動建一個缺少新欄位（slot_order/courage_bands/wild_collection）
的 collection_state 表，其他表完全不存在（讓 create_all 補齊）。跑 init_db() 兩次，
斷言不拋錯，且欄位確實透過 ALTER TABLE 補上（PRAGMA table_info 驗證）。
"""
from __future__ import annotations

from sqlalchemy import text

from database import Base, engine
from main import init_db


def _table_columns(table_name: str) -> set[str]:
    with engine.connect() as conn:
        rows = conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
    return {row[1] for row in rows}  # row[1] = column name


def test_init_db_migrates_old_schema_idempotently() -> None:
    # 清空目前（由 conftest 的 _reset_database 建立的）新版 schema
    Base.metadata.drop_all(bind=engine)

    # 手動建一個「舊版」collection_state 表：只有最早期的三個欄位
    with engine.connect() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE collection_state (
                    id INTEGER PRIMARY KEY,
                    energy INTEGER NOT NULL DEFAULT 0,
                    unlocked_count INTEGER NOT NULL DEFAULT 0,
                    coins INTEGER NOT NULL DEFAULT 0
                )
                """
            )
        )
        conn.commit()

    old_columns = _table_columns("collection_state")
    assert "slot_order" not in old_columns
    assert "courage_bands" not in old_columns
    assert "wild_collection" not in old_columns

    # 第一次跑 init_db()：create_all 補齊其他表 + ALTER TABLE 補齊缺欄位，不應拋錯
    init_db()

    migrated_columns = _table_columns("collection_state")
    assert "slot_order" in migrated_columns
    assert "courage_bands" in migrated_columns
    assert "wild_collection" in migrated_columns
    # 舊欄位仍在，沒有被破壞性地重建表
    assert {"id", "energy", "unlocked_count", "coins"} <= migrated_columns

    # 第二次跑 init_db()：欄位已存在，ALTER TABLE 應被 try/except 吞掉，不拋錯、不重複
    init_db()  # 不應拋出例外

    final_columns = _table_columns("collection_state")
    assert final_columns == migrated_columns  # 欄位集合不變（冪等）

    # 順帶確認其他表也都存在（create_all 補齊）
    with engine.connect() as conn:
        table_names = {
            row[0]
            for row in conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table'")
            ).fetchall()
        }
    assert {"patrol_logs", "honor_entries", "error_reasons", "error_records"} <= table_names
