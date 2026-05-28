import json
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional


class QueueRepository:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._ensure_tables()

    def _connect(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _ensure_tables(self):
        db = self._connect()
        try:
            db.execute(
                """
                CREATE TABLE IF NOT EXISTS sync_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    entity TEXT NOT NULL,
                    entity_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    retry_count INTEGER NOT NULL DEFAULT 0,
                    last_error TEXT,
                    updated_at TEXT NOT NULL
                )
                """
            )
            db.execute(
                """
                CREATE TABLE IF NOT EXISTS sync_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            db.commit()
        finally:
            db.close()

    def enqueue(self, entity: str, entity_id: str, action: str, payload: Dict[str, Any]):
        db = self._connect()
        try:
            db.execute(
                """
                INSERT INTO sync_queue (entity, entity_id, action, payload, status, updated_at)
                VALUES (?, ?, ?, ?, 'pending', ?)
                """,
                (entity, entity_id, action, json.dumps(payload), datetime.utcnow().isoformat()),
            )
            db.commit()
        finally:
            db.close()

    def get_pending(self, limit: int = 200) -> List[Dict[str, Any]]:
        db = self._connect()
        try:
            rows = db.execute(
                """
                SELECT *
                FROM sync_queue
                WHERE status IN ('pending', 'failed')
                ORDER BY id ASC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
            return [dict(r) for r in rows]
        finally:
            db.close()

    def mark_processing(self, row_id: int):
        self._set_status(row_id, "processing")

    def mark_done(self, row_id: int):
        self._set_status(row_id, "done", None)

    def mark_failed(self, row_id: int, error_msg: str):
        self._set_status(row_id, "failed", error_msg[:1000])

    def mark_conflict(self, row_id: int, reason: str):
        self._set_status(row_id, "conflict", reason[:1000])

    def increment_retry(self, row_id: int):
        db = self._connect()
        try:
            db.execute(
                """
                UPDATE sync_queue
                SET retry_count = retry_count + 1, updated_at = ?
                WHERE id = ?
                """,
                (datetime.utcnow().isoformat(), row_id),
            )
            db.commit()
        finally:
            db.close()

    def _set_status(self, row_id: int, status: str, last_error: Optional[str] = None):
        db = self._connect()
        try:
            db.execute(
                """
                UPDATE sync_queue
                SET status = ?, last_error = ?, updated_at = ?
                WHERE id = ?
                """,
                (status, last_error, datetime.utcnow().isoformat(), row_id),
            )
            db.commit()
        finally:
            db.close()

    def get_setting(self, key: str, default: Optional[str] = None) -> Optional[str]:
        db = self._connect()
        try:
            row = db.execute("SELECT value FROM sync_settings WHERE key = ?", (key,)).fetchone()
            if not row:
                return default
            return str(row["value"])
        finally:
            db.close()

    def set_setting(self, key: str, value: str):
        db = self._connect()
        try:
            db.execute(
                """
                INSERT INTO sync_settings (key, value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
                """,
                (key, value, datetime.utcnow().isoformat()),
            )
            db.commit()
        finally:
            db.close()
