# 개발 지침 및 주의사항 (Instructions & Rules)

여기에 프로젝트 작업 시 반드시 지켜야 할 사용자 지침 및 서버 환경 정보를 기록합니다.

## 🚨 최우선 규칙
1. **브라우저 도구 사용 금지**: 에이전트(Antigravity)는 직접 브라우저(`browser_subagent`)를 켜서 테스트하는 동작을 절대로 수행하지 않습니다. UI 검증이나 기능 확인은 사용자 피드백이나 수동 테스트 안내를 통해서 진행합니다.

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
