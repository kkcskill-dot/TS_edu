# 개발 지침 및 주의사항 (Instructions & Rules)

여기에 프로젝트 작업 시 반드시 지켜야 할 사용자 지침 및 서버 환경 정보를 기록합니다.

## 🚨 최우선 규칙
1. **브라우저 도구 사용 금지**: 에이전트(Antigravity)는 직접 브라우저(`browser_subagent`)를 켜서 테스트하는 동작을 절대로 수행하지 않습니다. UI 검증이나 기능 확인은 사용자 피드백이나 수동 테스트 안내를 통해서 진행합니다.

## 🎓 교육 아카데미 구조 (다중 과정)
- 이 사이트는 **2-트랙 교육 아카데미**입니다: **트랙 A(DB 튜닝)** / **트랙 B(DB 설계)**, 공통 베이스는 **SQL 기초**.
- **커리큘럼의 단일 원천**은 `curriculum/` 폴더의 md 문서입니다. 작업 전 [curriculum/ROADMAP.md](curriculum/ROADMAP.md)를 참조하세요.
- 홈 화면은 2-트랙 로드맵(`assets/js/academy.js` + `assets/css/academy.css`)이며, 현재 운영 중인 과정은 **DB 튜닝 마스터(성능진단·튜닝)** 입니다.
- 파일 분리·디렉터리 규칙은 [STRUCTURE.md](STRUCTURE.md) 참고. **신규 작업은 `assets/`로 분리**하고 `app.js`/`index.html`을 계속 키우지 않습니다.
- ⚠️ **자격증(SQLD/SQLP 등) 표현 금지** — 단계는 역량 기준 명칭만 사용합니다.
- 🎨 **디자인 시스템은 [spharos_design.md](spharos_design.md)** (SHINSEGAE I&C Spharos): 라이트+네이비+옐로우(60/30/10), Pretendard, **색 띠(stripe) 금지**, **옐로우 웨지 모티프 미사용(폐기)**. 토큰은 `assets/css/spharos.css`, 코드 폰트는 **D2Coding**.
- 📌 **성능진단 소모임**: 현재 구현된 실습/세션은 정규 과정이 아니라 **별도 운영 사내 스터디**입니다(홈의 "성능진단 소모임" 카드로 진입). 정규 로드맵 과정들은 기획 단계.
- 🗂️ **추후 진행 예정 작업·명령 스크립트는 [BACKLOG.md](BACKLOG.md)** 참고.

## 🌐 서버 및 배포 환경 정보
- **도메인 및 경로**: 
  - 기본 접속 주소: `kkcsvr/tsclass` (또는 `0.0.0.0/tsclass` 형태로 프록시 연동)
  - 이 서비스는 단독 루트(`/`)가 아닌 하위 경로 `/tsclass/`로 서비스되므로, 모든 정적 파일 경로(Relative Path) 및 Nginx `alias` 설정이 이에 맞춰져 있습니다.
- **Nginx 설정**:
  - Nginx 서버명(Server Name)은 **`kkcsvr`**로 고정되어 있습니다.
- **아마존 리눅스(Amazon Linux 2023) 권한**:
  - Nginx가 사용하는 `nginx` 유저가 `/var/www/html/TS_edu` 경로 내 정적 파일에 정상 접근할 수 있어야 403 Forbidden 오류가 발생하지 않습니다.
  - 소스 수정 후 서버 배포(git pull)를 할 때는 깃 저장소의 소유권 경고(`dubious ownership`)를 회피하기 위해 `sudo -u nginx git pull` 명령을 권장합니다.

## ⚡ 캐시 무효화 (Cache Busting)
- Nginx나 브라우저의 강력한 정적 파일 캐싱으로 인해 소스 코드 변경(예: 새로운 퀴즈 추가, Level 5/6 스크립트 수정)이 브라우저에 바로 반영되지 않을 수 있습니다.
- 새로운 빌드 또는 배포 시에는 반드시 `index.html` 내의 `style.css`, `app.js`, `challenges.js` 등의 로드 쿼리 스트링 버전(`?v=1.x`)을 올려서 브라우저 캐시를 강제 갱신해야 합니다.

## 🔐 인증 토큰 게이트 & 접속자 집계 (Access Token Gate & Visit Counter)
- **인증 토큰**: 사이트 첫 진입 시 로그인 오버레이(사이트 라이트 테마와 동일 톤)가 표시되며, 인증 토큰 `techsvc`를 입력해야 콘텐츠에 접근할 수 있습니다.
  - 소스 보기에 토큰 평문이 노출되지 않도록, 스크립트에는 토큰 문자열이 아니라 **해시값(cyrb53)** 만 들어 있습니다. 위치: `index.html` 하단 스크립트의 `AUTH_SEED`, `AUTH_HASH`.
  - 토큰을 변경하려면 새 토큰의 cyrb53 해시를 계산해 `AUTH_HASH`를 교체합니다. (Node 예시)
    ```bash
    node -e 'const c=(s,seed=0)=>{let h1=0xdeadbeef^seed,h2=0x41c6ce57^seed;for(let i=0,ch;i<s.length;i++){ch=s.charCodeAt(i);h1=Math.imul(h1^ch,2654435761);h2=Math.imul(h2^ch,1597334677);}h1=Math.imul(h1^(h1>>>16),2246822507);h1^=Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507);h2^=Math.imul(h1^(h1>>>13),3266489909);return 4294967296*(2097151&h2)+(h1>>>0);};console.log(c("새토큰",0x5f3a2b))'
    ```
  - 인증 상태는 `sessionStorage`(`ts_auth_ok`)에 저장 → 같은 탭/세션에서는 새로고침해도 재입력 불필요(탭 닫으면 만료).
  - ⚠️ **클라이언트 측 소프트 게이트**입니다. 해시·세션은 디버거/네트워크로 우회 가능하므로 진짜 보안이 아닌 내부 교육용 접근 차단 용도입니다. 강한 인증이 필요하면 Nginx `auth_basic` 등 서버 측 인증을 사용하세요.
  - ⚠️ 이 `INSTRUCTIONS.md`에는 토큰 평문이 적혀 있습니다. **민감 문서만** Nginx에서 차단하세요.
    - 🚫 **`.md` 전체 차단 금지**: 앱이 학습자료를 `assets/lessons/**/*.md` 에서 fetch 하므로, `location ~* \.md$ { deny all; }` 같은 전체 차단을 넣으면 **학습자료가 403으로 깨집니다(SQL 기초·소모임 학습자료 링크 죽음)**.
    ```nginx
    # 민감 문서만 차단 — assets/lessons/**/*.md(교재)는 반드시 허용(기본 정적 서빙)
    location ~* /(INSTRUCTIONS|STRUCTURE|BACKLOG)\.md$ { deny all; }
    location ~* ^/tsclass/curriculum/ { deny all; }
    ```
- **접속자 집계 (Nginx 접속 로그 방식)**: 토큰 입력 **성공 시 1회**, 프론트엔드가 `/tsclass/__visit` 를 fetch 합니다. 이 요청을 Nginx 전용 로그 파일에 기록해 집계합니다.
  - 아래 `location` 블록을 `kkcsvr` 서버의 Nginx 설정에 추가해야 합니다(미설정 시 404가 나도 사이트 동작에는 영향 없음):
    ```nginx
    # TS class 접속자 집계용 (토큰 입력 성공 로그)
    location = /tsclass/__visit {
        access_log /var/log/nginx/tsclass_visits.log;
        return 204;
    }
    ```
  - 설정 적용: `sudo nginx -t && sudo systemctl reload nginx`
  - 집계 명령 예시:
    - 총 접속(토큰 입력) 횟수: `wc -l /var/log/nginx/tsclass_visits.log`
    - 고유 IP 수: `awk '{print $1}' /var/log/nginx/tsclass_visits.log | sort -u | wc -l`
    - 일자별 접속 수: `awk '{print $4}' /var/log/nginx/tsclass_visits.log | cut -d: -f1 | tr -d '[' | sort | uniq -c`
