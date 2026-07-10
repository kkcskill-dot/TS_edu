#!/usr/bin/env python3
# =============================================================
# TSCLUB (소모임관리) API
#  - 표준 라이브러리만 사용(http.server + sqlite3)
#  - Nginx 프록시(/tsclub/api/ -> 백엔드 /)
# =============================================================
import json
import os
import sqlite3
import threading
import uuid
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
import re

DB_PATH = os.environ.get(
    "TSCLUB_DB_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "tsclub_data.db"),
)
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8092"))

_write_lock = threading.Lock()

def _connect():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = _connect()
    try:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS groups (
                id TEXT PRIMARY KEY,
                title TEXT,
                description TEXT,
                participants_count INTEGER,
                creator_name TEXT,
                created_at TEXT
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS notices (
                id TEXT PRIMARY KEY,
                group_id TEXT,
                session_no INTEGER,
                date_info TEXT,
                location TEXT,
                content TEXT,
                created_at TEXT
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS polls (
                id TEXT PRIMARY KEY,
                group_id TEXT,
                title TEXT,
                options TEXT,
                created_at TEXT
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS votes (
                id TEXT PRIMARY KEY,
                poll_id TEXT,
                voter_name TEXT,
                selected_dates TEXT,
                created_at TEXT
            )"""
        )
        
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(polls)")
        columns = [col['name'] for col in cursor.fetchall()]
        if 'is_closed' not in columns:
            conn.execute("ALTER TABLE polls ADD COLUMN is_closed INTEGER DEFAULT 0")
            
        conn.commit()
    finally:
        conn.close()

def mask_name(name):
    """이름 마스킹 (예: 홍길동 -> 홍*동, 김씨 -> 김*, 선우용녀 -> 선**녀)"""
    name = name.strip()
    if len(name) <= 1:
        return name
    elif len(name) == 2:
        return name[0] + "*"
    else:
        return name[0] + "*" * (len(name) - 2) + name[-1]

ADMIN_PASSWORD = "qhdkscjfwj!!"

class TSClubRequestHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def _respond_json(self, status_code, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def check_auth(self):
        auth_header = self.headers.get("Authorization", "")
        if auth_header != f"Bearer {ADMIN_PASSWORD}":
            self._respond_json(401, {"error": "Unauthorized"})
            return False
        return True

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        if path == "/health":
            return self._respond_json(200, {"ok": True, "service": "tsclub-api"})

        if path == "/auth":
            if self.check_auth():
                return self._respond_json(200, {"ok": True})
            return

        if path == "/groups":
            conn = _connect()
            try:
                cur = conn.execute("SELECT * FROM groups ORDER BY created_at DESC")
                rows = [dict(r) for r in cur.fetchall()]
                return self._respond_json(200, {"ok": True, "data": rows})
            finally:
                conn.close()

        # /groups/{id}/notices
        match = re.match(r'^/groups/([^/]+)/notices$', path)
        if match:
            group_id = match.group(1)
            conn = _connect()
            try:
                cur = conn.execute("SELECT * FROM notices WHERE group_id=? ORDER BY session_no DESC, created_at DESC", (group_id,))
                rows = [dict(r) for r in cur.fetchall()]
                return self._respond_json(200, {"ok": True, "data": rows})
            finally:
                conn.close()

        # /groups/{id}/polls
        match = re.match(r'^/groups/([^/]+)/polls$', path)
        if match:
            group_id = match.group(1)
            conn = _connect()
            try:
                cur = conn.execute("SELECT * FROM polls WHERE group_id=? ORDER BY created_at DESC", (group_id,))
                polls = [dict(r) for r in cur.fetchall()]
                for p in polls:
                    cur = conn.execute("SELECT * FROM votes WHERE poll_id=? ORDER BY created_at ASC", (p["id"],))
                    p["votes"] = [dict(r) for r in cur.fetchall()]
                    # Parse options back to list for frontend
                    try:
                        p["options"] = json.loads(p["options"])
                    except:
                        p["options"] = []
                return self._respond_json(200, {"ok": True, "data": polls})
            finally:
                conn.close()

        self._respond_json(404, {"error": "Not Found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            return self._respond_json(400, {"error": "Empty body"})
        
        body = self.rfile.read(content_length)
        try:
            data = json.loads(body.decode("utf-8"))
        except:
            return self._respond_json(400, {"error": "Invalid JSON"})

        if path == "/groups":
            if not self.check_auth(): return
            title = data.get("title", "").strip()
            desc = data.get("description", "").strip()
            p_count = data.get("participants_count", 0)
            creator = data.get("creator_name", "").strip()
            
            if not title or not creator:
                return self._respond_json(400, {"error": "Title and Creator Name are required"})
            
            masked_creator = mask_name(creator)
            new_id = str(uuid.uuid4())
            now = datetime.now().isoformat()
            
            with _write_lock:
                conn = _connect()
                try:
                    conn.execute(
                        "INSERT INTO groups (id, title, description, participants_count, creator_name, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                        (new_id, title, desc, p_count, masked_creator, now)
                    )
                    conn.commit()
                finally:
                    conn.close()
            return self._respond_json(201, {"ok": True, "id": new_id})

        match = re.match(r'^/groups/([^/]+)/notices$', path)
        if match:
            if not self.check_auth(): return
            group_id = match.group(1)
            session_no = data.get("session_no", 1)
            date_info = data.get("date_info", "").strip()
            location = data.get("location", "").strip()
            content = data.get("content", "").strip()
            
            new_id = str(uuid.uuid4())
            now = datetime.now().isoformat()
            
            with _write_lock:
                conn = _connect()
                try:
                    conn.execute(
                        "INSERT INTO notices (id, group_id, session_no, date_info, location, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (new_id, group_id, session_no, date_info, location, content, now)
                    )
                    conn.commit()
                finally:
                    conn.close()
            return self._respond_json(201, {"ok": True, "id": new_id})

        match = re.match(r'^/groups/([^/]+)/polls$', path)
        if match:
            if not self.check_auth(): return
            group_id = match.group(1)
            title = data.get("title", "").strip()
            options = data.get("options", []) # list of strings
            
            if not title or not options:
                return self._respond_json(400, {"error": "Title and options are required"})
                
            new_id = str(uuid.uuid4())
            now = datetime.now().isoformat()
            
            with _write_lock:
                conn = _connect()
                try:
                    conn.execute(
                        "INSERT INTO polls (id, group_id, title, options, created_at) VALUES (?, ?, ?, ?, ?)",
                        (new_id, group_id, title, json.dumps(options, ensure_ascii=False), now)
                    )
                    conn.commit()
                finally:
                    conn.close()
            return self._respond_json(201, {"ok": True, "id": new_id})

        match = re.match(r'^/polls/([^/]+)/close$', path)
        if match:
            if not self.check_auth(): return
            poll_id = match.group(1)
            with _write_lock:
                conn = _connect()
                try:
                    conn.execute("UPDATE polls SET is_closed=1 WHERE id=?", (poll_id,))
                    conn.commit()
                finally:
                    conn.close()
            return self._respond_json(200, {"ok": True})

        match = re.match(r'^/polls/([^/]+)/vote$', path)
        if match:
            poll_id = match.group(1)
            voter = data.get("voter_name", "").strip()
            selected_dates = data.get("selected_dates", []) # list of strings
            
            if not voter or not selected_dates:
                return self._respond_json(400, {"error": "Voter name and selected dates are required"})
                
            masked_voter = mask_name(voter)
            new_id = str(uuid.uuid4())
            now = datetime.now().isoformat()
            
            with _write_lock:
                conn = _connect()
                try:
                    cur = conn.execute("SELECT is_closed FROM polls WHERE id=?", (poll_id,))
                    poll_row = cur.fetchone()
                    if not poll_row or poll_row["is_closed"] == 1:
                        return self._respond_json(400, {"error": "종료된 투표입니다."})
                        
                    cur = conn.execute("SELECT id FROM votes WHERE poll_id=? AND voter_name=?", (poll_id, masked_voter))
                    if cur.fetchone():
                        return self._respond_json(400, {"error": "이미 투표에 참여하셨습니다."})
                        
                    conn.execute(
                        "INSERT INTO votes (id, poll_id, voter_name, selected_dates, created_at) VALUES (?, ?, ?, ?, ?)",
                        (new_id, poll_id, masked_voter, json.dumps(selected_dates, ensure_ascii=False), now)
                    )
                    conn.commit()
                finally:
                    conn.close()
            return self._respond_json(201, {"ok": True, "id": new_id})

        self._respond_json(404, {"error": "Not Found"})

if __name__ == "__main__":
    init_db()
    server = ThreadingHTTPServer((HOST, PORT), TSClubRequestHandler)
    print(f"[*] Starting TSClub API server on {HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("[-] Stopping server...")
        server.server_close()
