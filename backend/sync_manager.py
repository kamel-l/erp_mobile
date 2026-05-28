import json
import sqlite3
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

from api_client import ApiClient
from conflict_resolver import ConflictResolver
from queue_repository import QueueRepository


class SyncManager:
    def __init__(
        self,
        db_path: str,
        api_client: ApiClient,
        queue_repo: QueueRepository,
        conflict_resolver: Optional[ConflictResolver] = None,
        max_retries: int = 5,
    ):
        self.db_path = db_path
        self.api = api_client
        self.queue = queue_repo
        self.conflicts = conflict_resolver or ConflictResolver()
        self.max_retries = max_retries

    def run_sync(self) -> Dict[str, Any]:
        started = datetime.utcnow().isoformat()
        push_report = self._push_phase()
        pull_report = self._pull_phase()
        ended = datetime.utcnow().isoformat()
        return {
            "success": True,
            "started_at": started,
            "ended_at": ended,
            "push": push_report,
            "pull": pull_report,
        }

    def _push_phase(self) -> Dict[str, int]:
        pending = self.queue.get_pending(limit=200)
        done = 0
        failed = 0
        conflicts = 0

        for row in pending:
            row_id = int(row["id"])
            retry_count = int(row.get("retry_count") or 0)
            if retry_count >= self.max_retries:
                failed += 1
                continue

            self.queue.mark_processing(row_id)
            payload = json.loads(row["payload"])

            response = self.api.push_change(row["entity"], row["action"], payload)
            if response.get("success") is True:
                self.queue.mark_done(row_id)
                done += 1
                continue

            if response.get("status") == 409:
                self.queue.mark_conflict(row_id, "Server conflict response.")
                conflicts += 1
                continue

            self.queue.increment_retry(row_id)
            self.queue.mark_failed(row_id, str(response.get("error") or response))
            failed += 1

            wait_s = min(2 ** max(retry_count, 0), 30)
            time.sleep(wait_s / 10.0)

        return {"total": len(pending), "done": done, "failed": failed, "conflicts": conflicts}

    def _pull_phase(self) -> Dict[str, int]:
        last_sync = self.queue.get_setting("last_sync_at", "1970-01-01T00:00:00")
        response = self.api.pull_changes(last_sync)
        if response.get("success") is not True:
            raise RuntimeError(f"Pull failed: {response}")

        data = response.get("data") or {}
        products = data.get("produits") or []
        clients = data.get("clients") or []
        sales = data.get("ventes") or []

        with sqlite3.connect(self.db_path) as db:
            db.row_factory = sqlite3.Row
            self._upsert_items(db, "products", products)
            self._upsert_items(db, "clients", clients)
            self._upsert_items(db, "sales", sales)

            deleted = data.get("deleted") or {}
            self._apply_soft_deletes(db, "products", deleted.get("products") or [])
            self._apply_soft_deletes(db, "clients", deleted.get("clients") or [])
            self._apply_soft_deletes(db, "sales", deleted.get("sales") or [])
            db.commit()

        self.queue.set_setting("last_sync_at", response.get("timestamp") or datetime.utcnow().isoformat())
        return {"products": len(products), "clients": len(clients), "sales": len(sales)}

    def _upsert_items(self, db: sqlite3.Connection, table: str, items: List[Dict[str, Any]]):
        if not items:
            return

        for item in items:
            row_id = item.get("id")
            if row_id is None:
                continue

            existing = db.execute(f"SELECT * FROM {table} WHERE id = ?", (row_id,)).fetchone()
            if existing:
                decision = self.conflicts.resolve(dict(existing), item)
                if decision.strategy == "local_wins":
                    continue
                chosen = decision.merged_item
                self._update_row(db, table, chosen)
            else:
                self._insert_row(db, table, item)

    def _insert_row(self, db: sqlite3.Connection, table: str, item: Dict[str, Any]):
        cols = list(item.keys())
        placeholders = ",".join(["?"] * len(cols))
        sql = f"INSERT OR REPLACE INTO {table} ({','.join(cols)}) VALUES ({placeholders})"
        values = [item[c] for c in cols]
        db.execute(sql, values)

    def _update_row(self, db: sqlite3.Connection, table: str, item: Dict[str, Any]):
        cols = [c for c in item.keys() if c != "id"]
        if not cols:
            return
        set_clause = ",".join([f"{c} = ?" for c in cols])
        sql = f"UPDATE {table} SET {set_clause} WHERE id = ?"
        values = [item[c] for c in cols] + [item["id"]]
        db.execute(sql, values)

    def _apply_soft_deletes(self, db: sqlite3.Connection, table: str, deleted_rows: List[Dict[str, Any]]):
        for row in deleted_rows:
            row_id = row.get("id")
            deleted_at = row.get("deleted_at") or datetime.utcnow().isoformat()
            if row_id is None:
                continue
            db.execute(f"UPDATE {table} SET deleted_at = ? WHERE id = ?", (deleted_at, row_id))
