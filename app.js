/* -------------------------------------------------------------
 * TS class Application Controller
 * Dynamic SPA Router, Metrics Simulators, Lock Steppers, and Levels
 * ------------------------------------------------------------- */

// App State
let currentTab = "panel-welcome";
let currentDialect = "oracle"; // default
let currentScenarioInterval = null;
let currentScenario = "normal";

// Lock simulator state
let currentLockScenarioKey = "row_lock";
let currentLockStep = 0;

// Challenge state
let currentLevel = 1;
let selectedOptionId = null;

// DBA Tips pool
const dbaTips = [
  "개발단계에서 인덱스 설계가 누락되면, 실 서비스 오픈 후 커넥션 풀 고갈의 원인이 됩니다. 💡",
  "인덱스는 대개 Read 속도를 올리지만, Write(INSERT/UPDATE/DELETE) 작업 시에는 인덱스 블록 분할 등으로 속도를 늦출 수 있습니다. 💡",
  "LIKE '%검색어%'와 같은 양방향 와일드카드는 인덱스를 타지 못하고 무조건 Full Table Scan을 유발합니다. 💡",
  "컬럼 데이터 타입이 문자형(VARCHAR)인데 숫자값(123)으로 조회하면 묵시적 형변환으로 인해 인덱스가 작동하지 않습니다. 💡",
  "부하가 심한 대용량 조인 시에는 Nested Loops보다는 Hash Join이 압도적으로 유리합니다. 단, 조인 컬럼에 적절한 해시 버킷이 생성되어야 합니다. 💡"
];

/* -------------------------------------------------------------
 * 1. SPA Router & Dialect Initializers
 * ------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  initRouter();

  initDashboardMetrics();
  initExplainPlanPanel();
  initIndexSimulator();
  initLockSandbox();
  initChallengeArena();
  initAshAnalyzer();
  initAwrAnalyzer();

  // Choose a random tip to start
  rotateDbaTip();
  setInterval(rotateDbaTip, 10000);
});

function initRouter() {
  const menuButtons = document.querySelectorAll(".menu-item");

  menuButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      const targetPanel = btn.getAttribute("data-target");
      if (!targetPanel) return;

      // Update sidebar active buttons
      menuButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // Switch panel display
      document.querySelectorAll(".content-panel").forEach(p => p.classList.remove("active"));
      document.getElementById(targetPanel).classList.add("active");

      // Update header path
      currentTab = targetPanel;
      const sectionName = btn.innerText.replace(/\s+/g, ' ').trim();
      document.getElementById("current-section-title").innerText = sectionName;
      document.getElementById("current-section-path").innerText = `기술서비스팀 DBA Lab > ${sectionName}`;

      // Special panel loads
      if (targetPanel === "panel-explain") {
        const activePreset = document.querySelector(".btn-explain-preset.active");
        const queryKey = activePreset ? activePreset.getAttribute("data-query") : "idx_scan";
        renderExecutionPlanTree(queryKey, currentDialect);
      } else if (targetPanel === "panel-index") {
        const searchInput = document.getElementById("index-search-val");
        renderBTreeSimulator(parseInt(searchInput.value) || 62);
      } else if (targetPanel === "panel-quiz") {
        initQuizPanel();
      }
    });
  });

  // Brand logo → Home
  const brandBtn = document.getElementById("brand-home-btn");
  if (brandBtn) {
    brandBtn.addEventListener("click", () => {
      menuButtons.forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".content-panel").forEach(p => p.classList.remove("active"));
      document.getElementById("panel-welcome").classList.add("active");
      currentTab = "panel-welcome";
      document.getElementById("current-section-title").innerText = "DBA Lab 연구센터";
      document.getElementById("current-section-path").innerText = "기술서비스팀 DBA Lab";
    });
  }
}


function rotateDbaTip() {
  const tipEl = document.getElementById("dynamic-dba-tip");
  if (!tipEl) return;
  const rand = dbaTips[Math.floor(Math.random() * dbaTips.length)];
  tipEl.style.opacity = 0;
  setTimeout(() => {
    tipEl.innerText = rand;
    tipEl.style.opacity = 1;
  }, 300);
}

/* -------------------------------------------------------------
 * 2. Real-time Dashboard Scenarios & Chart Loop
 * ------------------------------------------------------------- */
function initDashboardMetrics() {
  // Preset scenarios handlers
  const presetBtns = document.querySelectorAll(".btn-preset-sql");
  const textarea = document.getElementById("dashboard-custom-sql");

  presetBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      presetBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const scenario = btn.getAttribute("data-scenario");
      currentScenario = scenario;

      // Inject SQL text
      if (scenario === "normal") {
        textarea.value = "SELECT * FROM users WHERE id = 42;";
      } else if (scenario === "fullscan") {
        textarea.value = "SELECT * FROM sales WHERE desc LIKE '%VIP%'; -- (인덱스 없음, 풀 테이블 스캔 유발)";
      } else if (scenario === "cartesian") {
        textarea.value = "SELECT COUNT(*) FROM sales, users; -- (카테시안 곱 대량 카디널리티 유발)";
      } else if (scenario === "lockwait") {
        textarea.value = "UPDATE accounts SET bal = bal - 100 WHERE status = 'ACTIVE'; -- (인서트 락 대기 시나리오)";
      }

      triggerScenarioMetrics(scenario);
    });
  });

  // Custom Run Buttons
  document.getElementById("btn-run-scenario").addEventListener("click", () => {
    document.getElementById("btn-stop-scenario").disabled = false;
    document.getElementById("btn-run-scenario").disabled = true;
    triggerScenarioMetrics(currentScenario);
  });

  document.getElementById("btn-stop-scenario").addEventListener("click", () => {
    document.getElementById("btn-run-scenario").disabled = false;
    document.getElementById("btn-stop-scenario").disabled = true;
    presetBtns.forEach(b => b.classList.remove("active"));
    presetBtns[0].classList.add("active"); // normal
    textarea.value = "SELECT * FROM users WHERE id = 42;";
    triggerScenarioMetrics("normal");
  });

  // Start background loop
  if (currentScenarioInterval) clearInterval(currentScenarioInterval);

  // Initialize with normal scenario values
  triggerScenarioMetrics("normal");

  currentScenarioInterval = setInterval(() => {
    simulateMetricFluctuations();
  }, 1500);
}

let targetCPU = 12;
let targetIO = 2.4;
let targetSessions = 3;

function triggerScenarioMetrics(scenario) {
  const explainTitle = document.getElementById("wait-explain-title");
  const explainDesc = document.getElementById("wait-explain-desc");
  const cpuStatus = document.getElementById("dashboard-cpu-status");
  const ioStatus = document.getElementById("dashboard-io-status");
  const sessionsStatus = document.getElementById("dashboard-sessions-status");
  const waitContainer = document.getElementById("wait-events-list");

  waitContainer.innerHTML = '';

  if (scenario === "normal") {
    targetCPU = 12;
    targetIO = 2.4;
    targetSessions = 3;

    cpuStatus.className = "metric-status status-good"; cpuStatus.innerText = "정상";
    ioStatus.className = "metric-status status-good"; ioStatus.innerText = "정상";
    sessionsStatus.className = "metric-status status-good"; sessionsStatus.innerText = "정상";

    explainTitle.innerText = "현재 상태: 매우 안정적임";
    explainTitle.style.color = "var(--accent-emerald)";
    explainDesc.innerText = "서버 CPU가 유휴 상태이며, 락 대기나 물리적 디스크 I/O 대기 이벤트가 미미합니다. 쿼리들이 적절히 인덱스를 타고 있습니다.";

    appendWaitEvent("SQL*Net message from client", 80, "good");
    appendWaitEvent("db file sequential read", 15, "good");
    appendWaitEvent("CPU time", 5, "good");

  } else if (scenario === "fullscan") {
    targetCPU = 42;
    targetIO = 44.8;
    targetSessions = 9;

    cpuStatus.className = "metric-status status-warn"; cpuStatus.innerText = "주의";
    ioStatus.className = "metric-status status-danger"; ioStatus.innerText = "위험 (I/O 폭증)";
    sessionsStatus.className = "metric-status status-good"; sessionsStatus.innerText = "정상";

    explainTitle.innerText = "현재 상태: 물리적 디스크 Read I/O 이슈 발생";
    explainTitle.style.color = "var(--accent-orange)";
    explainDesc.innerText = "풀 테이블 스캔(Full Table Scan) 쿼리가 빈번히 발생하여 데이터베이스가 메모리(Buffer Cache)가 아닌 물리 디스크 영역을 대량으로 퍼올리고 있습니다. db file scattered read 이벤트가 급증했습니다.";

    appendWaitEvent("db file scattered read (FTS)", 72, "warning");
    appendWaitEvent("CPU time", 18, "good");
    appendWaitEvent("SQL*Net message from client", 10, "good");

  } else if (scenario === "cartesian") {
    targetCPU = 99;
    targetIO = 0.8;
    targetSessions = 14;

    cpuStatus.className = "metric-status status-danger"; cpuStatus.innerText = "위험 (CPU 100%)";
    ioStatus.className = "metric-status status-good"; ioStatus.innerText = "정상";
    sessionsStatus.className = "metric-status status-warn"; sessionsStatus.innerText = "세션 과밀";

    explainTitle.innerText = "현재 상태: 서버 CPU 고갈 이슈 발생";
    explainTitle.style.color = "var(--accent-crimson)";
    explainDesc.innerText = "조인 조건절이 누락된 카테시안 곱(Cartesian Product) 연산으로 인해 디스크 I/O 없이 CPU 메모리상에서 수억 번의 불필요한 루프 비교 연산이 켜지며 CPU 리소스 전체를 점유하고 있습니다.";

    appendWaitEvent("CPU time (LATCH / JOIN BUSY)", 94, "danger");
    appendWaitEvent("latch: shared pool", 4, "warning");
    appendWaitEvent("db file sequential read", 2, "good");

  } else if (scenario === "lockwait") {
    targetCPU = 18;
    targetIO = 0.2;
    targetSessions = 26; // Lots of sessions piled up waiting!

    cpuStatus.className = "metric-status status-good"; cpuStatus.innerText = "정상";
    ioStatus.className = "metric-status status-good"; ioStatus.innerText = "정상";
    sessionsStatus.className = "metric-status status-danger"; sessionsStatus.innerText = "위험 (커넥션 폭증)";

    explainTitle.innerText = "현재 상태: 특정 트랜잭션의 락 독점으로 인한 세션 블로킹";
    explainTitle.style.color = "var(--accent-orange)";
    explainDesc.innerText = "선행 세션이 특정 중요 레코드(Row)를 업데이트한 채 COMMIT/ROLLBACK 없이 방치했습니다. 후행 업데이트 세션들이 줄줄이 Lock을 얻지 못하고 대기 상태에 걸려 액티브 세션이 치솟고 있습니다.";

    appendWaitEvent("enq: TX - row lock contention", 88, "warning");
    appendWaitEvent("SQL*Net message from client", 8, "good");
    appendWaitEvent("CPU time", 4, "good");
  }
}

function appendWaitEvent(name, pct, type) {
  const container = document.getElementById("wait-events-list");
  if (!container) return;

  let fillClass = "progress-fill";
  if (type === "warning") fillClass += " warning";
  if (type === "danger") fillClass += " danger";

  const div = document.createElement("div");
  div.className = "wait-event-row";
  div.innerHTML = `
    <span class="event-name" title="${name}">${name}</span>
    <div class="event-progress-bar">
      <div class="${fillClass}" style="width: ${pct}%"></div>
    </div>
    <span class="event-pct">${pct}%</span>
  `;
  container.appendChild(div);
}

function simulateMetricFluctuations() {
  // Add some random noise
  const noiseCPU = targetCPU + Math.round((Math.random() - 0.5) * 5);
  const finalCPU = Math.max(0, Math.min(100, noiseCPU));

  const noiseIO = targetIO + (Math.random() - 0.5) * 1.5;
  const finalIO = Math.max(0, parseFloat(noiseIO.toFixed(1)));

  const noiseSessions = targetSessions + Math.round((Math.random() - 0.5) * 2);
  const finalSessions = Math.max(1, noiseSessions);

  // Update numbers
  document.getElementById("dashboard-cpu-val").innerText = `${finalCPU}%`;
  document.getElementById("dashboard-io-val").innerText = `${finalIO} MB/s`;
  document.getElementById("dashboard-sessions-val").innerText = finalSessions;

  // Re-draw sparkline charts
  updateMetricCharts(finalCPU, finalIO, finalSessions);
}

/* -------------------------------------------------------------
 * 3. Execution Plan Panel Event Binders
 * ------------------------------------------------------------- */
function initExplainPlanPanel() {
  const presets = document.querySelectorAll(".btn-explain-preset");
  const ordersMeta = document.getElementById("meta-table-orders");
  const activeBadge = document.getElementById("active-table-badge");

  presets.forEach(btn => {
    btn.addEventListener("click", () => {
      presets.forEach(p => p.classList.remove("active"));
      btn.classList.add("active");

      const query = btn.getAttribute("data-query");

      // Update SQL view text
      const sqlCode = document.getElementById("explain-sql-code");
      if (query === "idx_scan") {
        sqlCode.innerText = "SELECT name, email FROM users WHERE id = 1250;";
        if (ordersMeta) ordersMeta.style.display = "none";
        if (activeBadge) {
          activeBadge.innerText = "USERS 테이블 활성";
          activeBadge.style.backgroundColor = "var(--accent-emerald)";
        }
      } else if (query === "full_scan") {
        sqlCode.innerText = "SELECT * FROM users WHERE register_date = '2026-05-18';";
        if (ordersMeta) ordersMeta.style.display = "none";
        if (activeBadge) {
          activeBadge.innerText = "USERS 테이블 활성";
          activeBadge.style.backgroundColor = "var(--accent-emerald)";
        }
      } else if (query === "hash_join") {
        sqlCode.innerText = "SELECT o.order_id, u.name \nFROM orders o \nJOIN users u ON o.user_id = u.id \nWHERE u.grade = 'VIP';";
        if (ordersMeta) ordersMeta.style.display = "block";
        if (activeBadge) {
          activeBadge.innerText = "USERS & ORDERS 조인 활성";
          activeBadge.style.backgroundColor = "var(--accent-cyan)";
        }
      } else if (query === "nested_loop") {
        sqlCode.innerText = "SELECT /*+ USE_NL(o) */ o.order_id, u.name \nFROM users u \nJOIN orders o ON u.id = o.user_id \nWHERE u.register_date = '2026-05-18';";
        if (ordersMeta) ordersMeta.style.display = "block";
        if (activeBadge) {
          activeBadge.innerText = "USERS & ORDERS 조인 활성";
          activeBadge.style.backgroundColor = "var(--accent-cyan)";
        }
      }

      renderExecutionPlanTree(query, currentDialect);
    });
  });

  // ── View Toggle: DBMS_XPLAN Text ↔ Graphic Tree ─────────────
  const btnText = document.getElementById("btn-toggle-explain-text");
  const btnTree = document.getElementById("btn-toggle-explain-tree");
  const textVp = document.getElementById("explain-text-viewport");
  const treeVp = document.getElementById("explain-tree-viewport");

  function activateTextView() {
    if (textVp) textVp.style.display = "block";
    if (treeVp) treeVp.style.display = "none";
    if (btnText) { btnText.style.background = "var(--accent-cyan)"; btnText.style.color = "#000"; btnText.style.fontWeight = "700"; }
    if (btnTree) { btnTree.style.background = "transparent"; btnTree.style.color = "var(--color-text-muted)"; btnTree.style.fontWeight = "600"; }
  }

  function activateTreeView() {
    if (treeVp) treeVp.style.display = "block";
    if (textVp) textVp.style.display = "none";
    if (btnTree) { btnTree.style.background = "var(--accent-cyan)"; btnTree.style.color = "#000"; btnTree.style.fontWeight = "700"; }
    if (btnText) { btnText.style.background = "transparent"; btnText.style.color = "var(--color-text-muted)"; btnText.style.fontWeight = "600"; }
  }

  if (btnText) btnText.addEventListener("click", activateTextView);
  if (btnTree) btnTree.addEventListener("click", activateTreeView);
}

/* -------------------------------------------------------------
 * 4. B-Tree Index Simulator Event Binders
 * ------------------------------------------------------------- */
function initIndexSimulator() {
  const searchInput = document.getElementById("index-search-val");
  const searchBtn = document.getElementById("btn-index-search");
  const fullScanBtn = document.getElementById("btn-full-scan");
  const scenarioSelect = document.getElementById("simulation-scenario");
  const scenarioDesc = document.getElementById("scenario-description");
  const inputLabel = document.getElementById("search-input-label");

  if (scenarioSelect) {
    scenarioSelect.addEventListener("change", (e) => {
      const scenario = e.target.value;
      if (scenario === "scenario_single") {
        inputLabel.innerText = "검색할 User ID (10 ~ 99)";
        searchInput.value = 62;
        searchInput.disabled = false;
        scenarioDesc.innerText = "User ID = 62번의 단 한 건의 데이터를 정밀 조회합니다. 인덱스가 Random Single I/O로 최소 블록만 액세스합니다.";
      } else if (scenario === "scenario_range") {
        inputLabel.innerText = "조회 범위 시작 ID (10 ~ 80)";
        searchInput.value = 10;
        searchInput.disabled = true; // Fix range to 10 ~ 80 for clear education
        scenarioDesc.innerText = "전체 데이터의 70% 이상(User ID 10~80)을 대용량 범위 조회합니다. 인덱스는 매번 Random Access 테이블 블록 I/O를 일으켜 대규모 오버헤드가 발생하지만, 풀 스캔은 Multi-Block Read로 빠르게 전량을 뭉텅이로 긁어옵니다.";
      } else if (scenario === "scenario_small") {
        inputLabel.innerText = "검색할 User ID (10 ~ 19)";
        searchInput.value = 12;
        searchInput.disabled = false;
        scenarioDesc.innerText = "전체 데이터가 단 2개의 블록(Block 1, 2)에만 존재하는 아주 작은 공통코드성 테이블을 조회합니다. 인덱스를 거치는 것보다 테이블 전체를 한 번에 쓱 읽는 풀 스캔이 훨씬 유리합니다.";
      }
    });
  }

  searchBtn.addEventListener("click", () => {
    const scenario = scenarioSelect ? scenarioSelect.value : "scenario_single";
    let val = parseInt(searchInput.value) || 62;
    // Boundary check
    if (val < 10) { val = 10; searchInput.value = 10; }
    if (val > 99) { val = 99; searchInput.value = 99; }

    renderBTreeSimulator(val, scenario);
  });

  if (fullScanBtn) {
    fullScanBtn.addEventListener("click", () => {
      const scenario = scenarioSelect ? scenarioSelect.value : "scenario_single";
      let val = parseInt(searchInput.value) || 62;
      // Boundary check
      if (val < 10) { val = 10; searchInput.value = 10; }
      if (val > 99) { val = 99; searchInput.value = 99; }

      renderFullTableScanSimulator(val, scenario);
    });
  }
}

/* -------------------------------------------------------------
 * 5. Lock & Deadlock Step Sandbox Binders
 * ------------------------------------------------------------- */
function initLockSandbox() {
  const select = document.getElementById("lock-scenario-select");
  const resetBtn = document.getElementById("btn-reset-lock-scenario");
  const stepBtnA = document.getElementById("btn-session-a-step");
  const stepBtnB = document.getElementById("btn-session-b-step");

  select.addEventListener("change", (e) => {
    currentLockScenarioKey = e.target.value;
    resetLockSandbox();
  });

  resetBtn.addEventListener("click", () => {
    resetLockSandbox();
  });

  stepBtnA.addEventListener("click", () => {
    executeNextLockStep("A");
  });

  stepBtnB.addEventListener("click", () => {
    executeNextLockStep("B");
  });

  resetLockSandbox();
}

function resetLockSandbox() {
  currentLockStep = 0;

  // Clear terminals
  document.getElementById("session-a-terminal").innerHTML = `<div class="terminal-line"><span class="terminal-response success">System: Session A connected.</span></div>`;
  document.getElementById("session-b-terminal").innerHTML = `<div class="terminal-line"><span class="terminal-response success">System: Session B connected.</span></div>`;

  // Reset lock grids
  const row1 = document.getElementById("lock-row-1");
  const row2 = document.getElementById("lock-row-2");

  row1.querySelector(".row-value").innerText = "Balance: 10,000₩";
  row2.querySelector(".row-value").innerText = "Balance: 25,000₩";

  row1.querySelector(".lock-state-badge").className = "lock-state-badge badge-free";
  row1.querySelector(".lock-state-badge").innerText = "LOCK FREE";
  row2.querySelector(".lock-state-badge").className = "lock-state-badge badge-free";
  row2.querySelector(".lock-state-badge").innerText = "LOCK FREE";

  // Reset nodes
  document.querySelector(".session-node.node-a").className = "session-node node-a active";
  document.querySelector(".session-node.node-b").className = "session-node node-b";
  document.querySelector(".blocking-arrow").className = "blocking-arrow";
  document.querySelector(".blocking-arrow").innerHTML = `<span class="arrow-text">대기 중 (TX Lock)</span><div class="arrow-line"></div>`;

  // Reset button locks
  document.getElementById("btn-session-a-step").disabled = false;
  document.getElementById("btn-session-b-step").disabled = true;

  // Reset explanations
  const explTitle = document.querySelector("#lock-explain-box h4");
  const explDesc = document.querySelector("#lock-explain-box p");
  explTitle.innerHTML = `대기 이벤트 분석: <span style="color:var(--accent-emerald)">Idle</span>`;
  explDesc.innerText = "시작하려면 세션 A의 '다음 쿼리 실행하기' 버튼을 눌러 시나리오를 한 단계 진행하세요.";
}

function executeNextLockStep(activeSession) {
  const scenario = lockScenarios[currentLockScenarioKey];
  if (!scenario || currentLockStep >= scenario.steps.length) return;

  const step = scenario.steps[currentLockStep];
  const term = document.getElementById(`session-${step.session.toLowerCase()}-terminal`);

  // Print query in the terminal
  const line = document.createElement("div");
  line.className = "terminal-line";
  line.innerHTML = `<span class="terminal-prompt">&gt;</span> <span class="terminal-sql">${step.sql}</span>`;
  term.appendChild(line);

  // Delay slightly for typing feel, then print response
  setTimeout(() => {
    const resp = document.createElement("span");
    resp.className = `terminal-response ${step.respClass}`;
    resp.innerText = step.resp;
    line.appendChild(resp);
    term.scrollTop = term.scrollHeight;

    // Update visual locking table states
    updateLockTableVisuals(step.rowLocks);

    // Update lock blocking graph
    updateBlockingGraphVisuals(step.blocking);

    // Update explanations
    updateLockExplanation(step.dbaTips, step.respClass);

    // Set next step index
    currentLockStep++;

    // Manage whose turn is next
    manageLockSandboxButtonTurns();
  }, 300);
}

function updateLockTableVisuals(rowLocks) {
  const row1 = document.getElementById("lock-row-1");
  const row2 = document.getElementById("lock-row-2");

  if (rowLocks.row1) {
    const badge = row1.querySelector(".lock-state-badge");
    if (rowLocks.row1 === "A") {
      badge.className = "lock-state-badge badge-locked-a";
      badge.innerText = "LOCKED by Session A";
      row1.querySelector(".row-value").innerText = "Balance: 9,900₩";
    } else if (rowLocks.row1 === "B") {
      badge.className = "lock-state-badge badge-locked-b";
      badge.innerText = "LOCKED by Session B";
      row1.querySelector(".row-value").innerText = "Balance: 10,100₩";
    } else if (rowLocks.row1 === "free") {
      badge.className = "lock-state-badge badge-free";
      badge.innerText = "LOCK FREE";
    }
  }

  if (rowLocks.row2) {
    const badge = row2.querySelector(".lock-state-badge");
    if (rowLocks.row2 === "A") {
      badge.className = "lock-state-badge badge-locked-a";
      badge.innerText = "LOCKED by Session A";
    } else if (rowLocks.row2 === "B") {
      badge.className = "lock-state-badge badge-locked-b";
      badge.innerText = "LOCKED by Session B";
      row2.querySelector(".row-value").innerText = "Balance: 24,900₩";
    } else if (rowLocks.row2 === "free") {
      badge.className = "lock-state-badge badge-free";
      badge.innerText = "LOCK FREE";
    }
  }
}

function updateBlockingGraphVisuals(blocking) {
  const nodeA = document.querySelector(".session-node.node-a");
  const nodeB = document.querySelector(".session-node.node-b");
  const arrow = document.querySelector(".blocking-arrow");

  if (blocking) {
    arrow.classList.add("active");

    if (blocking.cycle) {
      arrow.querySelector(".arrow-text").innerText = "교착 상태 (DEADLOCK!)";
      arrow.querySelector(".arrow-text").style.color = "var(--accent-crimson)";
      arrow.querySelector(".arrow-line").className = "arrow-line";
      nodeA.className = "session-node node-a active danger";
      nodeB.className = "session-node node-b active danger";

      // Show two way blocking arrows or circular arrows
      arrow.innerHTML = `
        <span class="arrow-text" style="color:var(--accent-crimson)">DEADLOCK CYCLE</span>
        <div class="arrow-line" style="background-color:var(--accent-crimson)"></div>
        <div class="arrow-line reverse" style="background-color:var(--accent-crimson); margin-top: 4px;"></div>
      `;
    } else {
      arrow.querySelector(".arrow-text").innerText = "enq: TX - row lock";
      arrow.querySelector(".arrow-text").style.color = "var(--accent-orange)";

      if (blocking.from === "B" && blocking.to === "A") {
        nodeA.className = "session-node node-a active";
        nodeB.className = "session-node node-b active";
        arrow.querySelector(".arrow-line").className = "arrow-line"; // B waits on A (arrow points to A? Wait, the arrow-line default points to right: A -> B. Let's make it go to Left)
        arrow.querySelector(".arrow-line").innerHTML = '';
        arrow.querySelector(".arrow-line").classList.add("reverse");
      } else {
        nodeA.className = "session-node node-a active";
        nodeB.className = "session-node node-b active";
        arrow.querySelector(".arrow-line").className = "arrow-line";
      }
    }
  } else {
    // Normal active node highlighting
    arrow.classList.remove("active");
    arrow.innerHTML = `<span class="arrow-text">대기 중 (TX Lock)</span><div class="arrow-line"></div>`;
    nodeA.className = "session-node node-a active";
    nodeB.className = "session-node node-b";
  }
}

function updateLockExplanation(tipsText, respClass) {
  const explTitle = document.querySelector("#lock-explain-box h4");
  const explDesc = document.querySelector("#lock-explain-box p");

  if (respClass === "waiting") {
    explTitle.innerHTML = `대기 이벤트 분석: <span style="color:var(--accent-orange)">enq: TX - row lock contention</span>`;
  } else if (respClass === "danger") {
    explTitle.innerHTML = `대기 이벤트 분석: <span style="color:var(--accent-crimson)">ORA-00060 Deadlock Detected</span>`;
  } else {
    explTitle.innerHTML = `대기 이벤트 분석: <span style="color:var(--accent-emerald)">Active / OK</span>`;
  }

  explDesc.innerHTML = tipsText;
}

function manageLockSandboxButtonTurns() {
  const stepBtnA = document.getElementById("btn-session-a-step");
  const stepBtnB = document.getElementById("btn-session-b-step");

  const scenario = lockScenarios[currentLockScenarioKey];
  if (!scenario || currentLockStep >= scenario.steps.length) {
    // Scenario ended
    stepBtnA.disabled = true;
    stepBtnB.disabled = true;
    return;
  }

  const nextStep = scenario.steps[currentLockStep];
  if (nextStep.session === "A") {
    stepBtnA.disabled = false;
    stepBtnB.disabled = true;
  } else {
    stepBtnA.disabled = true;
    stepBtnB.disabled = false;
  }
}

/* -------------------------------------------------------------
 * 6. SQL Tuning Gamified Challenge Binders
 * ------------------------------------------------------------- */
function initChallengeArena() {
  // Bind level maps
  const levelBtns = document.querySelectorAll(".challenge-level-btn");
  levelBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      levelBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const lvl = parseInt(btn.getAttribute("data-level")) || 1;
      loadChallengeLevel(lvl);
    });
  });

  document.getElementById("btn-next-level").addEventListener("click", () => {
    if (currentLevel < 4) {
      // Mark current level completed
      const activeBtn = document.querySelector(`.challenge-level-btn[data-level="${currentLevel}"]`);
      activeBtn.classList.add("completed");

      currentLevel++;

      const nextBtn = document.querySelector(`.challenge-level-btn[data-level="${currentLevel}"]`);
      nextBtn.click();
    } else {
      // Completed all levels! Issue dynamic badge certificate
      showDbaCertificationAward();
    }
  });

  loadChallengeLevel(1);
}

function loadChallengeLevel(lvl) {
  currentLevel = lvl;
  selectedOptionId = null;

  const data = sqlChallenges[lvl];
  if (!data) return;

  // Render descriptions
  document.getElementById("challenge-name").innerText = `Level ${lvl}: ${data.name}`;
  document.getElementById("challenge-desc").innerText = data.desc;
  document.getElementById("challenge-asis-sql").innerText = data.asisSql;

  // Reset score cards
  updateTuningPerformanceGauge(0);
  document.getElementById("metric-asis-io").innerText = data.asisMetrics.io;
  document.getElementById("metric-tobe-io").innerText = "-";
  document.getElementById("metric-asis-time").innerText = data.asisMetrics.time;
  document.getElementById("metric-tobe-time").innerText = "-";

  updateChallengePlanDialect();

  // Render option list
  const container = document.getElementById("challenge-options-container");
  container.innerHTML = '';

  data.options.forEach(opt => {
    const div = document.createElement("div");
    div.className = "tuning-option";
    div.setAttribute("data-opt-id", opt.id);

    div.innerHTML = `
      <input type="radio" name="challenge-opt" class="opt-radio" id="${opt.id}">
      <div class="opt-content">
        <span class="opt-title">${opt.title}</span>
        <span class="opt-desc">${opt.desc}</span>
      </div>
    `;

    div.addEventListener("click", () => {
      // Toggle active states
      document.querySelectorAll(".tuning-option").forEach(o => o.classList.remove("selected"));
      div.classList.add("selected");
      div.querySelector("input").checked = true;

      selectedOptionId = opt.id;
      evaluateChallengeSolution(lvl, opt.id);
    });

    container.appendChild(div);
  });

  // Disable next button until correct answer is chosen
  document.getElementById("btn-next-level").disabled = true;
}

function updateChallengePlanDialect() {
  const data = sqlChallenges[currentLevel];
  if (!data) return;

  const dialectInfo = data.dialectData[currentDialect] || data.dialectData.oracle;
  document.getElementById("metric-asis-plan").innerText = dialectInfo.asisPlan;
  document.getElementById("metric-tobe-plan").innerText = "-";
}

function evaluateChallengeSolution(lvl, optId) {
  const data = sqlChallenges[lvl];
  if (!data) return;

  const opt = data.options.find(o => o.id === optId);
  if (!opt) return;

  const dbaFeedbackText = document.getElementById("dba-review-feedback");
  const dialectInfo = data.dialectData[currentDialect] || data.dialectData.oracle;

  if (opt.isCorrect) {
    // Highlight correct effects
    dbaFeedbackText.innerHTML = `<span style="color:var(--accent-emerald); font-weight:700">🏆 [통과!]</span> ${opt.feedback}`;
    dbaFeedbackText.parentElement.style.borderColor = "rgba(16, 185, 129, 0.3)";
    dbaFeedbackText.parentElement.style.backgroundColor = "rgba(16, 185, 129, 0.05)";

    // Set tuned comparison table metrics
    document.getElementById("metric-tobe-io").innerText = data.tobeMetrics.io;
    document.getElementById("metric-tobe-time").innerText = data.tobeMetrics.time;
    document.getElementById("metric-tobe-plan").innerText = dialectInfo.tobePlan;

    // Calculate speedup percent
    const asisMs = parseFloat(data.asisMetrics.time.replace(/,/g, "").replace(" ms", ""));
    const tobeMs = parseFloat(data.tobeMetrics.time.replace(/,/g, "").replace(" ms", ""));
    const speedupPct = Math.round(((asisMs - tobeMs) / asisMs) * 100);

    // Animate performance gauge ring
    updateTuningPerformanceGauge(speedupPct);

    // Enable next button
    const nextBtn = document.getElementById("btn-next-level");
    nextBtn.disabled = false;
    if (lvl === 4) {
      nextBtn.innerText = "DBA 인증서 획득 🏆";
    } else {
      nextBtn.innerText = "다음 튜닝 단계로 이동";
    }
  } else {
    // Incorrect choice
    dbaFeedbackText.innerHTML = `<span style="color:var(--accent-crimson); font-weight:700">❌ [튜닝 오답]</span> ${opt.feedback}`;
    dbaFeedbackText.parentElement.style.borderColor = "rgba(239, 68, 68, 0.3)";
    dbaFeedbackText.parentElement.style.backgroundColor = "rgba(239, 68, 68, 0.05)";

    // Clear tuned values
    document.getElementById("metric-tobe-io").innerText = "-";
    document.getElementById("metric-tobe-time").innerText = "-";
    document.getElementById("metric-tobe-plan").innerText = "-";
    updateTuningPerformanceGauge(0);

    document.getElementById("btn-next-level").disabled = true;
  }
}

function updateTuningPerformanceGauge(pct) {
  const fill = document.getElementById("tuning-gauge-fill");
  const label = document.getElementById("tuning-speedup-pct");

  if (!fill || !label) return;

  label.innerText = `${pct}%`;

  // Circle circumference is 2 * PI * R where R=40 -> ~251.2
  const maxDash = 251.2;
  const offset = maxDash - (pct / 100) * maxDash;

  fill.style.strokeDashoffset = offset;
}
function showDbaCertificationAward() {
  const layout = document.querySelector(".challenge-layout");
  if (!layout) return;

  // Highlight final level button as completed
  document.querySelector(`.challenge-level-btn[data-level="4"]`).classList.add("completed");

  layout.innerHTML = `
    <div class="dba-award-panel bg-glass" style="grid-column: span 2; padding: 60px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 24px; animation: scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;">
      <div class="award-seal" style="font-size: 5rem; animation: pulseGlow 2s infinite;">🏆</div>
      <h2 style="font-family:var(--font-display); font-size: 2.2rem; background: linear-gradient(135deg, #fbbf24, #f59e0b); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">TS class DBA SQL Master</h2>
      <p style="font-size: 1rem; color:var(--color-text-muted); max-width: 600px; line-height: 1.6;">
        축하합니다! 인덱스 부재 패턴 해결, Leading Wildcard 회피, 묵시적 형변환 교정, 그리고 비효율적 대량 서브쿼리 리팩토링까지 데이터베이스의 모든 성능 이슈 진단 및 SQL 튜닝 수련 과정을 완벽히 이수하였기에 이 인증서를 부여합니다.
      </p>
      
      <div class="certification-badge" style="border: 2px dashed #f59e0b; padding: 20px 40px; border-radius: 12px; background-color: rgba(245, 158, 11, 0.05); margin: 20px 0;">
        <span style="display:block; font-size: 0.8rem; text-transform: uppercase; color:#f59e0b; letter-spacing: 2px; font-weight:700;">TS class Certified</span>
        <span style="font-family:var(--font-mono); font-size: 1.2rem; color: #fff; font-weight:600; display:block; margin-top:8px;">DB PERFORMANCE DIAGNOSTIC MASTER</span>
      </div>
      
      <button onclick="window.location.reload()" class="btn-primary" style="padding: 12px 30px; font-size: 0.95rem;">처음부터 다시 실습하기</button>
    </div>
  `;
}

/* -------------------------------------------------------------
 * 7. AWR & ASH History Analyzer Controller
 * ------------------------------------------------------------- */
const historyData = {
  "scenario-cpu": {
    ash: [
      { time: "10:05:01", sid: "108", sqlId: "2am7xqp91h8zs", state: "ON CPU", event: "latch: shared pool", blocker: "-", type: "cpu", detail: "<b>[latch: shared pool 대기 세션]</b><br>바인드 변수가 없는 동적 SQL(문자열 이어붙이기)을 대량으로 실행하느라 발생했습니다. 쿼리가 계속 하드 파싱되면서 Shared Pool 메모리 영역을 선점하기 위한 래치(상호 배제 락)를 얻기 위해 대기하는 상태입니다." },
      { time: "10:05:02", sid: "112", sqlId: "2am7xqp91h8zs", state: "ON CPU", event: "latch: shared pool", blocker: "-", type: "cpu", detail: "<b>[latch: shared pool 대기 세션]</b><br>하드 파싱 횟수가 한계에 다다르면 CPU 사용률이 폭증하고 새로운 쿼리 파싱을 위해 메모리를 읽어 들이는 과정에서 전체 세션이 지연되기 시작합니다." },
      { time: "10:05:03", sid: "124", sqlId: "2am7xqp91h8zs", state: "ON CPU", event: "CPU time", blocker: "-", type: "cpu", detail: "<b>[CPU time 소비 세션]</b><br>데이터베이스 엔진이 디스크 I/O 없이 CPU 상에서 SQL의 컴파일 및 실행 계획 연산을 무겁게 돌리고 있는 정상 액티브 상태입니다. 하드 파싱이 많으면 이 CPU time이 시스템을 잠식합니다." },
      { time: "10:05:04", sid: "135", sqlId: "2am7xqp91h8zs", state: "ON CPU", event: "CPU time", blocker: "-", type: "cpu", detail: "<b>[CPU time 소비 세션]</b><br>해결책: 애플리케이션 프레임워크(MyBatis/JPA 등)에서 리터럴 변수 기입 대신 반드시 바인드 파라미터(# 또는 ?)를 사용하도록 즉시 변경하여 SQL 재사용률을 극대화해야 합니다." }
    ],
    awr: {
      loadProfile: [
        { name: "DB Time (s)", val: "57,600 s", desc: "<b>[DB Time]</b><br>이슈 분석 1시간(3600초) 동안 활성 세션들이 일하고 대기한 총 누적 시간의 합입니다. 현재 시스템의 CPU Core 수가 16개일 때, 1시간 최대 처리 용량은 16 * 3600 = 57,600s 입니다. 즉, <b>평균 액티브 세션(AAS)이 16에 도달해 전체 CPU 리소스의 100%를 고갈시킨 초임계 지연 상태</b>임을 증명합니다.", focus: true },
        { name: "Hard Parses /s", val: "385.2", desc: "<b>[Hard Parses (초당 하드 파싱 수)]</b><br>1초당 새로 작성되어 컴파일 연산을 거친 SQL의 수입니다. 일반적인 운영 환경은 초당 5건 미만입니다. <b>현재 385건이 매초 생성되고 있어 오라클의 파싱 서브시스템이 완전히 한계에 부딪혀 전체 DB Hang(멈춤) 직전에 이르게 되었습니다.</b> 바인드 변수가 절대적으로 누락되었습니다.", focus: true },
        { name: "Soft Parse %", val: "32.4 %", desc: "<b>[Soft Parse % (실행 계획 재사용률)]</b><br>구문 분석 트리 및 실행 계획이 Shared Pool 내에 캐싱되어 재사용된 파싱 비율입니다. <b>건전한 DB는 99% 이상을 보입니다. 32%라는 극단적인 수치는 시스템의 쿼리 68%가 매번 새 쿼리로 파싱되고 있음을 의미합니다.</b>", focus: true }
      ],
      waitEvents: [
        { name: "CPU time", pct: "85.2 %", desc: "<b>[CPU time 대기 점유율]</b><br>전체 데이터베이스 사용 시간 중 연산 처리에 쓰인 시간의 비율입니다. I/O 대기가 아닌, CPU가 100% 돌아가느라 지연이 시작되었습니다. <b>Missing Bind Variable에 의한 하드 파싱 연산 과밀이 주원인입니다.</b>", focus: true },
        { name: "latch: shared pool", pct: "10.4 %", desc: "<b>[latch: shared pool (공유 영역 래치 경합)]</b><br>Shared Pool 메모리에서 빈 영역을 탐색하고 새로운 SQL 구문 분석 트리를 삽입하려는 세션들이 래치(Lock) 획득을 위해 심각하게 대기하고 있는 현상입니다.", focus: true }
      ],
      topSql: [
        { id: "2am7xqp91h8zs", exec: "1,200,000", cpu: "42,000s", text: "SELECT name, phone FROM members WHERE member_no = 2026051801; -- (바인드 변수 누락)" }
      ]
    }
  },
  "scenario-lock": {
    ash: [
      { time: "14:32:10", sid: "205", sqlId: "8w7y1a9hzp23r", state: "WAITING", event: "enq: TX - row lock contention", blocker: "412", type: "lock", detail: "<b>[enq: TX - row lock contention 대기 세션]</b><br>이 세션은 412번 세션이 독점하고 있는 데이터 로우를 수정(UPDATE)하려다 락을 획득하지 못하고 무한히 대기하고 있는 상태입니다. 412번 세션의 트랜잭션이 끝나기 전엔 풀리지 않습니다." },
      { time: "14:32:11", sid: "218", sqlId: "8w7y1a9hzp23r", state: "WAITING", event: "enq: TX - row lock contention", blocker: "412", type: "lock", detail: "<b>[enq: TX - row lock contention 대기 세션]</b><br>동일 레코드에 대해 선행 락이 점유된 채 지속되어 다수의 후행 트랜잭션 세션들이 동시에 락 획득 대기에 빨려 들어가고 있습니다. WAS 단의 커넥션 풀 고갈로 직결됩니다." },
      { time: "14:32:12", sid: "412", sqlId: "null", state: "ON CPU (INACTIVE)", event: "Client Idle", blocker: "-", type: "wait", detail: "<b>★[최상단 Blocker 세션 - SID 412]★</b><br>현재 DML을 실행해 락을 획득했으나, COMMIT이나 ROLLBACK을 호출하지 않고 연결을 방치한 세션입니다. <b>상태가 INACTIVE인데 락 대기를 만드는 것은 전형적인 Connection Leak(커넥션 누수) 이슈</b>입니다. 비즈니스 로직 try-catch 안에서 close/commit/rollback 처리가 누락되었는지 검수해야 합니다." }
    ],
    awr: {
      loadProfile: [
        { name: "DB Time (s)", val: "22,500 s", desc: "<b>[DB Time]</b><br>1시간 누적 DB 수행시간으로, CPU 연산은 아주 적으나 대부분 세션이 락을 얻기 위해 줄줄이 대기하는 시간으로 구성되어 비효율적인 리소스 지연이 발생했음을 나타냅니다.", focus: false },
        { name: "Active Sessions (AAS)", val: "26.4", desc: "<b>[Active Sessions (평균 액티브 세션 수)]</b><br>평균 동시 가동 세션 수입니다. 평소 2.0 수준이던 활성 세션이 락 대기 병목 누적으로 인해 <b>26개까지 급증</b>했습니다. WAS의 Connection Pool 임계치를 넘겨 결국 사용자 화면에 '서버 응답 오류'를 뿌리는 원인이 됩니다.", focus: true }
      ],
      waitEvents: [
        { name: "enq: TX - row lock contention", pct: "88.0 %", desc: "<b>[enq: TX - row lock contention (트랜잭션 로우 락 경합)]</b><br>다중 세션이 동일한 행을 동시 갱신(UPDATE/DELETE)하려고 할 때 한쪽의 트랜잭션이 끝나기 전까지 무한 대기하는 무결성 잠금 이벤트입니다. <b>이 수치가 DB Time의 88%를 점유하고 있다는 것은 시스템이 정상 업무 처리를 전혀 하지 못하고 락 대기에 완전히 마비되었음</b>을 의미합니다.", focus: true },
        { name: "log file sync", pct: "8.5 %", desc: "<b>[log file sync 대기]</b><br>트랜잭션 커밋 완료 처리를 위해 Redo 로그 버퍼의 내용을 디스크에 쓰기를 기다리는 시간입니다. 트랜잭션 단위를 너무 잘게 쪼개어 무차별 COMMIT을 유발하면 지연이 상승합니다.", focus: false }
      ],
      topSql: [
        { id: "8w7y1a9hzp23r", exec: "4,500", cpu: "18,200s", text: "UPDATE accounts SET bal = bal - 100 WHERE status = 'ACTIVE';" }
      ]
    }
  }
};

function bindTextbookAccordion(headerId, contentId, iconId) {
  const header = document.getElementById(headerId);
  const content = document.getElementById(contentId);
  const icon = document.getElementById(iconId);
  if (!header || !content || !icon) return;
  header.addEventListener("click", () => {
    if (content.style.maxHeight === "0px" || content.style.maxHeight === "") {
      content.style.maxHeight = "500px";
      content.style.borderTop = "1px solid var(--border-light)";
      icon.innerHTML = "&#9650; 클릭하여 접기";
      icon.style.color = "var(--accent-orange)";
    } else {
      content.style.maxHeight = "0px";
      setTimeout(() => { content.style.borderTop = "0px solid var(--border-light)"; }, 400);
      icon.innerHTML = "&#9660; 클릭하여 펼치기";
      icon.style.color = "var(--accent-cyan)";
    }
  });
}

function bindTextbookTabs(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const tabs = container.querySelectorAll(".tbook-tab");
  const panels = container.querySelectorAll(".tbook-panel");
  tabs.forEach(tab => {
    tab.addEventListener("click", (e) => {
      e.stopPropagation(); // prevent closing accordion on tab click

      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      const target = tab.getAttribute("data-target");
      panels.forEach(p => {
        if (p.id === target) {
          p.style.display = "block";
          p.classList.add("active");
        } else {
          p.style.display = "none";
          p.classList.remove("active");
        }
      });
    });
  });
}

function initAshAnalyzer() {
  const scenarioSelect = document.getElementById("ash-scenario-select");
  const btnAsh = document.getElementById("btn-extract-ash");
  const term = document.getElementById("ash-terminal");
  const reportContainer = document.getElementById("ash-report-viewer-container");
  const explainBox = document.getElementById("ash-explain-box");

  if (!scenarioSelect || !btnAsh) return;

  // Bind Textbook Accordion & Tabs
  bindTextbookAccordion("btn-toggle-ash-textbook", "ash-textbook-content", "ash-textbook-toggle-icon");
  bindTextbookTabs("ash-textbook-container");

  btnAsh.addEventListener("click", () => {
    const key = scenarioSelect.value;
    const data = historyData[key];
    if (!data) return;

    // Terminal effect
    term.innerHTML = `<span class="terminal-prompt">SQL&gt;</span> SELECT SID, SERIAL#, SQL_ID, EVENT, SESSION_STATE, BLOCKING_SESSION <br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;FROM V$ACTIVE_SESSION_HISTORY<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;WHERE SAMPLE_TIME BETWEEN ... ;<br><br><span class="terminal-response success">ASH Buffer Query finished. Captured ${data.ash.length} active sessions from SGA memory. Mapped lock blocking paths successfully.</span>`;
    term.scrollTop = term.scrollHeight;

    // Render ASH Table
    let tableHtml = `
      <div class="report-title-section">ACTIVE SESSION HISTORY (ASH) - SGA Memory Buffer</div>
      <table class="history-table">
        <thead>
          <tr>
            <th>SAMPLE_TIME</th>
            <th>SID</th>
            <th>SQL_ID</th>
            <th>SESSION_STATE</th>
            <th>EVENT</th>
            <th>BLOCKING_SID</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.ash.forEach((row, i) => {
      let rowClass = "clickable-row";
      if (row.type === "cpu") rowClass += " highlight-warn";
      if (row.type === "lock") rowClass += " highlight-danger";
      if (row.type === "wait") rowClass += " highlight-warn";

      tableHtml += `
        <tr class="${rowClass}" data-index="${i}" data-type="ash" data-key="${key}">
          <td>${row.time}</td>
          <td><b>${row.sid}</b></td>
          <td><code>${row.sqlId}</code></td>
          <td><span class="indicator-tag tag-cpu">${row.state}</span></td>
          <td><span class="indicator-tag tag-wait">${row.event}</span></td>
          <td><b>${row.blocker}</b></td>
        </tr>
      `;
    });

    tableHtml += `
        </tbody>
      </table>
      <div class="dba-concept-box" style="font-size:0.75rem;">
        <b>💡 ASH 분석 팁</b>: 위의 표에서 강조 표시(오렌지/레드 테두리)된 임의의 세션 행을 <b>직접 클릭</b>해 보세요. 해당 세션이 당시 어떤 성능 이슈 상태였는지 정밀 역추적할 수 있습니다.
      </div>
    `;

    reportContainer.innerHTML = tableHtml;
    explainBox.querySelector(".indicator-highlight").innerText = "ASH 로드됨 (행 클릭 대기)";
    explainBox.querySelector("p").innerText = "ASH 세션 목록이 로드되었습니다. 조사하고자 하는 세션 행을 직접 클릭하면 상세 DBA 분석 소견서가 제공됩니다.";

    // Bind click events to rows
    reportContainer.querySelectorAll(".clickable-row").forEach(tr => {
      tr.addEventListener("click", () => {
        const idx = tr.getAttribute("data-index");
        const k = tr.getAttribute("data-key");
        const row = historyData[k].ash[idx];

        explainBox.querySelector(".indicator-highlight").innerText = `SID ${row.sid} 세션 진단`;
        explainBox.querySelector("p").innerHTML = `
          <b>상태:</b> ${row.state} (${row.event})<br>
          <b>실행 중인 SQL_ID:</b> <code>${row.sqlId}</code><br>
          <b>대기 블로커 SID:</b> <b>${row.blocker}</b><br><br>
          <b>[DBA 정밀 진단 소견]</b><br>
          ${row.detail}
        `;
      });
    });
  });
}

function initAwrAnalyzer() {
  const scenarioSelect = document.getElementById("awr-scenario-select");
  const btnAwr = document.getElementById("btn-extract-awr");
  const term = document.getElementById("awr-terminal");
  const reportContainer = document.getElementById("awr-report-viewer-container");
  const explainBox = document.getElementById("awr-explain-box");

  if (!scenarioSelect || !btnAwr) return;

  // Bind Textbook Accordion & Tabs
  bindTextbookAccordion("btn-toggle-awr-textbook", "awr-textbook-content", "awr-textbook-toggle-icon");
  bindTextbookTabs("awr-textbook-container");

  btnAwr.addEventListener("click", () => {
    const key = scenarioSelect.value;
    const data = historyData[key].awr;
    if (!data) return;

    // Terminal effect
    term.innerHTML = `<span class="terminal-prompt">SQL&gt;</span> @?/rdbms/admin/awrrpt.sql<br>Specify Report Format: html<br>Specify Begin Snapshot ID: 1024<br>Specify End Snapshot ID: 1025<br><br><span class="terminal-response success">Generating AWR Performance Report for 1 hour duration...<br>AWR Report written to '/tmp/awr_20260518.html'. Rendition loaded in viewer.</span>`;
    term.scrollTop = term.scrollHeight;

    // Render AWR UI
    let awrHtml = `
      <div class="report-title-section">AWR REPORT (Automatic Workload Repository)</div>
      
      <div class="code-title" style="margin-top:10px;">1. Instance Load Profile (지표 클릭)</div>
      <table class="history-table">
        <thead>
          <tr>
            <th>Metric Name</th>
            <th>Value per Second</th>
            <th>AWR Interpretation</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.loadProfile.forEach((m, i) => {
      const cls = m.focus ? "clickable-row highlight-warn" : "clickable-row";
      awrHtml += `
        <tr class="${cls}" data-index="${i}" data-section="load" data-key="${key}">
          <td><b>${m.name}</b></td>
          <td><code>${m.val}</code></td>
          <td style="font-size:0.75rem; color:var(--color-text-muted);">클릭 시 해석 보기</td>
        </tr>
      `;
    });

    awrHtml += `
        </tbody>
      </table>

      <div class="code-title" style="margin-top:15px;">2. Top Foreground Wait Events (지표 클릭)</div>
      <table class="history-table">
        <thead>
          <tr>
            <th>Wait Event</th>
            <th>% DB Time</th>
            <th>AWR Interpretation</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.waitEvents.forEach((w, i) => {
      awrHtml += `
        <tr class="clickable-row highlight-danger" data-index="${i}" data-section="wait" data-key="${key}">
          <td><b>${w.name}</b></td>
          <td><code>${w.pct}</code></td>
          <td style="font-size:0.75rem; color:var(--color-text-muted);">클릭 시 해석 보기</td>
        </tr>
      `;
    });

    awrHtml += `
        </tbody>
      </table>

      <div class="code-title" style="margin-top:15px;">3. Top SQL ordered by Elapsed Time</div>
      <table class="history-table">
        <thead>
          <tr>
            <th>SQL_ID</th>
            <th>Executions</th>
            <th>CPU Time</th>
            <th>SQL Snippet</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.topSql.forEach(s => {
      awrHtml += `
        <tr>
          <td><code>${s.id}</code></td>
          <td>${s.exec}</td>
          <td>${s.cpu}</td>
          <td style="font-size:0.7rem; color:var(--accent-emerald); font-family:var(--font-mono);">${s.text}</td>
        </tr>
      `;
    });

    awrHtml += `
        </tbody>
      </table>
    `;

    reportContainer.innerHTML = awrHtml;
    explainBox.querySelector(".indicator-highlight").innerText = "AWR 리포트 로드됨";
    explainBox.querySelector("p").innerText = "AWR 리포트 요약본이 생성되었습니다. 표 내부의 Load Profile 또는 Wait Events 행을 클릭하면 DBA 핵심 해석 보고서가 로드됩니다.";

    // Bind click events
    reportContainer.querySelectorAll(".clickable-row").forEach(tr => {
      tr.addEventListener("click", () => {
        const sec = tr.getAttribute("data-section");
        const idx = tr.getAttribute("data-index");
        const k = tr.getAttribute("data-key");

        let item = null;
        if (sec === "load") {
          item = historyData[k].awr.loadProfile[idx];
          explainBox.querySelector(".indicator-highlight").innerText = `${item.name} 지표 해석`;
          explainBox.querySelector("p").innerHTML = item.desc;
        } else {
          item = historyData[k].awr.waitEvents[idx];
          explainBox.querySelector(".indicator-highlight").innerText = `${item.name} 대기 해석`;
          explainBox.querySelector("p").innerHTML = item.desc;
        }
      });
    });
  });
}

/* -------------------------------------------------------------
 * 8. Performance Diagnosis Quiz Controller (ASH & AWR)
 * ------------------------------------------------------------- */
const quizQuestions = {
  1: {
    qNum: 1,
    title: "SGA Shared Pool latch: shared pool & mutex 경합",
    desc: "AWR 스냅샷 리포트에서 Top Wait Events를 분석한 결과, 'latch: shared pool' 대기시간이 전체 DB 대기의 72%를 차지하고 있으며 CPU 사용량이 98%에 도달했습니다. 동시에 ASH 분석 시 다수의 액티브 세션이 서로 다른 SQL ID를 생성하며 대기 상태에 머물러 있는 것이 발견되었습니다. 이 병목의 근본적인 메커니즘과 이를 완화하기 위한 올바른 튜닝 방법은 무엇입니까?",
    scenario: `<strong>[AWR snapshot Report - Top 5 Timed Foreground Wait Events]</strong>
<pre style="background:rgba(0,0,0,0.15); padding:10px; border-radius:6px; font-family:var(--font-mono); font-size:0.75rem; color:var(--color-text-main); margin-top:8px; border:1px solid var(--border-light); overflow-x:auto;">
Event                         Waits    Time(s)   Avg Wait(ms)   % DB time
----------------------------  -------  --------  ------------   ---------
latch: shared pool            894,221    4,892          5.47        72.1%
CPU time                                 1,210                      17.8%
db file sequential read        42,109      412          9.78         6.1%
</pre>
<strong style="margin-top:10px; display:block;">[ASH active session status]</strong>
<div style="font-size:0.8rem; color:var(--color-text-muted); margin-top:4px; line-height:1.5;">
• <strong>Active Sessions:</strong> 124 Sessions waiting on 'latch: shared pool' / Mutex.<br>
• <strong>SQL Text Pattern:</strong> <code>SELECT name, price FROM products WHERE category = 'ELECTRONICS' AND product_id = [LITERAL_CONST]</code>
</div>`,
    options: [
      {
        id: "q1-opt-A",
        title: "SGA Shared Pool 메모리 크기(shared_pool_size)를 4배로 강제 증설",
        desc: "Shared Pool 영역이 비대해지면 리터럴 상수 SQL 등록 공간이 넓어져 CPU Latch 부하가 하드웨어적으로 상쇄될 수 있습니다.",
        isCorrect: false,
        feedback: "오답입니다. 리터럴 SQL에 의한 하드 파싱이 심할 때 Shared Pool의 크기만 키우면, 탐색해야 할 해시 버킷 메모리 체인이 더 길어져 Latch 탐색 시간(CPU 사용량)이 오히려 폭증하는 아키텍처적 부작용을 야기합니다. 반드시 SQL 파싱 아키텍처를 교체해야 합니다."
      },
      {
        id: "q1-opt-B",
        title: "SQL을 바인드 변수(:bind_id) 방식으로 재설계하여 실행 계획 재사용 유도",
        desc: "상수 값을 바인드 변수 플레이스홀더로 대체하여 최초 1회만 하드 파싱(Hard Parse)하고 이후에는 Library Cache에 적재된 동일 실행 계획을 소프트 파싱(Soft Parse)으로 100% 재사용하게 유도합니다.",
        isCorrect: true,
        feedback: "정답입니다! 리터럴 쿼리는 값이 다를 때마다 독립적인 SQL ID를 갖게 되어 매번 새로운 하드 파싱을 부르고 Library Cache Mutex 경합을 초래합니다. 바인드 변수화는 실행 계획을 SGA 영역 내에서 즉각 재사용하게 만들어 Shared Pool Latch 경합을 원천 제로화하는 가장 이상적인 접근법입니다."
      },
      {
        id: "q1-opt-C",
        title: "category와 product_id 컬럼에 Bitmap Index를 추가하여 인덱스 스캔 효율화",
        desc: "인덱스 검색 자체를 최적화하여 쿼리 실행 속도를 극대화하고 하드 파싱 부하를 CPU 파워로 제어합니다.",
        isCorrect: false,
        feedback: "오답입니다. 하드 파싱 병목은 데이터 디스크 검색(I/O)이 아닌 SQL 컴파일 및 실행 계획을 메모리에 등록하는 Shared Pool 영역에서 발생하는 경합입니다. 디스크 레벨의 인덱스 튜닝은 파싱 부하를 전혀 완화하지 못합니다."
      }
    ]
  },
  2: {
    qNum: 2,
    title: "AWR enq: TX - row lock contention (세션 블로킹)",
    desc: "특정 배치 거래 및 온라인 주문 변경 시간에 AWR의 Top Wait Event 중 'enq: TX - row lock contention' 대기가 급격하게 증가했습니다. ASH 상세 분석 결과, 수많은 주문 업데이트 세션들이 특정 세션에 의해 지속적으로 블로킹(Blocking) 당하고 있으며, 대기 시간의 대부분이 외래키(Foreign Key)가 설정된 자식 테이블(ORDER_DETAILS) 갱신 시 발생하는 것으로 관찰되었습니다. 어떤 DB 구조학적 조치가 이 락 병목을 해소하는 열쇠입니까?",
    scenario: `<strong>[AWR snapshot Report - Top Wait Events]</strong>
<pre style="background:rgba(0,0,0,0.15); padding:10px; border-radius:6px; font-family:var(--font-mono); font-size:0.75rem; color:var(--color-text-main); margin-top:8px; border:1px solid var(--border-light); overflow-x:auto;">
Event                         Waits    Time(s)   Avg Wait(ms)   % DB time
----------------------------  -------  --------  ------------   ---------
enq: TX - row lock contention  14,882    9,812        659.32        84.8%
db file sequential read        89,201      814          9.12         7.0%
</pre>
<strong style="margin-top:10px; display:block;">[ASH Lock session details]</strong>
<div style="font-size:0.8rem; color:var(--color-text-muted); margin-top:4px; line-height:1.5;">
• <strong>Blocked Sessions:</strong> Session 142 blocked by Session 158 waiting on <code>enq: TX - row lock contention</code>.<br>
• <strong>Relation:</strong> <code>ORDERS</code> (Parent Table) ↔ <code>ORDER_DETAILS</code> (Child Table, FK constraint exists).
</div>`,
    options: [
      {
        id: "q2-opt-A",
        title: "주문 상세 테이블(ORDER_DETAILS)의 외래키(FK) 컬럼에 missing 인덱스 생성",
        desc: "Oracle 환경에서 외래키(FK) 컬럼에 인덱스가 누락된 경우, 부모 테이블의 데이터 삭제/수정 시 자식 테이블 전체에 강력한 테이블 락(Table Share Lock)이 걸려 대량의 세션 블로킹과 데드락을 야기하게 되므로 이를 차단합니다.",
        isCorrect: true,
        feedback: "정답입니다! 오라클 아키텍처의 가장 대표적인 Gotcha(함정) 중 하나입니다. 외래키(FK) 컬럼에 인덱스가 설계 누락되면, 부모 테이블을 DML 조작할 때 자식 테이블 전체에 Lock이 걸려 엄청난 `enq: TX - row lock contention` 경합을 유발합니다. 외래키 인덱스 생성만으로 테이블 락을 행 레벨 락으로 완화하여 모든 경합이 완벽히 정화됩니다."
      },
      {
        id: "q2-opt-B",
        title: "Undo Tablespace 영역 크기를 2배로 확장하고 UNDO_RETENTION 시간 증가",
        desc: "트랜잭션 락 정보가 UNDO 블록에 과다하게 쌓여 발생한 문제일 수 있으므로 롤백 및 동시성 영역을 넉넉히 확장해 줍니다.",
        isCorrect: false,
        feedback: "오답입니다. Undo 영역은 읽기 일관성(Read Consistency)과 트랜잭션 롤백 데이터 보관소입니다. 세션 간에 물리적인 데이터 행(Row) 혹은 테이블 락 충돌로 인해 대기하는 TX 락 현상은 Undo 영역 크기와 전혀 무관합니다."
      },
      {
        id: "q2-opt-C",
        title: "ALTER SYSTEM FLUSH SHARED_POOL 명령어를 실행하여 SQL 캐시 즉각 정제",
        desc: "Shared Pool 영역에 등록된 오래된 트랜잭션 락 핸들과 실행계획 캐시를 날려서 동시성 락을 초기화합니다.",
        isCorrect: false,
        feedback: "오답입니다. Shared Pool을 강제로 비우는 명령어(Flush)는 현재 락 대기 중인 트랜잭션 상태를 해제하지 못할 뿐더러, 시스템 내 모든 실행계획을 유실시켜 대규모 '하드 파싱 폭증(Hard Parse CPU Spike)' 장애를 추가로 촉발하는 위험천만한 시도입니다."
      }
    ]
  },
  3: {
    qNum: 3,
    title: "db file sequential read 대기 이벤트 튜닝",
    desc: "AWR 리포트 및 성능 대시보드 분석 시 'db file sequential read' 대기 이벤트가 비정상적으로 높고, 특정 쿼리의 I/O 소모량이 급격히 늘어난 것이 확인되었습니다. ASH 상에서 해당 쿼리는 매번 5,000만 건 규모의 매출 내역 테이블(SALES)을 대상으로 'TABLE ACCESS FULL' 스캔을 진행하고 있으며 중첩 루프 조인(Nested Loops Join)의 내부 드라이빙 테이블로 사용되고 있습니다. 이를 개선하기 위한 최선의 튜닝 방안은?",
    scenario: `<strong>[AWR snapshot Report - Timed Events]</strong>
<pre style="background:rgba(0,0,0,0.15); padding:10px; border-radius:6px; font-family:var(--font-mono); font-size:0.75rem; color:var(--color-text-main); margin-top:8px; border:1px solid var(--border-light); overflow-x:auto;">
Event                         Waits    Time(s)   Avg Wait(ms)   % DB time
----------------------------  -------  --------  ------------   ---------
db file sequential read       458,211    8,210          17.92       78.4%
db file scattered read         89,102      894          10.03        8.5%
</pre>
<strong style="margin-top:10px; display:block;">[ASH SQL Execution Info]</strong>
<div style="font-size:0.8rem; color:var(--color-text-muted); margin-top:4px; line-height:1.5;">
• <strong>SQL:</strong> <code>SELECT * FROM sales s WHERE s.sale_date = :b1 AND s.store_id = :b2</code><br>
• <strong>Wait Event:</strong> <code>db file sequential read</code> (Single-Block I/O read wait).<br>
• <strong>Plan details:</strong> <code>TABLE ACCESS FULL (sales)</code> inside a Nested Loops outer driving join.
</div>`,
    options: [
      {
        id: "q3-opt-A",
        title: "sales 테이블의 Full Scan을 강제하기 위해 FULL(s) 힌트 강제 삽입",
        desc: "Multi-Block I/O를 적극 활용하는 Scattered Read 스캔을 강제하여 싱글블록 I/O 대기시간(db file sequential read)을 회피합니다.",
        isCorrect: false,
        feedback: "오답입니다. 5,000만 건 대용량 테이블에 FULL 스캔 힌트를 적용하면, scattered read 대기 이벤트로 이름만 바뀔 뿐 디스크를 수십 기가바이트씩 쓸어 담는 최악의 디스크 병목과 메모리 버퍼 캐시 밀어내기 장애를 부추기게 됩니다."
      },
      {
        id: "q3-opt-B",
        title: "sales 테이블에 결합 인덱스(sale_date, store_id)를 생성하여 Index Range Scan으로 전환",
        desc: "조건절 필터 컬럼들로 최적의 결합 인덱스를 구성하여 Full Table Scan을 고성능 싱글블록 인덱스 범위 스캔(Index Range Scan) 및 테이블 부분 탐색으로 전환해 탐색 블록 수를 수만 분의 1로 경감합니다.",
        isCorrect: true,
        feedback: "정답입니다! db file sequential read는 인덱스나 RowID를 통해 싱글 블록을 디스크에서 무작위로 읽을 때 발생합니다. 대용량 테이블을 루프 내에서 Full Scan하게 되면 매 건마다 전체 테이블 블록을 싱글블록 단위로 무수히 재탐색하므로 최악의 병목이 발생합니다. 적절한 결합인덱스 구성으로 탐색 블록 자체를 줄이는 것이 궁극적인 해결책입니다."
      },
      {
        id: "q3-opt-C",
        title: "조인 방식을 Hash Join에서 Nested Loops Join으로 강제 전환",
        desc: "대형 드라이빙 조인 구조를 위해 해시 조인 연산을 억제하고 Nested Loops 조인 힌트를 주어 메모리 해시 연산 부하를 최소화합니다.",
        isCorrect: false,
        feedback: "오답입니다. 대용량 조인 대기 병목에서 오히려 Nested Loops Join은 내부 루프(Inner Loop)의 Full Table Scan 횟수만큼 디스크 싱글 블록 읽기를 기하급수적으로 유발하여 대기 이벤트를 파국 수준으로 증가시키는 원흉입니다. 오히려 Hash Join으로 결합했어야 조인이 매끄러워집니다."
      }
    ]
  }
};

let currentQuizQ = 1;
let selectedQuizOptId = null;
let answeredQuestionsState = {};

function initQuizPanel() {
  const tabBtns = document.querySelectorAll(".quiz-tab-btn");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => {
        b.style.background = "transparent";
        b.style.borderColor = "transparent";
        b.style.color = "var(--color-text-muted)";
        b.style.fontWeight = "500";
        b.classList.remove("active");
      });
      btn.style.background = "rgba(6, 182, 212, 0.1)";
      btn.style.borderColor = "rgba(6, 182, 212, 0.25)";
      btn.style.color = "var(--accent-cyan)";
      btn.style.fontWeight = "700";
      btn.classList.add("active");

      const qNum = parseInt(btn.getAttribute("data-q")) || 1;
      loadQuizQuestion(qNum);
    });
  });

  document.getElementById("btn-submit-quiz").onclick = submitQuizAnswer;

  loadQuizQuestion(1);
}

function loadQuizQuestion(qNum) {
  currentQuizQ = qNum;
  const data = quizQuestions[qNum];
  if (!data) return;

  const questionBox = document.getElementById("quiz-question-box");
  questionBox.innerHTML = `
    <h3 style="margin: 0 0 10px 0; color: var(--color-text-main); font-size: 1.1rem; font-weight: 700;">
      Q${qNum}. ${data.title}
    </h3>
    <p style="margin: 0 0 16px 0; font-size: 0.88rem; color: var(--color-text-muted); line-height: 1.6;">
      ${data.desc}
    </p>
    <div class="scenario-box bg-glass" style="border: 1px solid var(--border-light); border-radius: 8px; padding: 16px; margin-bottom: 20px;">
      ${data.scenario}
    </div>
  `;

  const optionsBox = document.getElementById("quiz-options-box");
  optionsBox.innerHTML = '';

  const savedState = answeredQuestionsState[qNum];
  selectedQuizOptId = savedState ? savedState.selectedId : null;

  data.options.forEach(opt => {
    const div = document.createElement("div");
    div.className = "tuning-option";
    if (selectedQuizOptId === opt.id) {
      div.classList.add("selected");
    }
    div.setAttribute("data-opt-id", opt.id);
    div.style.border = "1px solid var(--border-light)";
    div.style.borderRadius = "8px";
    div.style.padding = "14px";
    div.style.cursor = "pointer";
    div.style.transition = "all 0.2s";

    div.onclick = () => {
      if (savedState && savedState.submitted) return;
      document.querySelectorAll("#quiz-options-box .tuning-option").forEach(o => o.classList.remove("selected"));
      div.classList.add("selected");
      selectedQuizOptId = opt.id;
    };

    div.innerHTML = `
      <div style="font-weight: 700; color: var(--color-text-main); font-size: 0.9rem; margin-bottom: 4px;">
        ${opt.title}
      </div>
      <div style="font-size: 0.8rem; color: var(--color-text-muted); line-height: 1.4;">
        ${opt.desc}
      </div>
    `;
    optionsBox.appendChild(div);
  });

  const feedbackBox = document.getElementById("quiz-feedback-box");
  if (savedState && savedState.submitted) {
    displayQuizFeedback(qNum, savedState.selectedId);
  } else {
    feedbackBox.style.display = "none";
    document.getElementById("btn-submit-quiz").style.display = "block";
  }
}

function submitQuizAnswer() {
  if (!selectedQuizOptId) {
    alert("원하시는 진단 소견(답안)을 선택해 주세요!");
    return;
  }

  answeredQuestionsState[currentQuizQ] = {
    selectedId: selectedQuizOptId,
    submitted: true
  };

  displayQuizFeedback(currentQuizQ, selectedQuizOptId);
}

function displayQuizFeedback(qNum, selectedId) {
  const data = quizQuestions[qNum];
  const opt = data.options.find(o => o.id === selectedId);
  if (!opt) return;

  const feedbackBox = document.getElementById("quiz-feedback-box");
  const badge = document.getElementById("quiz-result-badge");
  const title = document.getElementById("quiz-result-title");
  const desc = document.getElementById("quiz-result-desc");

  feedbackBox.style.display = "flex";
  document.getElementById("btn-submit-quiz").style.display = "none";

  if (opt.isCorrect) {
    badge.innerText = "진단 성공";
    badge.style.background = "rgba(16, 185, 129, 0.15)";
    badge.style.color = "var(--accent-emerald)";
    feedbackBox.style.borderLeftColor = "var(--accent-emerald)";
    title.innerText = "올바른 DBA 성능 조치안입니다!";
    title.style.color = "var(--accent-emerald)";
  } else {
    badge.innerText = "진단 오류";
    badge.style.background = "rgba(239, 68, 68, 0.15)";
    badge.style.color = "#f87171";
    feedbackBox.style.borderLeftColor = "#ef4444";
    title.innerText = "주의: 잘못된 진단 접근입니다.";
    title.style.color = "#f87171";
  }

  desc.innerHTML = opt.feedback;
}

