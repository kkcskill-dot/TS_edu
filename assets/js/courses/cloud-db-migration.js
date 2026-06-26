/* =============================================================
 * cloud-db-migration.js — Oracle to MySQL 이관 진단 체크리스트
 * ============================================================= */
(function() {
  const CHECKLIST = [
    {
      id: "mig-1",
      title: "데이터 타입 매핑 (DATE vs DATETIME)",
      desc: "Oracle의 DATE는 시/분/초를 포함하지만, 기본 설정의 MySQL DATE는 연/월/일만 저장합니다. 시간 정보를 유지하려면 DATETIME(또는 TIMESTAMP)으로 변환해야 합니다."
    },
    {
      id: "mig-2",
      title: "시퀀스(SEQUENCE) 대체",
      desc: "MySQL 8.0 이전까지는 SEQUENCE 객체가 지원되지 않습니다. AUTO_INCREMENT 속성을 컬럼에 적용하거나, 채번 테이블을 구성해야 합니다."
    },
    {
      id: "mig-3",
      title: "OUTER JOIN 구문 변환",
      desc: "Oracle 고유의 '(+)' 조인 문법은 작동하지 않습니다. ANSI 표준인 LEFT OUTER JOIN / RIGHT OUTER JOIN으로 쿼리를 전면 재작성해야 합니다."
    },
    {
      id: "mig-4",
      title: "함수 치환 (NVL, DECODE, SYSDATE)",
      desc: "NVL은 IFNULL로, DECODE는 CASE WHEN 문으로, SYSDATE는 NOW()로 변경해야 합니다. (또는 내장 함수 매핑 로직 추가 필요)"
    },
    {
      id: "mig-5",
      title: "PL/SQL (프로시저/트리거) 이관",
      desc: "Oracle의 PL/SQL은 MySQL의 Stored Procedure 구문으로 자동 1:1 변환되지 않는 경우가 많습니다. 비즈니스 로직을 애플리케이션(Java/Node 등) 레이어로 분리할지 결정하세요."
    }
  ];

  function mount() {
    const container = document.getElementById("cloud-migration-container");
    if (!container) return;

    let html = `
      <div style="padding: 24px;">
        <h3 style="margin-top: 0; color: #002A5B;">🛠 이관 전 필수 진단 체크리스트</h3>
        <p style="color: var(--color-text-muted); margin-bottom: 24px;">모든 항목을 꼼꼼히 점검하고 체크박스를 클릭하여 진행 상황을 확인하세요.</p>
        
        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;" id="mig-list">
    `;

    CHECKLIST.forEach(item => {
      html += `
        <label style="display: flex; gap: 16px; padding: 16px; border: 1px solid var(--border-light); border-radius: 8px; cursor: pointer; background: var(--bg-card); transition: all 0.2s;" class="mig-item">
          <input type="checkbox" value="${item.id}" style="width: 20px; height: 20px; accent-color: #002A5B; margin-top: 2px;">
          <div>
            <div style="font-weight: bold; color: var(--color-text-main); font-size: 1.05rem; margin-bottom: 6px;">${item.title}</div>
            <div style="color: var(--color-text-muted); font-size: 0.9rem; line-height: 1.5;">${item.desc}</div>
          </div>
        </label>
      `;
    });

    html += `
        </div>
        
        <div style="background: #F4F6F9; padding: 20px; border-radius: 8px; border: 1px dashed #CBD5E1; text-align: center;">
          <div style="font-weight: bold; color: #002A5B; margin-bottom: 8px;">진행률: <span id="mig-progress-text">0%</span></div>
          <div style="width: 100%; background: #E2E8F0; border-radius: 10px; height: 12px; overflow: hidden; margin-bottom: 16px;">
            <div id="mig-progress-bar" style="width: 0%; height: 100%; background: #002A5B; transition: width 0.3s ease;"></div>
          </div>
          <div id="mig-result" style="font-size: 1.1rem; font-weight: bold; color: #8A1F1F;">진단 중입니다... 모든 항목을 점검하세요.</div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    const checkboxes = container.querySelectorAll("input[type='checkbox']");
    const pBar = container.querySelector("#mig-progress-bar");
    const pText = container.querySelector("#mig-progress-text");
    const pRes = container.querySelector("#mig-result");

    checkboxes.forEach(cb => {
      cb.addEventListener("change", () => {
        let checkedCount = 0;
        checkboxes.forEach(c => {
          if (c.checked) {
            checkedCount++;
            c.closest("label").style.background = "rgba(0, 42, 91, 0.05)";
            c.closest("label").style.borderColor = "#002A5B";
          } else {
            c.closest("label").style.background = "var(--bg-card)";
            c.closest("label").style.borderColor = "var(--border-light)";
          }
        });

        const pct = Math.round((checkedCount / CHECKLIST.length) * 100);
        pBar.style.width = pct + "%";
        pText.textContent = pct + "%";

        if (pct === 100) {
          pBar.style.background = "var(--accent-emerald)";
          pRes.innerHTML = `<span style="color: var(--accent-emerald);">✅ 마이그레이션 진단 완료! (Ready for Migration)</span>`;
        } else {
          pBar.style.background = "#002A5B";
          pRes.innerHTML = `<span style="color: #8A1F1F;">진단 중입니다... 모든 항목을 점검하세요.</span>`;
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const nav = document.getElementById("nav-btn-cloud-migration");
    if (nav) {
      nav.addEventListener("click", () => {
        const container = document.getElementById("cloud-migration-container");
        if (container && container.innerHTML.trim().includes("동적")) {
          mount();
        } else if (container && container.innerHTML.trim() === "") {
          mount();
        }
      });
    }
  });
})();
