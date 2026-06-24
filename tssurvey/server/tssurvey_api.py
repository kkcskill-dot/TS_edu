#!/usr/bin/env python3
# =============================================================
# SPHAROS 설문 (tssurvey) 결과 공유 저장소 API
#  - 표준 라이브러리만 사용(http.server + sqlite3)
#  - Nginx 프록시(/tssurvey/api/ -> 백엔드 /)
#
# 엔드포인트:
#   GET    /topics             전체 주제 목록 (각 주제별 통계 포함)
#   POST   /topics             주제 생성 {"title": "..."}
#   GET    /responses?topic_id=...  특정 주제의 설문 응답 목록
#   POST   /responses          응답 제출 {"topic_id": "...", "star_rating": 4, "comment": "..."}
#   GET    /health             헬스체크
# =============================================================
import json
import os
import sqlite3
import threading
import uuid
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

DB_PATH = os.environ.get(
    "TSSURVEY_DB_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "tssurvey_data.db"),
)
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8091"))

_write_lock = threading.Lock()

def _connect():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = _connect()
    try:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS TB_TOPIC (
                ID TEXT PRIMARY KEY,
                TITLE TEXT,
                CREATED_AT TEXT,
                IS_ACTIVE INTEGER DEFAULT 1
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS TB_SURVEY_RESPONSE (
                ID TEXT PRIMARY KEY,
                TOPIC_ID TEXT,
                STAR_RATING INTEGER,
                COMMENT TEXT,
                SUBMITTED_AT TEXT
            )"""
        )
        conn.commit()
    finally:
        conn.close()

class TSSurveyRequestHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _respond_json(self, status_code, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        if path == "/health" or path == "/":
            return self._respond_json(200, {"ok": True, "service": "tssurvey-api"})

        if path == "/topics":
            conn = _connect()
            try:
                # LEFT JOIN으로 응답 수와 평균 별점 계산
                cur = conn.execute('''
                    SELECT 
                        t.ID, t.TITLE, t.CREATED_AT, t.IS_ACTIVE,
                        COUNT(r.ID) as RESPONSE_COUNT,
                        AVG(r.STAR_RATING) as AVG_RATING
                    FROM TB_TOPIC t
                    LEFT JOIN TB_SURVEY_RESPONSE r ON t.ID = r.TOPIC_ID
                    GROUP BY t.ID
                    ORDER BY t.CREATED_AT DESC
                ''')
                rows = [dict(r) for r in cur.fetchall()]
                # AVG_RATING 이 None 이면 0.0 으로 변환, 아니면 반올림
                for row in rows:
                    row['AVG_RATING'] = round(row['AVG_RATING'], 1) if row['AVG_RATING'] else 0.0
                return self._respond_json(200, rows)
            except Exception as e:
                return self._respond_json(500, {"error": str(e)})
            finally:
                conn.close()

        if path == "/responses":
            topic_id = qs.get("topic_id", [None])[0]
            if not topic_id:
                return self._respond_json(400, {"error": "topic_id is required"})
            
            conn = _connect()
            try:
                cur = conn.execute(
                    "SELECT ID, TOPIC_ID, STAR_RATING, COMMENT, SUBMITTED_AT FROM TB_SURVEY_RESPONSE WHERE TOPIC_ID = ? ORDER BY SUBMITTED_AT DESC",
                    (topic_id,)
                )
                rows = [dict(r) for r in cur.fetchall()]
                return self._respond_json(200, rows)
            except Exception as e:
                return self._respond_json(500, {"error": str(e)})
            finally:
                conn.close()
        
        return self._respond_json(404, {"error": "Not Found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path not in ["/topics", "/responses"]:
            return self._respond_json(404, {"error": "Not Found"})

        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            return self._respond_json(400, {"error": "Empty body"})

        raw_body = self.rfile.read(content_length).decode("utf-8")
        try:
            data = json.loads(raw_body)
        except Exception:
            return self._respond_json(400, {"error": "Invalid JSON"})

        if path == "/topics":
            title = data.get("title")
            if not title:
                return self._respond_json(400, {"error": "title is required"})
            
            topic_id = f"topic_{uuid.uuid4().hex[:8]}"
            created_at = datetime.now().isoformat()
            
            with _write_lock:
                conn = _connect()
                try:
                    conn.execute(
                        "INSERT INTO TB_TOPIC (ID, TITLE, CREATED_AT, IS_ACTIVE) VALUES (?, ?, ?, 1)",
                        (topic_id, title, created_at)
                    )
                    conn.commit()
                    return self._respond_json(200, {"id": topic_id, "title": title, "created_at": created_at})
                except Exception as e:
                    return self._respond_json(500, {"error": str(e)})
                finally:
                    conn.close()

        if path == "/responses":
            topic_id = data.get("topic_id")
            star_rating = data.get("star_rating")
            comment = data.get("comment", "")
            
            if not topic_id or not star_rating:
                return self._respond_json(400, {"error": "topic_id and star_rating are required"})
            
            try:
                star_rating = int(star_rating)
                if star_rating < 1 or star_rating > 5:
                    raise ValueError("star_rating must be between 1 and 5")
            except ValueError as e:
                return self._respond_json(400, {"error": str(e)})
                
            # Limit comment to 400 chars just to be safe, but DB will store whatever.
            comment = comment[:400]
            
            response_id = f"resp_{uuid.uuid4().hex[:12]}"
            submitted_at = datetime.now().isoformat()
            
            with _write_lock:
                conn = _connect()
                try:
                    conn.execute(
                        "INSERT INTO TB_SURVEY_RESPONSE (ID, TOPIC_ID, STAR_RATING, COMMENT, SUBMITTED_AT) VALUES (?, ?, ?, ?, ?)",
                        (response_id, topic_id, star_rating, comment, submitted_at)
                    )
                    conn.commit()
                    return self._respond_json(200, {"id": response_id, "submitted_at": submitted_at})
                except Exception as e:
                    return self._respond_json(500, {"error": str(e)})
                finally:
                    conn.close()

if __name__ == "__main__":
    init_db()
    server = ThreadingHTTPServer((HOST, PORT), TSSurveyRequestHandler)
    print(f"[TSSURVEY API] Server started on http://{HOST}:{PORT}")
    print(f"DB Path: {DB_PATH}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[TSSURVEY API] Stopping server...")
        server.server_close()
