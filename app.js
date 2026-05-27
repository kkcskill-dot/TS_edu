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
  initPlanDiagLab();
  initJoinLab();

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
    if (currentLevel < 6) {
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
    if (lvl === 6) {
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
  },
  4: {
    qNum: 4,
    title: "AWR log file sync 대기 이벤트 튜닝 (Commit frequency 최적화)",
    desc: "AWR snapshot 분석 결과, 'log file sync' 대기 시간이 전체 데이터베이스 성능 대기의 82%를 점유하고 있으며, 애플리케이션의 트랜잭션 대기 시간이 급증하고 있습니다. ASH를 상세 분석한 결과, 대용량 데이터를 처리하는 배치 프로그램들이 동작 중이며 루프 내부에서 데이터가 삽입/변경될 때마다 매 행마다 COMMIT을 실행하고 있는 것이 관찰되었습니다. 이 병목을 해결하기 위한 가장 타당한 조치는 무엇입니까?",
    scenario: `<strong>[AWR snapshot Report - Top Wait Events]</strong>
<pre style="background:rgba(0,0,0,0.15); padding:10px; border-radius:6px; font-family:var(--font-mono); font-size:0.75rem; color:var(--color-text-main); margin-top:8px; border:1px solid var(--border-light); overflow-x:auto;">
Event                         Waits    Time(s)   Avg Wait(ms)   % DB time
----------------------------  -------  --------  ------------   ---------
log file sync                 345,918    9,567          27.65       82.1%
log file parallel write       310,211    2,109           6.79       18.0%
db file sequential read        12,901       92           7.13        0.8%
</pre>
<strong style="margin-top:10px; display:block;">[ASH Transaction execution profile]</strong>
<div style="font-size:0.8rem; color:var(--color-text-muted); margin-top:4px; line-height:1.5;">
• <strong>Wait Event:</strong> <code>log file sync</code> (Waiting for LGWR to write redo log).<br>
• <strong>Transaction details:</strong> <code>INSERT INTO history_log VALUES (...)</code> followed by immediate <code>COMMIT</code> in a loop of 100,000 iterations.
</div>`,
    options: [
      {
        id: "q4-opt-A",
        title: "온라인 Redo Log File의 용량을 기존 50MB에서 500MB로 확장",
        desc: "로그 파일 크기를 증설하여 로그 스위치(Log Switch)와 체크포인트 주기 자체를 줄여 디스크 플러시 효율을 향상시킵니다.",
        isCorrect: false,
        feedback: "오답입니다. 온라인 Redo Log 파일의 크기를 키우면 로그 스위치 횟수는 감소하여 Checkpoint 부하는 다소 낮출 수 있으나, 개별 트랜잭션이 완료될 때 호출하는 동기식 커밋 대기(`log file sync`)는 여전히 동기적인 Redo Log 쓰기 완료를 대기하므로 성능 개선 효과가 거의 없습니다."
      },
      {
        id: "q4-opt-B",
        title: "애플리케이션 배치 로직을 튜닝하여 1,000건 내지 5,000건 단위로 묶음(Batch) 커밋하도록 코드 리팩토링",
        desc: "매 행마다 진행되던 동기식 COMMIT 횟수를 대폭 억제하여 LGWR(Log Writer)의 물리 디스크 I/O 동기화 대기 부하를 근본적으로 제거합니다.",
        isCorrect: true,
        feedback: "정답입니다! `log file sync` 대기 이벤트는 사용자 세션이 `COMMIT`을 날릴 때, LGWR이 메모리(Redo Log Buffer)에 적재된 로그 데이터를 디스크의 Redo Log 파일로 안전하게 기록하는 과정에서 발생합니다. 루프 내 매 건마다 커밋을 수행하면 디스크 I/O 응답 속도가 전체 트랜잭션 속도를 제약하는 최악의 병목이 됩니다. 배치 단위를 설정하여 묶음 커밋을 처리하면 성능이 수십 배 이상 크게 향상됩니다."
      },
      {
        id: "q4-opt-C",
        title: "Redo Log Buffer 메모리 크기(LOG_BUFFER)를 8MB에서 128MB로 크게 확장",
        desc: "메모리 적재 용량을 극대화하여 LGWR이 디스크에 내려쓰는 횟수 자체를 메모리 레벨에서 완화시킵니다.",
        isCorrect: false,
        feedback: "오답입니다. 로그 버퍼가 아무리 크더라도 사용자가 `COMMIT`을 실행하는 순간 LGWR은 데이터 보호를 위해 즉각 동기식 I/O를 수행해야 하므로 `log file sync` 대기시간은 줄어들지 않습니다. 로그 버퍼 크기 조절은 트랜잭션 도중 발생하는 `log buffer space` 대기를 해소하는 대안입니다."
      }
    ]
  },
  5: {
    qNum: 5,
    title: "AWR direct path read temp 대기 (PGA 정렬 영역 고갈)",
    desc: "연말 정산 및 배치 분석 처리 기간에 Top Wait Event로 'direct path read temp'와 'direct path write temp' 대기 이벤트가 임계치를 초과하여 점유하고 있습니다. 해당 작업 중인 해시 조인(Hash Join) 및 정렬(Sort) 쿼리가 극도로 느려졌으며 Temp 테이블스페이스의 디스크 점유율이 95% 이상으로 치솟았습니다. 이를 해결하기 위한 정석 조치는?",
    scenario: `<strong>[AWR snapshot Report - Top Wait Events]</strong>
<pre style="background:rgba(0,0,0,0.15); padding:10px; border-radius:6px; font-family:var(--font-mono); font-size:0.75rem; color:var(--color-text-main); margin-top:8px; border:1px solid var(--border-light); overflow-x:auto;">
Event                         Waits    Time(s)   Avg Wait(ms)   % DB time
----------------------------  -------  --------  ------------   ---------
direct path read temp          88,912    6,120          68.83       67.4%
direct path write temp         79,122    2,450          30.96       27.0%
db file sequential read        14,101      124           8.79        1.4%
</pre>
<strong style="margin-top:10px; display:block;">[ASH Temp Segment Details]</strong>
<div style="font-size:0.8rem; color:var(--color-text-muted); margin-top:4px; line-height:1.5;">
• <strong>Wait Event:</strong> <code>direct path read/write temp</code> (Reading/Writing Temp tablespace).<br>
• <strong>Query Profile:</strong> <code>SELECT * FROM sales s JOIN customer c ON s.cust_id = c.id ORDER BY s.amount DESC</code><br>
• <strong>Execution Context:</strong> Hash Join failed to fit in memory (One-Pass/Multi-Pass join executed on disk).
</div>`,
    options: [
      {
        id: "q5-opt-A",
        title: "Hash Join을 무력화하기 위해 USE_NL 힌트를 주어 Nested Loops Join 방식으로 우회",
        desc: "메모리 소모가 심하고 Temp 영역을 사용하는 해시 조인을 지양하고 정렬이 필요 없는 루프 조인으로 구조를 전환합니다.",
        isCorrect: false,
        feedback: "오답입니다. 대용량 테이블 간의 조인(예: 수천만 건)에 Nested Loops Join을 강제하면 조인 대상 건수만큼 디스크 싱글 블록 I/O인 `db file sequential read`가 수백만 번 유발되어 시스템이 완전히 응답 불능 상태에 빠지게 됩니다."
      },
      {
        id: "q5-opt-B",
        title: "PGA Aggregate Target (pga_aggregate_target) 메모리 설정을 확장하여 인메모리(In-Memory) 해시 조인을 보장",
        desc: "정렬 및 해시 조인 수행을 위한 세션 메모리(PGA) 영역을 늘려, 데이터가 디스크 Temp 영역으로 밀려나는 Out-of-Core 연산을 방지합니다.",
        isCorrect: true,
        feedback: "정답입니다! 정렬 연산이나 해시 조인을 수행할 때 세션별로 사용할 수 있는 PGA 메모리 크기가 부족하면, 메모리 안에서 연산을 완료하지 못하고 디스크(Temp Tablespace)에 임시 세그먼트를 만들어 쓰고 읽는(Direct Path Temp I/O) 물리 스왑 연산이 수행됩니다. 디스크 I/O 속도는 메모리 연산에 비해 수백 배 느리므로, `pga_aggregate_target` 설정을 확장하여 최대한 메모리 내에서 조인이 완성되도록(Optimal Pass) 조치하는 것이 가장 정확한 튜닝입니다."
      },
      {
        id: "q5-opt-C",
        title: "Temp Tablespace 데이터 파일(tempfile)의 물리적 갯수를 늘려 디스크 IO 대기 회피",
        desc: "Temp 테이블스페이스의 물리 파일을 추가하여 I/O 성능을 병렬적으로 분산시킵니다.",
        isCorrect: false,
        feedback: "오답입니다. Temp 테이블스페이스 파일 추가는 디스크 가득 참으로 인한 쿼리 취소 에러(ORA-01652)를 막아주는 대비책일 뿐, 메모리 연산이 디스크 Temp 연산으로 밀려나서 발생하는 근본적인 'direct path temp I/O' 속도 저하를 막지는 못합니다."
      }
    ]
  },
  6: {
    qNum: 6,
    title: "RAC 환경 gc current block 3-way 대기 이벤트 (Cluster Cache Fusion)",
    desc: "오라클 RAC(Real Application Clusters) 3노드 Active-Active 환경에서, 특정 이벤트 응모 시간대에 CPU 가용률이 0%에 근접하며 DB 전체가 먹통이 되었습니다. AWR의 Top Wait Event 분석 시 'gc current block 3-way' 및 'gc current block 2-way'가 전체 대기 시간의 90%를 점유하고 있습니다. ASH 상세 분석 결과, 모든 노드의 세션들이 동일한 이벤트 이력 테이블(EVENT_HISTORY)의 PK값 생성을 위해 시퀀스(Sequence)를 호출하는 과정에서 특정 블록에 대한 갱신 권한을 뺏고 빼앗기는 중인 것으로 확인되었습니다. 이 클러스터 병목의 근본 원인을 해결하기 위한 구조적 튜닝 기법은?",
    scenario: `<strong>[AWR snapshot Report - Top Cluster Wait Events]</strong>
<pre style="background:rgba(0,0,0,0.15); padding:10px; border-radius:6px; font-family:var(--font-mono); font-size:0.75rem; color:var(--color-text-main); margin-top:8px; border:1px solid var(--border-light); overflow-x:auto;">
Event                         Waits    Time(s)   Avg Wait(ms)   % DB time
----------------------------  -------  --------  ------------   ---------
gc current block 3-way        821,411   15,221         18.53        72.3%
gc current block 2-way        412,019    3,892          9.44        18.1%
latch: row cache objects       42,109      824         19.56         7.1%
</pre>
<strong style="margin-top:10px; display:block;">[ASH Instance Contention details]</strong>
<div style="font-size:0.8rem; color:var(--color-text-muted); margin-top:4px; line-height:1.5;">
• <strong>Cluster Wait:</strong> Inter-instance block transfer via Cache Fusion.<br>
• <strong>Sequence Definition:</strong> <code>CREATE SEQUENCE seq_event_id START WITH 1 INCREMENT BY 1 CACHE 20 ORDER;</code><br>
• <strong>Hot Block:</strong> Index Leaf Block of <code>EVENT_HISTORY_PK</code> index segment.
</div>`,
    options: [
      {
        id: "q6-opt-A",
        title: "시퀀스 설정에서 CACHE 크기를 1,000 이상으로 늘리고 ORDER 옵션을 NOORDER로 변경",
        desc: "각 인스턴스(노드)가 사용할 번호 대역을 미리 메모리에 크게 할당하고, 순번의 노드 간 동기화 정렬 요구사항(ORDER)을 해제하여 노드 간의 빈번한 데이터 블록 교환 대기를 해제합니다.",
        isCorrect: true,
        feedback: "정답입니다! RAC 환경에서 'gc(Global Cache) current block'은 다른 인스턴스가 갱신 중인 최신 상태의 블록을 요청할 때 발생합니다. 특히 시퀀스에 캐시를 작게(예: CACHE 20) 잡거나 `ORDER`를 설정하면, 매번 새로운 번호를 부여하고 순서를 맞추기 위해 인스턴스 간에 락 권한(Exclusive)을 네트워크를 통해 끊임없이 뺏고 빼앗기게 됩니다(Cache Fusion 병목). 캐시를 늘리고 `NOORDER`로 바꾸면 각 노드가 독립적으로 번호를 받아 블록 갱신 주기 자체가 분산되므로 gc 경합이 극적으로 사라집니다."
      },
      {
        id: "q6-opt-B",
        title: "이력 테이블의 PK 인덱스 구성을 Reverse Key Index로 재정의하여 탐색 분산",
        desc: "일련번호가 사전순으로 들어오는 것을 역순으로 변환하여 리프 블록 경합을 물리적으로 분산시킵니다.",
        isCorrect: false,
        feedback: "오답입니다. Reverse Key Index는 순차 삽입 시 발생하는 리프 블록 경합(`enq: TX - index contention` 등)을 해소하는 데 도움을 주지만, 이 문제는 시퀀스 딕셔너리 정보 및 시퀀스 캐시 블록 획득에 따른 클러스터 락 경합이 근본적 원인이므로 시퀀스 설정을 개선하지 않는 한 효과를 거둘 수 없으며, 범위 검색(Range Scan)을 불가능하게 만들어 다른 쿼리 성능을 저하시킵니다."
      },
      {
        id: "q6-opt-C",
        title: "각 노드의 파이버 채널(FC) HBA 카드 및 네트워크 스위치 하드웨어를 10Gbps에서 100Gbps로 대폭 업그레이드",
        desc: "인스턴스 간 통신 대역폭을 물리적으로 확장하여 블록 전송 지연 시간(Avg Wait ms)을 하드웨어 성능으로 소멸시킵니다.",
        isCorrect: false,
        feedback: "오답입니다. 하드웨어 네트워크 대역폭 업그레이드는 지연 시간을 미세하게 단축시킬 뿐, 1초에 수만 번 발생하는 노드 간 상호 배타적 락(Lock) 경합 및 데이터 정기 스레드 동기화 오버헤드를 완화하지 못하며 비용 낭비에 가깝습니다."
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

/* -------------------------------------------------------------
 * 9. Plan Diagnosis Lab (플랜 진단 실습)
 * ------------------------------------------------------------- */
function initPlanDiagLab() {
  const scenarioData = {
    stale_stats: {
      sql: `SELECT o.order_id, u.name
FROM orders o JOIN users u ON o.user_id = u.id
WHERE o.order_date = '2026-05-18';`,
      plan: [
        { id: 0, operation: "SELECT STATEMENT",       depth: 0, eRows: "",       aRows: "",       buffers: "",     starts: 1 },
        { id: 1, operation: "NESTED LOOPS",            depth: 1, eRows: "15",     aRows: "12,450", buffers: "38,210", starts: 1 },
        { id: 2, operation: " TABLE ACCESS BY ROWID",  depth: 2, eRows: "15",     aRows: "12,450", buffers: "37,980", starts: 250 },
        { id: 3, operation: "  INDEX RANGE SCAN",      depth: 3, eRows: "15",     aRows: "12,450", buffers: "1,240",  starts: 250 },
        { id: 4, operation: " TABLE ACCESS BY ROWID",  depth: 2, eRows: "1",      aRows: "1",      buffers: "230",    starts: 250 },
        { id: 5, operation: "  INDEX UNIQUE SCAN",     depth: 3, eRows: "1",      aRows: "1",      buffers: "230",    starts: 250 },
      ],
      bottleneck: 3,
      scoreCorrect: 100,
      scoreWrong: 20,
      math: `<strong>오차율 산출 (INDEX RANGE SCAN):</strong><br>
E-Rows = 15,  A-Rows = 12,450<br>
<span style="color:var(--ij-keyword);">오차 비율 = |A-Rows - E-Rows| / E-Rows × 100</span><br>
= |12,450 - 15| / 15 × 100 = <strong style="color:var(--ij-error);">82,900%</strong><br><br>
→ 통계 수집 이후 데이터가 대폭 증가했으나 통계가 갱신되지 않아<br>
&nbsp;&nbsp;옵티마이저가 15건으로 추정 → 실제 12,450건 반환됨<br>
→ NL 조인이 선택되었으나 대량 데이터로 인해 버퍼 I/O 폭증`,
      feedback: `<strong>근본 원인:</strong> ORDERS 테이블의 통계가 수개월 전 수집 상태로, 신규 주문 데이터 유입이 반영되지 않았습니다.<br><br>
<strong>조치안:</strong><br>
1. <code>EXEC DBMS_STATS.GATHER_TABLE_STATS('SCHEMA', 'ORDERS', CASCADE => TRUE);</code><br>
2. E-Rows와 A-Rows 오차가 100% 미만으로 수렴하는지 재검증<br>
3. 건수 증가 추이에 따라 Hash Join 유도 검토 (USE_HASH 힌트)<br>
4. 장기적으로 자동 통계 수집 JOB 등록 권장`
    },
    no_histogram: {
      sql: `SELECT *
FROM employees
WHERE department_id = 50
  AND status = 'ACTIVE';`,
      plan: [
        { id: 0, operation: "SELECT STATEMENT",       depth: 0, eRows: "",       aRows: "",       buffers: "",     starts: 1 },
        { id: 1, operation: "TABLE ACCESS FULL",       depth: 1, eRows: "5,000",  aRows: "42",     buffers: "14,820", starts: 1 },
        { id: 2, operation: " FILTER",                 depth: 2, eRows: "5,000",  aRows: "42",     buffers: "14,820", starts: 1 },
      ],
      bottleneck: 1,
      scoreCorrect: 100,
      scoreWrong: 20,
      math: `<strong>오차율 산출 (TABLE ACCESS FULL):</strong><br>
E-Rows = 5,000,  A-Rows = 42<br>
<span style="color:var(--ij-keyword);">오차 비율 = |A-Rows - E-Rows| / max(E-Rows, 1) × 100</span><br>
= |42 - 5,000| / 5,000 × 100 = <strong style="color:var(--ij-error);">99.16%</strong><br><br>
→ status 컬럼에 히스토그램이 없어 균등 분포로 가정<br>
&nbsp;&nbsp;실제 'ACTIVE'는 전체의 0.84%만 존재 (데이터 편향)<br>
→ 옵티마이저가 Full Scan 선택 → 인덱스 활용 불가`,
      feedback: `<strong>근본 원인:</strong> STATUS 컬럼의 데이터 분포가 극도로 편향되어 있으나 (ACTIVE=0.84%, INACTIVE=99.16%), 히스토그램이 수집되지 않아 옵티마이저가 균등 분포(50/50)로 오판했습니다.<br><br>
<strong>조치안:</strong><br>
1. <code>EXEC DBMS_STATS.GATHER_TABLE_STATS('SCHEMA', 'EMPLOYEES', METHOD_OPT => 'FOR COLUMNS STATUS SIZE AUTO');</code><br>
2. STATUS + DEPARTMENT_ID 복합 인덱스 생성 검토<br>
3. <code>SELECT column_name, histogram FROM user_tab_col_statistics WHERE table_name='EMPLOYEES';</code> 로 히스토그램 유형 확인`
    },
    correlated_sub: {
      sql: `SELECT e.emp_name, e.salary
FROM employees e
WHERE e.salary > (
  SELECT AVG(salary)
  FROM employees e2
  WHERE e2.dept_id = e.dept_id
);`,
      plan: [
        { id: 0, operation: "SELECT STATEMENT",       depth: 0, eRows: "",       aRows: "",       buffers: "",      starts: 1 },
        { id: 1, operation: "FILTER",                  depth: 1, eRows: "500",    aRows: "312",    buffers: "85,400", starts: 1 },
        { id: 2, operation: " TABLE ACCESS FULL",      depth: 2, eRows: "10,000", aRows: "10,000", buffers: "1,200",  starts: 1 },
        { id: 3, operation: " SORT AGGREGATE",         depth: 2, eRows: "1",      aRows: "1",      buffers: "84,200", starts: 10000 },
        { id: 4, operation: "  TABLE ACCESS FULL",     depth: 3, eRows: "200",    aRows: "200",    buffers: "84,200", starts: 10000 },
      ],
      bottleneck: 4,
      scoreCorrect: 100,
      scoreWrong: 20,
      math: `<strong>오차율 산출 (내부 TABLE ACCESS FULL):</strong><br>
E-Rows = 200,  A-Rows = 200,  <span style="color:var(--ij-keyword);">Starts = 10,000</span><br>
<span style="color:var(--ij-keyword);">총 실행 행 = A-Rows × Starts</span><br>
= 200 × 10,000 = <strong style="color:var(--ij-error);">2,000,000 행</strong><br><br>
→ E-Rows/A-Rows 비율만 보면 정상(200=200)이지만<br>
&nbsp;&nbsp;Starts=10,000 → 상관 서브쿼리가 외부 행마다 반복 실행<br>
→ 총 I/O = 84,200 blocks (전체 비용의 98.6% 집중)`,
      feedback: `<strong>근본 원인:</strong> 상관 서브쿼리(Correlated Subquery)가 외부 테이블의 매 행(10,000건)마다 반복 실행되어 총 200만 건을 스캔합니다. E-Rows와 A-Rows는 일치하지만, Starts 값이 핵심 병목 지표입니다.<br><br>
<strong>조치안:</strong><br>
1. 스칼라 서브쿼리 → 인라인 뷰(분석 함수)로 변환:<br>
<code>SELECT emp_name, salary FROM (
  SELECT emp_name, salary,
    AVG(salary) OVER (PARTITION BY dept_id) AS avg_sal
  FROM employees
) WHERE salary > avg_sal;</code><br>
2. 이 방식으로 Full Scan 1회 + Window Sort 1회로 감소<br>
3. Starts 값이 1로 변경되는지 XPLAN 재검증 필수`
    }
  };

  let currentScenarioKey = "stale_stats";

  function renderScenario(key) {
    currentScenarioKey = key;
    const s = scenarioData[key];

    // Update SQL display
    document.getElementById("plan-diag-sql").textContent = s.sql;

    // Update active button (original site theme)
    document.querySelectorAll(".btn-plan-diag-scenario").forEach(btn => {
      if (btn.dataset.scenario === key) {
        btn.style.border = "1px solid var(--accent-cyan)";
        btn.style.background = "rgba(6, 182, 212, 0.15)";
        btn.style.color = "var(--accent-cyan)";
        btn.classList.add("active");
      } else {
        btn.style.border = "1px solid var(--border-light)";
        btn.style.background = "transparent";
        btn.style.color = "var(--color-text-muted)";
        btn.classList.remove("active");
      }
    });

    // Render plan table
    const container = document.getElementById("plan-diag-table-container");
    let html = `<table class="ij-plan-table">
      <thead>
        <tr>
          <th>Id</th>
          <th>Operation</th>
          <th class="r">E-Rows</th>
          <th class="r">A-Rows</th>
          <th class="r">Buffers</th>
          <th class="r">Starts</th>
        </tr>
      </thead>
      <tbody>`;

    s.plan.forEach(row => {
      const isClickable = row.eRows !== "" && row.aRows !== "";
      html += `<tr data-row-id="${row.id}" class="${isClickable ? 'clickable plan-diag-row' : ''}">
        <td class="col-id">${row.id}</td>
        <td class="col-op">${row.operation}</td>
        <td class="r col-erows">${row.eRows}</td>
        <td class="r col-arows">${row.aRows}</td>
        <td class="r col-buf">${row.buffers}</td>
        <td class="r col-starts">${row.starts}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;

    // Add click handlers (hover via CSS)
    container.querySelectorAll(".plan-diag-row").forEach(tr => {
      tr.addEventListener("click", () => handleRowClick(parseInt(tr.dataset.rowId)));
    });

    // Reset result area
    document.getElementById("plan-diag-score").textContent = "-";
    document.getElementById("plan-diag-score").style.color = "var(--color-text-muted)";
    document.getElementById("plan-diag-math-content").innerHTML = "병목 노드를 클릭하면 수리적 오차 산출 과정이 표시됩니다.";
    document.getElementById("plan-diag-feedback").innerHTML = "시나리오를 선택하고 실행 계획의 병목 노드를 클릭하세요.";
  }

  function handleRowClick(rowId) {
    const s = scenarioData[currentScenarioKey];
    const isCorrect = rowId === s.bottleneck;

    // Highlight selected row via CSS classes
    const container = document.getElementById("plan-diag-table-container");
    container.querySelectorAll(".plan-diag-row").forEach(tr => {
      const rid = parseInt(tr.dataset.rowId);
      tr.classList.remove("ij-correct", "ij-wrong", "ij-answer-hint");
      if (rid === rowId) {
        tr.classList.add(isCorrect ? "ij-correct" : "ij-wrong");
      } else if (rid === s.bottleneck && !isCorrect) {
        tr.classList.add("ij-answer-hint");
      }
    });

    // Update score
    const score = isCorrect ? s.scoreCorrect : s.scoreWrong;
    const scoreEl = document.getElementById("plan-diag-score");
    scoreEl.textContent = score + "점";
    scoreEl.style.color = isCorrect ? "var(--accent-emerald)" : "#f87171";

    // Update math
    const mathContent = document.getElementById("plan-diag-math-content");
    if (isCorrect) {
      mathContent.innerHTML = s.math;
    } else {
      const clickedRow = s.plan.find(r => r.id === rowId);
      const correctRow = s.plan.find(r => r.id === s.bottleneck);
      mathContent.innerHTML = `<span style="color:var(--ij-error);"><strong>오답입니다.</strong></span><br><br>
선택한 노드 (Id=${rowId}): ${clickedRow ? clickedRow.operation.trim() : ''}<br>
→ 이 노드는 주요 병목 지점이 아닙니다.<br><br>
<span style="color:var(--ij-link);">힌트:</span> E-Rows와 A-Rows의 비율 차이가 가장 극단적이거나,<br>
Starts 값이 비정상적으로 큰 노드를 찾아보세요.<br>
정답 노드: <strong>Id=${s.bottleneck} (${correctRow ? correctRow.operation.trim() : ''})</strong>`;
    }

    // Update feedback
    const feedbackEl = document.getElementById("plan-diag-feedback");
    if (isCorrect) {
      feedbackEl.innerHTML = s.feedback;
    } else {
      feedbackEl.innerHTML = `선택한 노드는 병목 지점이 아닙니다. 실행 계획에서 <strong>E-Rows 대비 A-Rows 오차가 가장 크거나</strong>, <strong>Starts 값이 비정상적으로 높은</strong> 노드가 진정한 병목입니다. 다시 시도해 보세요.`;
    }
  }

  // Event listeners
  document.querySelectorAll(".btn-plan-diag-scenario").forEach(btn => {
    btn.addEventListener("click", () => renderScenario(btn.dataset.scenario));
  });

  // Initialize first scenario
  renderScenario("stale_stats");
}

/* -------------------------------------------------------------
 * 10. Join Comparison Lab (조인 비교 실험실)
 * ------------------------------------------------------------- */
function initJoinLab() {
  const DB_BLOCK_SIZE = 8192; // 8KB
  const AVG_ROW_SIZE = 100;  // bytes
  const ROWS_PER_BLOCK = Math.floor(DB_BLOCK_SIZE / AVG_ROW_SIZE); // ~81
  const IO_TIME_MS = 0.01;   // single block read ms (buffer cache)
  const HASH_OVERHEAD = 1.2; // hash build overhead factor

  function numFmt(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return n.toFixed(0);
  }

  function timeFmt(ms) {
    if (ms >= 1000) return (ms / 1000).toFixed(2) + "s";
    return ms.toFixed(1) + "ms";
  }

  function memFmt(bytes) {
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + " KB";
    return bytes + " B";
  }

  function simulate() {
    const drivingRows = parseInt(document.getElementById("join-lab-driving-rows").value);
    const drivenRows  = parseInt(document.getElementById("join-lab-driven-rows").value);
    const hasIndex    = document.getElementById("join-lab-index").value === "yes";
    const BLEVEL = 2;

    const drivingBlocks = Math.ceil(drivingRows / ROWS_PER_BLOCK);
    const drivenBlocks  = Math.ceil(drivenRows / ROWS_PER_BLOCK);

    // --- Nested Loops ---
    let nlIO, nlLoops, nlMem, nlTime;
    nlLoops = drivingRows;
    if (hasIndex) {
      // Each driving row: BLEVEL index reads + 1 table access
      nlIO = drivingBlocks + drivingRows * (BLEVEL + 1);
    } else {
      // Without index: full scan of driven for each driving row
      nlIO = drivingBlocks + drivingRows * drivenBlocks;
    }
    nlMem = drivingRows * 32; // minimal — cursor context only
    nlTime = nlIO * IO_TIME_MS;

    // --- Hash Join ---
    const smallerRows  = Math.min(drivingRows, drivenRows);
    const largerRows   = Math.max(drivingRows, drivenRows);
    const smallerBlocks = Math.ceil(smallerRows / ROWS_PER_BLOCK);
    const largerBlocks  = Math.ceil(largerRows / ROWS_PER_BLOCK);

    const hashIO = Math.ceil((smallerBlocks + largerBlocks) * HASH_OVERHEAD);
    const hashLoops = 2; // build pass + probe pass
    const hashMem = smallerRows * (AVG_ROW_SIZE + 16); // row + hash entry overhead
    const hashTime = hashIO * IO_TIME_MS + (smallerRows * 0.001); // hash build CPU

    // --- Sort Merge Join ---
    const log2 = (n) => n > 0 ? Math.log2(n) : 0;
    const sortCostDriving = drivingRows * log2(Math.max(drivingRows, 2));
    const sortCostDriven  = drivenRows * log2(Math.max(drivenRows, 2));
    const totalSortCost   = sortCostDriving + sortCostDriven;

    const mergeIO = Math.ceil((drivingBlocks + drivenBlocks) * 2); // read + write for sort runs
    const mergeLoops = Math.ceil(log2(Math.max(drivingBlocks, 2))) + Math.ceil(log2(Math.max(drivenBlocks, 2)));
    const mergeMem = (drivingRows + drivenRows) * AVG_ROW_SIZE * 0.3; // sort area
    const mergeTime = mergeIO * IO_TIME_MS + totalSortCost * 0.0001; // sort CPU

    // Determine costs and winner
    const costs = {
      nl:    nlIO,
      hash:  hashIO,
      merge: mergeIO
    };
    const maxCost = Math.max(costs.nl, costs.hash, costs.merge, 1);
    const winner = Object.entries(costs).reduce((a, b) => a[1] <= b[1] ? a : b)[0];

    // --- Update NL Card ---
    document.getElementById("join-nl-io").textContent = numFmt(nlIO);
    document.getElementById("join-nl-loops").textContent = numFmt(nlLoops);
    document.getElementById("join-nl-mem").textContent = memFmt(nlMem);
    document.getElementById("join-nl-time").textContent = timeFmt(nlTime);
    const nlPct = Math.round((costs.nl / maxCost) * 100);
    document.getElementById("join-nl-cost-pct").textContent = nlPct + "%";
    document.getElementById("join-nl-cost-bar").style.width = nlPct + "%";

    // --- Update Hash Card ---
    document.getElementById("join-hash-io").textContent = numFmt(hashIO);
    document.getElementById("join-hash-loops").textContent = hashLoops + " pass";
    document.getElementById("join-hash-mem").textContent = memFmt(hashMem);
    document.getElementById("join-hash-time").textContent = timeFmt(hashTime);
    const hashPct = Math.round((costs.hash / maxCost) * 100);
    document.getElementById("join-hash-cost-pct").textContent = hashPct + "%";
    document.getElementById("join-hash-cost-bar").style.width = hashPct + "%";

    // --- Update Merge Card ---
    document.getElementById("join-merge-io").textContent = numFmt(mergeIO);
    document.getElementById("join-merge-loops").textContent = mergeLoops + " pass";
    document.getElementById("join-merge-mem").textContent = memFmt(mergeMem);
    document.getElementById("join-merge-time").textContent = timeFmt(mergeTime);
    const mergePct = Math.round((costs.merge / maxCost) * 100);
    document.getElementById("join-merge-cost-pct").textContent = mergePct + "%";
    document.getElementById("join-merge-cost-bar").style.width = mergePct + "%";

    // --- Badges & Card highlights ---
    const cards = { nl: "join-card-nl", hash: "join-card-hash", merge: "join-card-merge" };
    const badges = { nl: "join-nl-badge", hash: "join-hash-badge", merge: "join-merge-badge" };
    const colors = { nl: "var(--accent-cyan)", hash: "var(--accent-emerald)", merge: "var(--accent-orange)" };

    Object.keys(cards).forEach(k => {
      const card = document.getElementById(cards[k]);
      const badge = document.getElementById(badges[k]);
      if (k === winner) {
        card.style.borderColor = colors[k];
        card.style.boxShadow = `0 0 20px ${k === 'nl' ? 'rgba(6,182,212,0.15)' : k === 'hash' ? 'rgba(16,185,129,0.15)' : 'rgba(249,115,22,0.15)'}`;
        badge.textContent = "최적 ✓";
        badge.style.background = `${k === 'nl' ? 'rgba(6,182,212,0.15)' : k === 'hash' ? 'rgba(16,185,129,0.15)' : 'rgba(249,115,22,0.15)'}`;
        badge.style.color = colors[k];
      } else {
        card.style.borderColor = "var(--border-light)";
        card.style.boxShadow = "none";
        const ratio = (costs[k] / costs[winner]).toFixed(1);
        badge.textContent = ratio + "× 비용";
        badge.style.background = "rgba(239,68,68,0.1)";
        badge.style.color = "#f87171";
      }
    });

    // --- Winner badge ---
    const winnerNames = { nl: "NESTED LOOPS", hash: "HASH JOIN", merge: "SORT MERGE JOIN" };
    const winnerBadge = document.getElementById("join-lab-winner-badge");
    winnerBadge.textContent = "최적: " + winnerNames[winner];
    winnerBadge.style.background = `${winner === 'nl' ? 'rgba(6,182,212,0.15)' : winner === 'hash' ? 'rgba(16,185,129,0.15)' : 'rgba(249,115,22,0.15)'}`;
    winnerBadge.style.color = colors[winner];

    // --- DBA Advice ---
    const adviceEl = document.getElementById("join-lab-dba-advice");
    let advice = "";
    if (winner === "nl") {
      advice = `<strong>Nested Loops가 최적입니다.</strong><br>
선행 테이블 ${numFmt(drivingRows)}건으로 소량이며, ${hasIndex ? '후행 인덱스가 존재하여 각 루프당 BLEVEL('+BLEVEL+') + 1회의 I/O만 발생합니다.' : '후행 인덱스가 없지만 선행 건수가 충분히 적어 Full Scan 반복 비용이 다른 방식보다 낮습니다.'}<br><br>
<strong>NL 조인 핵심 공식:</strong> 총 I/O = Driving Blocks + Driving Rows × (BLEVEL + 1) = ${numFmt(drivingBlocks)} + ${numFmt(drivingRows)} × ${BLEVEL + 1} = <strong>${numFmt(nlIO)}</strong><br><br>
<em>Tip: 선행 테이블이 ${numFmt(drivingRows)}건 이하이고 후행 인덱스가 있으면 NL이 거의 항상 최적입니다.</em>`;
    } else if (winner === "hash") {
      advice = `<strong>Hash Join이 최적입니다.</strong><br>
작은 테이블(${numFmt(smallerRows)}건)로 해시맵을 빌드한 뒤, 큰 테이블(${numFmt(largerRows)}건)을 한 번 스캔하며 프로빙합니다.<br><br>
<strong>Hash Join 핵심 공식:</strong> 총 I/O ≈ (Small Blocks + Large Blocks) × 1.2 = (${numFmt(smallerBlocks)} + ${numFmt(largerBlocks)}) × 1.2 = <strong>${numFmt(hashIO)}</strong><br>
PGA 메모리 = Small Rows × (RowSize + 16B) = ${numFmt(smallerRows)} × ${AVG_ROW_SIZE + 16} = <strong>${memFmt(hashMem)}</strong><br><br>
<em>주의: PGA 메모리가 HASH_AREA_SIZE를 초과하면 Temp 디스크 I/O가 발생하여 One-Pass 또는 Multi-Pass 모드로 전환됩니다.</em>`;
    } else {
      advice = `<strong>Sort Merge Join이 최적입니다.</strong><br>
양쪽 테이블을 조인 키로 정렬 후 한 번의 Merge 패스로 결합합니다. 이미 정렬된 데이터이거나 부등호(>, <, BETWEEN) 조인 시 유리합니다.<br><br>
<strong>Sort Merge 핵심 공식:</strong><br>
정렬 비용 = N·log₂N + M·log₂M = ${numFmt(sortCostDriving)} + ${numFmt(sortCostDriven)} = <strong>${numFmt(totalSortCost)}</strong><br>
총 I/O ≈ (Driving Blocks + Driven Blocks) × 2 = <strong>${numFmt(mergeIO)}</strong><br><br>
<em>Tip: ORDER BY나 GROUP BY가 조인 키와 같은 경우 Sort 단계가 생략되어 추가 비용 절감이 가능합니다.</em>`;
    }

    // Add comparison table
    advice += `<br><br><table style="width:100%; font-size:0.72rem; border-collapse:collapse; margin-top:8px;">
<tr style="border-bottom:1px solid var(--border-light); color:var(--accent-cyan);">
  <th style="text-align:left;padding:4px 6px;">방식</th>
  <th style="text-align:right;padding:4px 6px;">I/O</th>
  <th style="text-align:right;padding:4px 6px;">메모리</th>
  <th style="text-align:right;padding:4px 6px;">시간</th>
</tr>
<tr style="border-bottom:1px solid rgba(255,255,255,0.04);${winner==='nl'?' color:var(--accent-cyan);font-weight:700;':''}">
  <td style="padding:4px 6px;">NL Join</td>
  <td style="text-align:right;padding:4px 6px;">${numFmt(nlIO)}</td>
  <td style="text-align:right;padding:4px 6px;">${memFmt(nlMem)}</td>
  <td style="text-align:right;padding:4px 6px;">${timeFmt(nlTime)}</td>
</tr>
<tr style="border-bottom:1px solid rgba(255,255,255,0.04);${winner==='hash'?' color:var(--accent-emerald);font-weight:700;':''}">
  <td style="padding:4px 6px;">Hash Join</td>
  <td style="text-align:right;padding:4px 6px;">${numFmt(hashIO)}</td>
  <td style="text-align:right;padding:4px 6px;">${memFmt(hashMem)}</td>
  <td style="text-align:right;padding:4px 6px;">${timeFmt(hashTime)}</td>
</tr>
<tr style="${winner==='merge'?' color:var(--accent-orange);font-weight:700;':''}">
  <td style="padding:4px 6px;">Sort Merge</td>
  <td style="text-align:right;padding:4px 6px;">${numFmt(mergeIO)}</td>
  <td style="text-align:right;padding:4px 6px;">${memFmt(mergeMem)}</td>
  <td style="text-align:right;padding:4px 6px;">${timeFmt(mergeTime)}</td>
</tr></table>`;

    adviceEl.innerHTML = advice;
  }

  // Event listener
  document.getElementById("btn-join-lab-simulate").addEventListener("click", simulate);
}

