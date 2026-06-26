/* =============================================================
 * cloud-db-troubleshoot.js — 클라우드 DB 트러블슈팅 케이스 스터디
 * ============================================================= */
(function() {
  const CASES = [
    {
      id: "case-1",
      title: "Case 1: 연결 고갈(Connection Pool Exhaustion) 장애",
      symptom: "서비스 오픈 당일 오전 10시, 웹사이트에 접속이 되지 않고 앱 서버 로그에 'Too many connections' 오류 발생.",
      cause: "DB 파라미터(max_connections)가 기본값으로 설정되어 트래픽을 수용하지 못함. 온프레미스와 달리 my.cnf를 직접 수정할 수 없음을 인지하지 못함.",
      solution: "AWS 콘솔에서 Parameter Group을 신규 생성 및 max_connections(예: 2000) 수정 후, Aurora 클러스터에 재할당. (Dynamic 파라미터이므로 재시작 없이 즉시 적용됨을 확인)"
    },
    {
      id: "case-2",
      title: "Case 2: 예상치 못한 페일오버(Failover)와 Read Replication 딜레이",
      symptom: "정상 운영 중이던 Primary 인스턴스가 30초간 응답이 없다가 접속이 끊겼고, 재접속 후 읽기 지연(Replication Lag) 현상이 5분간 지속됨.",
      cause: "기저 하드웨어 장애로 인해 Aurora가 Multi-AZ 구성의 Replica로 자동 Failover를 수행. 새 Primary가 복구되는 과정에서 버퍼 풀 워밍업 부족으로 인해 일시적인 성능 저하 발생.",
      solution: "Failover 자체는 정상적인 클라우드 아키텍처 동작. 향후 애플리케이션의 Connection 재연결 로직(Retry) 보완 및 Cluster Endpoint 사용 확인. 성능 저하 방지를 위한 버퍼 상태 유지(Cluster Cache Management) 도입 검토."
    },
    {
      id: "case-3",
      title: "Case 3: Undo Log 비대화로 인한 전면적인 느림 현상",
      symptom: "새벽 배치 작업 도중 DB CPU가 100%에 도달하고, 낮 시간대 일반 조회 쿼리마저 수 초 이상 지연됨.",
      cause: "한 개발자가 툴(DBeaver 등)에서 Auto-commit을 끄고 조회용 트랜잭션을 시작해둔 채 퇴근함. MySQL의 MVCC 구조상 이 오래된 세션 때문에 Undo Log가 삭제되지 않고 수천만 건 누적되어 디스크 IO 및 CPU 부하 발생.",
      solution: "Performance Insights를 통해 오래된 'Sleep' 상태의 트랜잭션 보유 세션(History List Length 범인) 식별 후 KILL 조치. 이후 innodb_undo_log_truncate 설정 모니터링."
    }
  ];

  function mount() {
    const container = document.getElementById("cloud-troubleshoot-container");
    if (!container) return;

    let html = `
      <div style="padding: 24px; height: 100%; display: flex; flex-direction: column;">
        <h3 style="margin-top: 0; color: #002A5B; margin-bottom: 8px;">장애 트러블슈팅 케이스 스터디</h3>
        <p style="color: var(--color-text-muted); margin-bottom: 24px;">클라우드 전환 후 초기 운영 단계에서 자주 마주치는 장애 사례들입니다. 제목을 클릭하여 상세 내용을 확인하세요.</p>
        
        <div style="flex: 1; display: flex; flex-direction: column; gap: 12px;" id="troubleshoot-list">
    `;

    CASES.forEach(c => {
      html += `
        <div class="ts-case-card" style="border: 1px solid var(--border-light); border-radius: 8px; background: var(--bg-card); overflow: hidden;">
          <div class="ts-case-header" style="padding: 16px; background: #F4F6F9; font-weight: bold; color: #002A5B; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
            <span>${c.title}</span>
            <span style="color: var(--color-text-muted); font-size: 1.2rem;">+</span>
          </div>
          <div class="ts-case-body" style="padding: 0 16px; max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out; background: var(--bg-card);">
            <div style="padding: 16px 0;">
              <div style="margin-bottom: 12px;">
                <span style="display: inline-block; padding: 2px 8px; background: rgba(233, 30, 99, 0.1); color: #E91E63; border-radius: 4px; font-size: 0.8rem; font-weight: bold; margin-bottom: 4px;">증상 (Symptom)</span>
                <div style="color: var(--color-text-main); line-height: 1.5; font-size: 0.95rem;">${c.symptom}</div>
              </div>
              <div style="margin-bottom: 12px;">
                <span style="display: inline-block; padding: 2px 8px; background: rgba(249, 187, 0, 0.15); color: #845F00; border-radius: 4px; font-size: 0.8rem; font-weight: bold; margin-bottom: 4px;">원인 (Root Cause)</span>
                <div style="color: var(--color-text-main); line-height: 1.5; font-size: 0.95rem;">${c.cause}</div>
              </div>
              <div>
                <span style="display: inline-block; padding: 2px 8px; background: rgba(14, 122, 83, 0.1); color: var(--accent-emerald); border-radius: 4px; font-size: 0.8rem; font-weight: bold; margin-bottom: 4px;">해결 (Solution & Lesson)</span>
                <div style="color: var(--color-text-main); line-height: 1.5; font-size: 0.95rem;">${c.solution}</div>
              </div>
            </div>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    container.innerHTML = html;

    const headers = container.querySelectorAll(".ts-case-header");
    headers.forEach(header => {
      header.addEventListener("click", () => {
        const body = header.nextElementSibling;
        const icon = header.querySelector("span:last-child");
        
        // 아코디언 토글
        if (body.style.maxHeight && body.style.maxHeight !== "0px") {
          body.style.maxHeight = "0px";
          icon.textContent = "+";
        } else {
          body.style.maxHeight = body.scrollHeight + "px";
          icon.textContent = "-";
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const nav = document.getElementById("nav-btn-cloud-troubleshoot");
    if (nav) {
      nav.addEventListener("click", () => {
        const container = document.getElementById("cloud-troubleshoot-container");
        if (container && container.innerHTML.trim().includes("동적")) {
          mount();
        } else if (container && container.innerHTML.trim() === "") {
          mount();
        }
      });
    }
  });
})();
