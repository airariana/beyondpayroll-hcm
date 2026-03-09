"""SQLite database layer for Sales Cadence MCP Server."""

import json
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional


class Database:
    """SQLite database for prospects, cadences, enrollments, and activity logs."""

    def __init__(self, path: str = "./sales_cadence.db"):
        self.path = path
        self._conn: Optional[sqlite3.Connection] = None

    def _get_conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(self.path)
            self._conn.row_factory = sqlite3.Row
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.execute("PRAGMA foreign_keys=ON")
            self._init_tables()
        return self._conn

    def _init_tables(self) -> None:
        conn = self._get_conn()
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS prospects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                company TEXT DEFAULT '',
                phone TEXT DEFAULT '',
                email TEXT DEFAULT '',
                title TEXT DEFAULT '',
                status TEXT DEFAULT 'new',
                custom_fields TEXT DEFAULT '{}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS cadences (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                steps TEXT NOT NULL,
                active INTEGER DEFAULT 1,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS cadence_enrollments (
                id TEXT PRIMARY KEY,
                prospect_id TEXT NOT NULL,
                cadence_id TEXT NOT NULL,
                current_step INTEGER DEFAULT 0,
                status TEXT DEFAULT 'active',
                next_action_at TEXT,
                enrolled_at TEXT NOT NULL,
                FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
                FOREIGN KEY (cadence_id) REFERENCES cadences(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS activity_log (
                id TEXT PRIMARY KEY,
                prospect_id TEXT NOT NULL,
                channel TEXT NOT NULL,
                action TEXT NOT NULL,
                details TEXT DEFAULT '{}',
                created_at TEXT NOT NULL,
                FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
            CREATE INDEX IF NOT EXISTS idx_prospects_email ON prospects(email);
            CREATE INDEX IF NOT EXISTS idx_enrollments_status ON cadence_enrollments(status);
            CREATE INDEX IF NOT EXISTS idx_enrollments_next_action ON cadence_enrollments(next_action_at);
            CREATE INDEX IF NOT EXISTS idx_activity_prospect ON activity_log(prospect_id);
        """)
        conn.commit()

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _new_id() -> str:
        return str(uuid.uuid4())[:8]

    def _row_to_dict(self, row: sqlite3.Row) -> dict[str, Any]:
        d = dict(row)
        for key in ("custom_fields", "steps", "details"):
            if key in d and isinstance(d[key], str):
                try:
                    d[key] = json.loads(d[key])
                except (json.JSONDecodeError, TypeError):
                    pass
        if "active" in d:
            d["active"] = bool(d["active"])
        return d

    # ── Prospects ──────────────────────────────────────────────────────

    def create_prospect(self, name: str, company: str = "", phone: str = "",
                        email: str = "", title: str = "", status: str = "new",
                        custom_fields: Optional[dict] = None) -> dict:
        conn = self._get_conn()
        pid = self._new_id()
        now = self._now()
        conn.execute(
            "INSERT INTO prospects (id, name, company, phone, email, title, status, custom_fields, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (pid, name, company, phone, email, title, status,
             json.dumps(custom_fields or {}), now, now)
        )
        conn.commit()
        return self.get_prospect(pid)

    def get_prospect(self, prospect_id: str) -> Optional[dict]:
        conn = self._get_conn()
        row = conn.execute("SELECT * FROM prospects WHERE id = ?", (prospect_id,)).fetchone()
        return self._row_to_dict(row) if row else None

    def list_prospects(self, status: Optional[str] = None, company: Optional[str] = None,
                       search: Optional[str] = None, limit: int = 20, offset: int = 0) -> dict:
        conn = self._get_conn()
        where_clauses, params = [], []

        if status:
            where_clauses.append("status = ?")
            params.append(status)
        if company:
            where_clauses.append("company LIKE ?")
            params.append(f"%{company}%")
        if search:
            where_clauses.append("(name LIKE ? OR company LIKE ? OR email LIKE ? OR title LIKE ?)")
            params.extend([f"%{search}%"] * 4)

        where_sql = f" WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        total = conn.execute(f"SELECT COUNT(*) FROM prospects{where_sql}", params).fetchone()[0]
        rows = conn.execute(
            f"SELECT * FROM prospects{where_sql} ORDER BY created_at DESC LIMIT ? OFFSET ?",
            params + [limit, offset]
        ).fetchall()

        return {
            "total": total,
            "count": len(rows),
            "offset": offset,
            "prospects": [self._row_to_dict(r) for r in rows],
            "has_more": total > offset + len(rows),
        }

    def update_prospect(self, prospect_id: str, **kwargs) -> Optional[dict]:
        conn = self._get_conn()
        existing = self.get_prospect(prospect_id)
        if not existing:
            return None

        if "custom_fields" in kwargs and kwargs["custom_fields"] is not None:
            merged = {**existing.get("custom_fields", {}), **kwargs["custom_fields"]}
            kwargs["custom_fields"] = json.dumps(merged)

        updates = {k: v for k, v in kwargs.items() if v is not None}
        if not updates:
            return existing

        updates["updated_at"] = self._now()
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(
            f"UPDATE prospects SET {set_clause} WHERE id = ?",
            list(updates.values()) + [prospect_id]
        )
        conn.commit()
        return self.get_prospect(prospect_id)

    def delete_prospect(self, prospect_id: str) -> bool:
        conn = self._get_conn()
        cursor = conn.execute("DELETE FROM prospects WHERE id = ?", (prospect_id,))
        conn.commit()
        return cursor.rowcount > 0

    def prospect_exists_by_field(self, field: str, value: str) -> bool:
        conn = self._get_conn()
        if field not in ("email", "phone", "name"):
            return False
        row = conn.execute(f"SELECT 1 FROM prospects WHERE {field} = ?", (value,)).fetchone()
        return row is not None

    def find_prospect_by_email(self, email: str) -> Optional[dict]:
        """Find a prospect by email address."""
        conn = self._get_conn()
        row = conn.execute("SELECT * FROM prospects WHERE email = ?", (email,)).fetchone()
        return self._row_to_dict(row) if row else None

    def find_prospect_by_name_company(self, name: str, company: str) -> Optional[dict]:
        """Find a prospect by name + company combination."""
        conn = self._get_conn()
        row = conn.execute(
            "SELECT * FROM prospects WHERE name = ? AND company = ?",
            (name, company)
        ).fetchone()
        return self._row_to_dict(row) if row else None

    # ── Cadences ───────────────────────────────────────────────────────

    def create_cadence(self, name: str, steps: list[dict]) -> dict:
        conn = self._get_conn()
        cid = self._new_id()
        now = self._now()
        conn.execute(
            "INSERT INTO cadences (id, name, steps, active, created_at) VALUES (?, ?, ?, 1, ?)",
            (cid, name, json.dumps(steps), now)
        )
        conn.commit()
        return self.get_cadence(cid)

    def get_cadence(self, cadence_id: str) -> Optional[dict]:
        conn = self._get_conn()
        row = conn.execute("SELECT * FROM cadences WHERE id = ?", (cadence_id,)).fetchone()
        return self._row_to_dict(row) if row else None

    def list_cadences(self, active_only: bool = False) -> list[dict]:
        conn = self._get_conn()
        sql = "SELECT * FROM cadences"
        if active_only:
            sql += " WHERE active = 1"
        sql += " ORDER BY created_at DESC"
        return [self._row_to_dict(r) for r in conn.execute(sql).fetchall()]

    def update_cadence(self, cadence_id: str, **kwargs) -> Optional[dict]:
        conn = self._get_conn()
        existing = self.get_cadence(cadence_id)
        if not existing:
            return None

        if "steps" in kwargs and kwargs["steps"] is not None:
            kwargs["steps"] = json.dumps(kwargs["steps"])
        if "active" in kwargs and kwargs["active"] is not None:
            kwargs["active"] = 1 if kwargs["active"] else 0

        updates = {k: v for k, v in kwargs.items() if v is not None}
        if not updates:
            return existing

        set_clause = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(
            f"UPDATE cadences SET {set_clause} WHERE id = ?",
            list(updates.values()) + [cadence_id]
        )
        conn.commit()
        return self.get_cadence(cadence_id)

    def delete_cadence(self, cadence_id: str) -> bool:
        conn = self._get_conn()
        cursor = conn.execute("DELETE FROM cadences WHERE id = ?", (cadence_id,))
        conn.commit()
        return cursor.rowcount > 0

    # ── Enrollments ────────────────────────────────────────────────────

    def create_enrollment(self, prospect_id: str, cadence_id: str) -> dict:
        conn = self._get_conn()
        eid = self._new_id()
        now = self._now()
        cadence = self.get_cadence(cadence_id)
        steps = cadence["steps"] if cadence else []
        first_delay = steps[0]["delay_days"] if steps else 0
        next_action = (datetime.now(timezone.utc) + timedelta(days=first_delay)).isoformat()

        conn.execute(
            "INSERT INTO cadence_enrollments (id, prospect_id, cadence_id, current_step, status, next_action_at, enrolled_at) "
            "VALUES (?, ?, ?, 0, 'active', ?, ?)",
            (eid, prospect_id, cadence_id, next_action, now)
        )
        conn.commit()
        return self.get_enrollment(eid)

    def get_enrollment(self, enrollment_id: str) -> Optional[dict]:
        conn = self._get_conn()
        row = conn.execute("SELECT * FROM cadence_enrollments WHERE id = ?", (enrollment_id,)).fetchone()
        return dict(row) if row else None

    def list_enrollments(self, cadence_id: Optional[str] = None, prospect_id: Optional[str] = None,
                         status: Optional[str] = None, limit: int = 20, offset: int = 0) -> dict:
        conn = self._get_conn()
        where_clauses, params = [], []

        if cadence_id:
            where_clauses.append("ce.cadence_id = ?")
            params.append(cadence_id)
        if prospect_id:
            where_clauses.append("ce.prospect_id = ?")
            params.append(prospect_id)
        if status:
            where_clauses.append("ce.status = ?")
            params.append(status)

        where_sql = f" WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        total = conn.execute(
            f"SELECT COUNT(*) FROM cadence_enrollments ce{where_sql}", params
        ).fetchone()[0]

        rows = conn.execute(
            f"SELECT ce.*, p.name as prospect_name, p.company as prospect_company, c.name as cadence_name "
            f"FROM cadence_enrollments ce "
            f"JOIN prospects p ON ce.prospect_id = p.id "
            f"JOIN cadences c ON ce.cadence_id = c.id"
            f"{where_sql} ORDER BY ce.enrolled_at DESC LIMIT ? OFFSET ?",
            params + [limit, offset]
        ).fetchall()

        return {
            "total": total,
            "count": len(rows),
            "offset": offset,
            "enrollments": [dict(r) for r in rows],
            "has_more": total > offset + len(rows),
        }

    def get_pending_enrollments(self, cadence_id: Optional[str] = None, limit: int = 50) -> list[dict]:
        conn = self._get_conn()
        now = self._now()
        params: list[Any] = [now]
        sql = (
            "SELECT ce.*, p.name, p.company, p.phone, p.email, p.title, p.custom_fields, "
            "c.name as cadence_name, c.steps as cadence_steps "
            "FROM cadence_enrollments ce "
            "JOIN prospects p ON ce.prospect_id = p.id "
            "JOIN cadences c ON ce.cadence_id = c.id "
            "WHERE ce.status = 'active' AND ce.next_action_at <= ?"
        )
        if cadence_id:
            sql += " AND ce.cadence_id = ?"
            params.append(cadence_id)
        sql += " ORDER BY ce.next_action_at ASC LIMIT ?"
        params.append(limit)

        rows = conn.execute(sql, params).fetchall()
        results = []
        for r in rows:
            d = dict(r)
            for key in ("custom_fields", "cadence_steps"):
                if key in d and isinstance(d[key], str):
                    try:
                        d[key] = json.loads(d[key])
                    except (json.JSONDecodeError, TypeError):
                        pass
            results.append(d)
        return results

    def advance_enrollment(self, enrollment_id: str, next_delay_days: Optional[int] = None) -> None:
        conn = self._get_conn()
        enrollment = self.get_enrollment(enrollment_id)
        if not enrollment:
            return

        new_step = enrollment["current_step"] + 1
        cadence = self.get_cadence(enrollment["cadence_id"])
        steps = cadence["steps"] if cadence else []

        if new_step >= len(steps):
            conn.execute(
                "UPDATE cadence_enrollments SET current_step = ?, status = 'completed', next_action_at = NULL WHERE id = ?",
                (new_step, enrollment_id)
            )
        else:
            delay = next_delay_days if next_delay_days is not None else steps[new_step]["delay_days"]
            next_action = (datetime.now(timezone.utc) + timedelta(days=delay)).isoformat()
            conn.execute(
                "UPDATE cadence_enrollments SET current_step = ?, next_action_at = ? WHERE id = ?",
                (new_step, next_action, enrollment_id)
            )
        conn.commit()

    def update_enrollment_status(self, enrollment_id: str, status: str) -> bool:
        conn = self._get_conn()
        cursor = conn.execute(
            "UPDATE cadence_enrollments SET status = ? WHERE id = ?",
            (status, enrollment_id)
        )
        conn.commit()
        return cursor.rowcount > 0

    # ── Activity Log ───────────────────────────────────────────────────

    def log_activity(self, prospect_id: str, channel: str, action: str, details: Optional[dict] = None) -> dict:
        conn = self._get_conn()
        aid = self._new_id()
        now = self._now()
        conn.execute(
            "INSERT INTO activity_log (id, prospect_id, channel, action, details, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (aid, prospect_id, channel, action, json.dumps(details or {}), now)
        )
        conn.commit()
        return {"id": aid, "prospect_id": prospect_id, "channel": channel, "action": action, "created_at": now}

    def get_activity_log(self, prospect_id: Optional[str] = None, channel: Optional[str] = None,
                         limit: int = 20, offset: int = 0) -> dict:
        conn = self._get_conn()
        where_clauses, params = [], []

        if prospect_id:
            where_clauses.append("al.prospect_id = ?")
            params.append(prospect_id)
        if channel:
            where_clauses.append("al.channel = ?")
            params.append(channel)

        where_sql = f" WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        total = conn.execute(f"SELECT COUNT(*) FROM activity_log al{where_sql}", params).fetchone()[0]
        rows = conn.execute(
            f"SELECT al.*, p.name as prospect_name, p.company as prospect_company "
            f"FROM activity_log al JOIN prospects p ON al.prospect_id = p.id"
            f"{where_sql} ORDER BY al.created_at DESC LIMIT ? OFFSET ?",
            params + [limit, offset]
        ).fetchall()

        results = []
        for r in rows:
            d = dict(r)
            if "details" in d and isinstance(d["details"], str):
                try:
                    d["details"] = json.loads(d["details"])
                except (json.JSONDecodeError, TypeError):
                    pass
            results.append(d)

        return {
            "total": total,
            "count": len(results),
            "offset": offset,
            "activities": results,
            "has_more": total > offset + len(results),
        }

    def get_cadence_stats(self, cadence_id: str) -> dict:
        conn = self._get_conn()
        cadence = self.get_cadence(cadence_id)
        if not cadence:
            return {}

        stats = {"cadence_name": cadence["name"], "cadence_id": cadence_id}

        rows = conn.execute(
            "SELECT status, COUNT(*) as cnt FROM cadence_enrollments WHERE cadence_id = ? GROUP BY status",
            (cadence_id,)
        ).fetchall()
        status_counts = {r["status"]: r["cnt"] for r in rows}
        stats["total_enrolled"] = sum(status_counts.values())
        stats["status_breakdown"] = status_counts

        rows = conn.execute(
            "SELECT al.channel, COUNT(*) as cnt FROM activity_log al "
            "JOIN cadence_enrollments ce ON al.prospect_id = ce.prospect_id "
            "WHERE ce.cadence_id = ? GROUP BY al.channel",
            (cadence_id,)
        ).fetchall()
        stats["activities_by_channel"] = {r["channel"]: r["cnt"] for r in rows}

        replied = status_counts.get("replied", 0)
        total = stats["total_enrolled"]
        stats["reply_rate"] = f"{(replied / total * 100):.1f}%" if total > 0 else "0%"

        return stats
