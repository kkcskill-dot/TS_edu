# CBT 결과 공유 저장소 (백엔드 API)

CBT 응시 결과를 **모든 사용자 공유 저장소(sqlite)** 에 모아, 관리자 대시보드에서 **다른 사용자가 푼 기록까지** 보게 해주는 백엔드입니다.

- `cbt_api.py` — Python 표준 라이브러리(`http.server`+`sqlite3`)만 사용. **추가 설치 0.**
- 프론트(`app.js`의 `cbtDb` 파사드)가 `/tsclass/api/results` 로 호출 → Nginx가 백엔드(`127.0.0.1:8090`)로 프록시.
- IndexedDB(`H2_Embedded_CBT`)는 **오프라인 폴백**으로 유지(서버 불통 시 본인 기록만 표시).

> ⚠️ **왜 서버가 필요한가**: 기존 IndexedDB는 브라우저마다 따로라 "다른 사용자 기록"을 구조상 볼 수 없습니다. 공유 조회는 서버 저장소가 필수입니다.

## 데이터
테이블 `TB_CBT_RESULT` (sqlite, 기본 경로 `/var/lib/tsclass/cbt.db` — **웹 루트 밖**이라 외부에서 직접 다운로드 불가)

| 컬럼 | 설명 |
|---|---|
| `ID` (PK) | `cbt_<timestamp>` |
| `CANDIDATE_NAME` | 응시자 이름(시험 입력값으로 사용자 구분) |
| `EXAM_NAME` | 과목명 |
| `SCORE` | 점수(0~100) |
| `PASS_OR_FAIL` | PASS / FAIL |
| `DURATION_SECONDS` | 소요 시간(초) |
| `SUBMITTED_AT` | ISO 제출 시각 |
| `MARKED_ANSWERS` | 마킹 답안(JSON) |

## API
Nginx가 `/tsclass/api/` → 백엔드 `/` 로 프록시하므로 백엔드 경로는 `/results`.

| 메서드 | 경로 | 동작 |
|---|---|---|
| `GET` | `/results` | 전체 결과(최신순) |
| `POST` | `/results` | 결과 1건 저장(ID 기준 upsert) |
| `DELETE` | `/results?id=<ID>` | 1건 삭제 |
| `DELETE` | `/results` | 전체 초기화 |
| `GET` | `/health` | 헬스체크 |

## 배포 (kkcsvr, Amazon Linux)

```bash
# 1) 백엔드 스크립트를 웹 루트 밖에 배치
sudo mkdir -p /opt/tsclass
sudo cp /var/www/html/TS_edu/server/cbt_api.py /opt/tsclass/

# 2) systemd 서비스 등록 (DB는 /var/lib/tsclass/cbt.db 에 생성됨)
sudo cp /var/www/html/TS_edu/server/tsclass-cbt-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tsclass-cbt-api

# 3) 동작 확인
curl -s http://127.0.0.1:8090/health     # {"ok": true, ...}
curl -s http://127.0.0.1:8090/results     # []
```

### Nginx 프록시 추가
`/tsclass` 가 정의된 server 블록(`/etc/nginx/conf.d/diagnostics.conf`)에 추가:

```nginx
# CBT 결과 API → 같은 오리진(/tsclass/api/)에서 백엔드로 프록시
location /tsclass/api/ {
    proxy_pass http://127.0.0.1:8090/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

> 스크립트를 웹 루트(`/var/www/html/TS_edu/server/`)에 그대로 두고 싶다면, 소스가 그대로 노출되지 않게 함께 추가:
> `location ^~ /tsclass/server/ { return 404; }`

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 확인
1. 사이트 접속 → CBT 시험 응시·제출
2. 관리자 대시보드(CBT 관리자) → 방금 결과가 보임
3. **다른 PC/브라우저**에서 다른 이름으로 응시 → 같은 관리자 대시보드에 **모두** 누적되면 성공

## 보안 메모
- 토큰 게이트(`techsvc`)는 **클라이언트 측 소프트 게이트**라 API 자체를 막지 않습니다. API는 사이트에 접근 가능한 사람이면 호출할 수 있습니다.
- 내부망 전용이면 충분하지만, 더 엄격히 하려면 Nginx에서 `/tsclass/api/` 에 **IP 허용목록**(`allow`/`deny`)을 거는 것을 권장합니다. (특히 `DELETE` 전체 초기화)
- 운영 로그: 접속/호출 기록은 기존처럼 Nginx access_log 에 남습니다.

## 백업
`/var/lib/tsclass/cbt.db` 파일 하나만 백업하면 전체 응시 이력이 보존됩니다.
```bash
sudo cp /var/lib/tsclass/cbt.db /var/lib/tsclass/cbt.db.$(date +%F).bak
```
