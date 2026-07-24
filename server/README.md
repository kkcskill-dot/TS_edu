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

## 관리자 인증 (ADMIN_PW_SHA256)
- 관리자 API(**결과 열람 `GET /results`, 삭제 `DELETE /results`**)는 관리자 비밀번호가 필요합니다.
  응시자 **결과 제출 `POST /results`** 은 인증 없이 열려 있습니다.
- 비밀번호 **원문은 코드/설정 어디에도 두지 않습니다.** systemd 유닛의 환경변수로 **SHA-256 해시만** 주입합니다.
  ```ini
  Environment=ADMIN_PW_SHA256=<sha256 hex>
  ```
- 해시 생성:
  ```bash
  python3 -c "import hashlib;print(hashlib.sha256(b'새비밀번호'.encode()).hexdigest())"
  ```
- 클라이언트(`app.js`)는 관리자 모달 입력값을 `Authorization: Bearer <비밀번호>`로 보내고,
  서버가 SHA-256으로 해시해 상수시간(`hmac.compare_digest`) 비교합니다. 검증이 성공한 토큰만 이후 열람/삭제에 재사용합니다.
- `ADMIN_PW_SHA256` 가 비어 있으면 관리자 API는 **항상 401**(안전 기본값)입니다.
- ⚠️ 기존 비밀번호는 이미 소스/git 이력에 평문 노출된 적이 있으므로 **배포 시 새 비밀번호로 교체**하세요.
  세 백엔드(cbt/tsclub/tssurvey)가 같은 해시를 공유하므로, 교체 시 세 유닛의 `ADMIN_PW_SHA256`을 함께 갱신합니다.

## 보안 메모
- 토큰 게이트(`techsvc`)는 **클라이언트 측 소프트 게이트**라 사이트 접근 자체를 완벽히 막지는 않습니다.
  단, 위 관리자 인증은 **서버 측**에서 강제되므로 소스 열람만으로 우회할 수 없습니다.
- 더 엄격히 하려면 Nginx에서 `/tsclass/api/` 에 **IP 허용목록**(`allow`/`deny`)을 추가로 거는 것을 권장합니다.
- 운영 로그: 접속/호출 기록은 기존처럼 Nginx access_log 에 남습니다.

## 백업
`/var/lib/tsclass/cbt.db` 파일 하나만 백업하면 전체 응시 이력이 보존됩니다.
```bash
sudo cp /var/lib/tsclass/cbt.db /var/lib/tsclass/cbt.db.$(date +%F).bak
```
