#!/usr/bin/env python3
# =============================================================
# TS class — CBT 결과 공유 저장소 API
#  - 표준 라이브러리만 사용(http.server + sqlite3) → 추가 설치 0
#  - 모든 사용자의 CBT 응시 결과를 한 곳(sqlite)에 모아 관리자 통합 조회 제공
#  - 프론트(app.js의 cbtDb 파사드)가 /tsclass/api/results 로 호출 (Nginx 프록시)
#
# 엔드포인트 (Nginx가 /tsclass/api/ → 백엔드 / 로 프록시):
#   GET    /results          전체 결과(최신순) JSON 배열
#   POST   /results          결과 1건 저장(본문 JSON, ID 기준 upsert)
#   DELETE /results?id=<ID>  1건 삭제
#   DELETE /results          전체 초기화
#   GET    /  (또는 /health) 헬스체크
#
# 환경변수: CBT_DB_PATH(기본 ./cbt_data.db), HOST(127.0.0.1), PORT(8090)
# =============================================================
import json
import os
import sqlite3
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

DB_PATH = os.environ.get(
    "CBT_DB_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "cbt_data.db"),
)
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8090"))

_write_lock = threading.Lock()  # sqlite 쓰기 직렬화(동시 제출 시 'database is locked' 방지)


def _connect():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = _connect()
    try:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS TB_CBT_RESULT (
                ID               TEXT PRIMARY KEY,
                CANDIDATE_NAME   TEXT,
                EXAM_NAME        TEXT,
                SCORE            INTEGER,
                PASS_OR_FAIL     TEXT,
                DURATION_SECONDS INTEGER,
                SUBMITTED_AT     TEXT,
                MARKED_ANSWERS   TEXT
            )"""
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS IX_CBT_SUBMITTED_AT ON TB_CBT_RESULT(SUBMITTED_AT)"
        )
        conn.commit()
    finally:
        conn.close()


def fetch_all():
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT * FROM TB_CBT_RESULT ORDER BY SUBMITTED_AT DESC"
        ).fetchall()
    finally:
        conn.close()
    out = []
    for r in rows:
        d = dict(r)
        try:
            d["MARKED_ANSWERS"] = json.loads(d.get("MARKED_ANSWERS") or "[]")
        except Exception:
            d["MARKED_ANSWERS"] = []
        out.append(d)
    return out


def upsert(rec):
    marked = rec.get("MARKED_ANSWERS")
    marked_str = json.dumps(marked, ensure_ascii=False) if marked is not None else "[]"
    with _write_lock:
        conn = _connect()
        try:
            conn.execute(
                """INSERT OR REPLACE INTO TB_CBT_RESULT
                   (ID, CANDIDATE_NAME, EXAM_NAME, SCORE, PASS_OR_FAIL,
                    DURATION_SECONDS, SUBMITTED_AT, MARKED_ANSWERS)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    rec.get("ID"),
                    rec.get("CANDIDATE_NAME"),
                    rec.get("EXAM_NAME"),
                    rec.get("SCORE"),
                    rec.get("PASS_OR_FAIL"),
                    rec.get("DURATION_SECONDS"),
                    rec.get("SUBMITTED_AT"),
                    marked_str,
                ),
            )
            conn.commit()
        finally:
            conn.close()


def delete(rid=None):
    with _write_lock:
        conn = _connect()
        try:
            if rid:
                conn.execute("DELETE FROM TB_CBT_RESULT WHERE ID = ?", (rid,))
            else:
                conn.execute("DELETE FROM TB_CBT_RESULT")
            conn.commit()
        finally:
            conn.close()


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj=None):
        body = b"" if obj is None else json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        if body:
            self.wfile.write(body)

    @staticmethod
    def _path(p):
        return urlparse(p).path.rstrip("/")

    def do_OPTIONS(self):
        self._send(204)

    def do_GET(self):
        path = self._path(self.path)
        if path in ("", "/health"):
            return self._send(200, {"ok": True, "service": "cbt-api", "db": DB_PATH})
        if path == "/results":
            try:
                return self._send(200, fetch_all())
            except Exception as e:
                return self._send(500, {"error": str(e)})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        if self._path(self.path) != "/results":
            return self._send(404, {"error": "not found"})
        try:
            length = int(self.headers.get("Content-Length", 0) or 0)
            rec = json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            return self._send(400, {"error": "invalid json"})
        if not isinstance(rec, dict) or not rec.get("ID"):
            return self._send(400, {"error": "ID required"})
        try:
            upsert(rec)
            return self._send(200, {"ok": True, "id": rec.get("ID")})
        except Exception as e:
            return self._send(500, {"error": str(e)})

    def do_DELETE(self):
        if self._path(self.path) != "/results":
            return self._send(404, {"error": "not found"})
        rid = (parse_qs(urlparse(self.path).query).get("id") or [None])[0]
        try:
            delete(rid)
            return self._send(200, {"ok": True})
        except Exception as e:
            return self._send(500, {"error": str(e)})

    def log_message(self, *args):
        pass  # 접속 로그는 Nginx가 남김 → 백엔드는 조용히


def main():
    init_db()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"[cbt-api] listening on http://{HOST}:{PORT}  (DB: {DB_PATH})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()


if __name__ == "__main__":
    main()
