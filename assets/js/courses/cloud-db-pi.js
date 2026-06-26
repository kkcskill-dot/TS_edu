/* =============================================================
 * cloud-db-pi.js — AWS Performance Insights 모니터링 시뮬레이터
 * ============================================================= */
(function() {
  function mount() {
    const container = document.getElementById("cloud-pi-container");
    if (!container) return;

    let history = Array(40).fill(1.5);
    let isSpiking = false;
    let timer = null;

    container.innerHTML = `
      <div style="padding: 24px; display: flex; flex-direction: column; gap: 20px; height: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin:0; color: #002A5B; font-size: 1.2rem;">📈 Performance Insights (AAS)</h3>
          <button id="pi-spike-btn" style="padding: 8px 16px; border: none; border-radius: 6px; background: #E91E63; color: white; font-weight: bold; cursor: pointer;">🚨 부하 발생 시뮬레이션</button>
        </div>
        
        <div style="background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 8px; padding: 16px; height: 200px; position: relative;">
          <div style="position: absolute; top: 16px; right: 16px; font-size: 0.8rem; color: var(--color-text-muted);">Max vCPU: 4.0</div>
          <!-- 4.0 기준선 -->
          <div style="position: absolute; top: 40px; left: 16px; right: 16px; height: 1px; border-top: 1px dashed #E91E63; opacity: 0.5;"></div>
          
          <div id="pi-chart" style="display: flex; align-items: flex-end; gap: 2px; height: 100%; padding-top: 20px;">
            <!-- 바 차트 렌더링 영역 -->
          </div>
        </div>

        <div style="flex: 1; background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 8px; padding: 16px; overflow-y: auto;">
          <h4 style="margin: 0 0 12px 0; color: #002A5B;">🔥 Top SQL</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-light); color: var(--color-text-muted);">
                <th style="padding: 8px;">SQL Text</th>
                <th style="padding: 8px; width: 100px;">Load (AAS)</th>
                <th style="padding: 8px; width: 150px;">Waits</th>
              </tr>
            </thead>
            <tbody id="pi-sql-table">
            </tbody>
          </table>
        </div>
      </div>
    `;

    const chartEl = container.querySelector("#pi-chart");
    const tableEl = container.querySelector("#pi-sql-table");
    const btn = container.querySelector("#pi-spike-btn");

    function renderChart() {
      // vCPU 4.0 을 기준으로, 최대 8.0 까지 표현 (높이 100%)
      const maxVal = 8.0;
      let html = "";
      history.forEach(val => {
        const pct = Math.min((val / maxVal) * 100, 100);
        let color = "#4E86C4";
        if (val > 4.0) color = "#E91E63"; // vCPU 초과시 붉은색
        else if (val > 3.0) color = "#F9BB00"; // 경고

        html += `<div style="flex: 1; background: ${color}; height: ${pct}%; border-radius: 2px 2px 0 0; transition: height 0.2s;"></div>`;
      });
      chartEl.innerHTML = html;
    }

    function renderTable() {
      const currentLoad = history[history.length - 1];
      let sqls = [];
      if (currentLoad > 4.0) {
        sqls = [
          { txt: "SELECT * FROM orders WHERE status = 'PENDING'", load: (currentLoad * 0.7).toFixed(2), wait: "io/table/sql/handler" },
          { txt: "UPDATE user_points SET points = points + 1", load: (currentLoad * 0.2).toFixed(2), wait: "wait/synch/mutex/innodb" },
          { txt: "INSERT INTO audit_log (action) VALUES (?)", load: (currentLoad * 0.1).toFixed(2), wait: "wait/io/file/innodb" }
        ];
      } else {
        sqls = [
          { txt: "SELECT count(*) FROM users", load: (currentLoad * 0.6).toFixed(2), wait: "CPU" },
          { txt: "SELECT 1", load: (currentLoad * 0.3).toFixed(2), wait: "CPU" }
        ];
      }

      let html = "";
      sqls.forEach(s => {
        html += `
          <tr style="border-bottom: 1px solid var(--border-light);">
            <td style="padding: 8px; font-family: var(--font-mono); color: #1C5A95;">${s.txt}</td>
            <td style="padding: 8px; font-weight: bold;">${s.load}</td>
            <td style="padding: 8px; color: #E91E63; font-size: 0.75rem;">
              <span style="display:inline-block; padding: 2px 6px; background: rgba(233, 30, 99, 0.1); border-radius: 4px;">${s.wait}</span>
            </td>
          </tr>
        `;
      });
      tableEl.innerHTML = html;
    }

    function tick() {
      history.shift();
      let nextVal = 1.0 + Math.random() * 1.5; // 기본 1.0 ~ 2.5
      if (isSpiking) {
        nextVal = 4.5 + Math.random() * 3.0; // 스파이크 4.5 ~ 7.5
      }
      history.push(nextVal);
      renderChart();
      renderTable();
    }

    btn.addEventListener("click", () => {
      isSpiking = true;
      btn.textContent = "🔥 부하 지속 중... (5초 후 안정)";
      btn.style.background = "#8A1F1F";
      setTimeout(() => {
        isSpiking = false;
        btn.textContent = "🚨 부하 발생 시뮬레이션";
        btn.style.background = "#E91E63";
      }, 5000);
    });

    if (timer) clearInterval(timer);
    timer = setInterval(tick, 1000);
    tick(); // init
  }

  document.addEventListener("DOMContentLoaded", () => {
    const nav = document.getElementById("nav-btn-cloud-pi");
    if (nav) {
      nav.addEventListener("click", () => {
        // 이미 마운트되어 있지 않다면 마운트
        const container = document.getElementById("cloud-pi-container");
        if (container && container.innerHTML.trim().includes("동적")) {
          mount();
        } else if (container && container.innerHTML.trim() === "") {
          mount();
        }
      });
    }
  });
})();
