/* -------------------------------------------------------------
 * TS class Visualizers Module
 * SVG Charts, Execution Trees, B-Tree Simulator, and Lock Engine
 * ------------------------------------------------------------- */

// Global state for charts
const chartData = {
  cpu: Array(20).fill(12),
  io: Array(20).fill(2.4),
  sessions: Array(20).fill(3)
};

/* -------------------------------------------------------------
 * 1. Sparkline Chart Drawer
 * ------------------------------------------------------------- */
function drawSparkline(canvasId, data, minVal = 0, maxVal = 100, strokeColor = "#06b6d4", fillColor = "rgba(6,182,212,0.05)") {
  const svg = document.getElementById(canvasId);
  if (!svg) return;
  
  svg.innerHTML = '';
  const width = 100;
  const height = 40;
  
  // Calculate points
  const points = data.map((val, index) => {
    const x = (index / (data.length - 1)) * width;
    // Invert Y since SVG (0,0) is top-left
    const normalized = (val - minVal) / (maxVal - minVal || 1);
    const y = height - (normalized * (height - 4)) - 2;
    return { x, y };
  });
  
  // Create path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    pathD += ` L ${points[i].x} ${points[i].y}`;
  }
  
  // Line Path
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathD);
  path.setAttribute("stroke", strokeColor);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linecap", "round");
  svg.appendChild(path);
  
  // Gradient Fill Area
  const fillD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
  const fillPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  fillPath.setAttribute("d", fillD);
  fillPath.setAttribute("fill", fillColor);
  svg.appendChild(fillPath);
}

function updateMetricCharts(cpuVal, ioVal, sessionsVal) {
  // Push new data, shift old
  chartData.cpu.push(cpuVal);
  chartData.cpu.shift();
  
  chartData.io.push(ioVal);
  chartData.io.shift();
  
  chartData.sessions.push(sessionsVal);
  chartData.sessions.shift();
  
  // Draw
  drawSparkline("chart-cpu", chartData.cpu, 0, 100, "var(--accent-cyan)", "rgba(6, 182, 212, 0.08)");
  drawSparkline("chart-io", chartData.io, 0, 50, "var(--accent-orange)", "rgba(249, 115, 22, 0.08)");
  drawSparkline("chart-sessions", chartData.sessions, 0, 30, "var(--accent-blue)", "rgba(59, 130, 246, 0.08)");
}

/* -------------------------------------------------------------
 * 2. Execution Plan Tree Visualizer
 * ------------------------------------------------------------- */
const explainPlansData = {
  idx_scan: {
    dialectTerms: {
      oracle: {
        title: "Oracle Database 기준",
        bullets: [
          "<strong>INDEX UNIQUE SCAN:</strong> 기본키(PK)나 유니크 인덱스를 사용해 단 하나의 데이터 블록만 바로 조회하는 최적의 스캔 방식입니다.",
          "<strong>TABLE ACCESS BY INDEX ROWID:</strong> 인덱스에서 획득한 물리적 주소(ROWID)를 통해 테이블 블록을 방문합니다."
        ]
      }
    },
    cost: "2",
    blocks: "3 Blocks",
    time: "0.02 ms",
    xplanText: `SQL_ID  3d7qcsq5h3hfq, child number 0
-------------------------------------
SELECT name, email FROM users WHERE id = 1250

Plan hash value: 1958975584

------------------------------------------------------------------------------------------
| Id  | Operation                    | Name         | Rows  | Bytes | Cost (%CPU)| Time  |
------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT             |              |     1 |    35 |     2   (0)| 00:01 |
|   1 |  TABLE ACCESS BY INDEX ROWID | USERS        |     1 |    35 |     2   (0)| 00:01 |
|*  2 |   INDEX UNIQUE SCAN          | SYS_C001102  |     1 |       |     1   (0)| 00:01 |
------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
----------------------------------------------------
   2 - access("ID"=1250)

Note
-----
   - dynamic statistics used: dynamic sampling (level=2)`,
    nodes: [
      { op: "SELECT STATEMENT", details: "SYS (Cost: 2, Rows: 1)", cost: "Cost: 2", highlight: true },
      { op: "TABLE ACCESS BY INDEX ROWID", details: "USERS (Cost: 1, Rows: 1)", cost: "Cost: 1" },
      { op: "INDEX UNIQUE SCAN", details: "IDX_USERS_ID (PK) (Cost: 1, Keys: id=1250)", cost: "Cost: 1", isLeaf: true }
    ]
  },
  full_scan: {
    dialectTerms: {
      oracle: {
        title: "Oracle Database 기준",
        bullets: [
          "<strong>TABLE ACCESS FULL:</strong> 인덱스가 없거나 사용할 수 없어 테이블의 고수위선(HWM) 아래 모든 데이터 블록을 읽는 디스크 집중적인 스캔입니다.",
          "<strong>Multi-Block I/O:</strong> 한 번의 시스템 콜로 여러 블록을 가져오지만 대량 데이터에서 심각한 병목을 유발합니다."
        ]
      }
    },
    cost: "1250",
    blocks: "24,500 Blocks",
    time: "3.20 ms",
    xplanText: `SQL_ID  8fkzm29a1wxrc, child number 0
-------------------------------------
SELECT * FROM users WHERE register_date = '2026-05-18'

Plan hash value: 3617692013

-----------------------------------------------------------------------------------------------
| Id  | Operation          | Name  | Rows  | Bytes  | Cost (%CPU)| Time     |
-----------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT   |       |  8520 |   998K |  1250   (1)| 00:00:04 |
|*  1 |  TABLE ACCESS FULL | USERS |  8520 |   998K |  1250   (1)| 00:00:04 |
-----------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
----------------------------------------------------
   1 - filter(TRUNC("REGISTER_DATE")=TO_DATE('2026-05-18','YYYY-MM-DD'))

Note
-----
   - ⚠️  WARNING: TABLE ACCESS FULL 발생! REGISTER_DATE 컬럼에 인덱스 생성을 검토하세요.
   - db file scattered read 대기 이벤트 다량 유발 가능성 있음`,
    nodes: [
      { op: "SELECT STATEMENT", details: "SYS (Cost: 1250, Rows: 8520)", cost: "Cost: 1250" },
      { op: "TABLE ACCESS FULL", details: "USERS (Cost: 1250, Rows: 8520, filter: reg_date='2026-05-18')", cost: "Cost: 1250", danger: true }
    ]
  },
  hash_join: {
    dialectTerms: {
      oracle: {
        title: "Oracle Database 기준",
        bullets: [
          "<strong>HASH JOIN:</strong> 두 테이블 중 작은 쪽(Build Input)을 메모리에 해시 맵으로 생성한 뒤 큰 쪽(Probe Input)을 훑어 비교하는 대용량 조인입니다.",
          "<strong>PGA Memory:</strong> 해시 테이블 생성을 위해 정렬 전용 PGA 메모리를 대량으로 사용하며 메모리 공간 부족시 디스크를 씁니다."
        ]
      }
    },
    cost: "45",
    blocks: "820 Blocks",
    time: "8.50 ms",
    xplanText: `SQL_ID  g91pbc7rz4nsh, child number 0
-------------------------------------
SELECT o.order_id, u.name FROM orders o JOIN users u ON o.user_id = u.id WHERE u.grade = 'VIP'

Plan hash value: 2814196863

------------------------------------------------------------------------------------------------------
| Id  | Operation                    | Name              | Rows  | Bytes  | Cost (%CPU)| Time     |
------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT             |                   |   500 |  29500 |    45   (3)| 00:00:01 |
|*  1 |  HASH JOIN                   |                   |   500 |  29500 |    45   (3)| 00:00:01 |
|*  2 |   TABLE ACCESS FULL          | USERS             |   200 |   8200 |    12   (0)| 00:00:01 |
|   3 |   INDEX RANGE SCAN           | IDX_ORDERS_USERID |  5000 | 115000 |     8   (0)| 00:00:01 |
------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
----------------------------------------------------
   1 - access("O"."USER_ID"="U"."ID")
   2 - filter("U"."GRADE"='VIP')

Note
-----
   - ⚠️  USERS 테이블 FULL SCAN: GRADE 컬럼 인덱스 생성 고려
   - Hash Join은 대용량 조인에 유리하나 PGA 메모리 소모 주의`,
    nodes: [
      { op: "SELECT STATEMENT", details: "SYS (Cost: 45, Rows: 500)", cost: "Cost: 45" },
      { op: "HASH JOIN", details: "Hash Cond: o.user_id = u.id (Cost: 45)", cost: "Cost: 45" },
      { op: "TABLE ACCESS FULL (USERS)", details: "VIP 가입자 필터링 (Cost: 12)", cost: "Cost: 12", danger: true },
      { op: "INDEX RANGE SCAN (IDX_ORDERS_UID)", details: "주문 내역 인덱스 조회 (Cost: 8)", cost: "Cost: 8" }
    ]
  },
  nested_loop: {
    dialectTerms: {
      oracle: {
        title: "Oracle Database 기준",
        bullets: [
          "<strong>NESTED LOOPS JOIN:</strong> 선행 테이블(Driving/Outer)을 한 행씩 읽으며 후행 테이블(Driven/Inner)의 인덱스를 반복 탐색하는 전통적 조인입니다.",
          "<strong>인덱스 의존성:</strong> 후행 테이블에 적절한 인덱스가 없으면 조인 횟수만큼 Full Scan이 반복되는 끔찍한 병목이 유발됩니다."
        ]
      }
    },
    cost: "14",
    blocks: "45 Blocks",
    time: "0.85 ms",
    xplanText: `SQL_ID  hq3nt8bv7kyzj, child number 0
-------------------------------------
SELECT /*+ USE_NL(o) */ o.order_id, u.name FROM users u JOIN orders o ON u.id = o.user_id WHERE u.register_date = '2026-05-18'

Plan hash value: 3042521987

------------------------------------------------------------------------------------------------------
| Id  | Operation                     | Name              | Rows  | Bytes | Cost (%CPU)| Time     |
------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |                   |    25 |  1450 |    14   (0)| 00:00:01 |
|   1 |  NESTED LOOPS                 |                   |    25 |  1450 |    14   (0)| 00:00:01 |
|   2 |   NESTED LOOPS                |                   |    25 |  1450 |    14   (0)| 00:00:01 |
|*  3 |    INDEX RANGE SCAN           | IDX_USERS_REGDATE |    25 |   700 |     2   (0)| 00:00:01 |
|*  4 |    INDEX RANGE SCAN           | IDX_ORDERS_USERID |     1 |       |     1   (0)| 00:00:01 |
|   5 |   TABLE ACCESS BY INDEX ROWID | ORDERS            |     1 |    30 |     1   (0)| 00:00:01 |
------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
----------------------------------------------------
   3 - access(TRUNC("U"."REGISTER_DATE")=TO_DATE('2026-05-18','YYYY-MM-DD'))
   4 - access("U"."ID"="O"."USER_ID")

Note
-----
   - USE_NL 힌트 적용: Nested Loops 강제 사용
   - 소량 결과 조인에 최적 (결과 25건 예상)`,
    nodes: [
      { op: "SELECT STATEMENT", details: "SYS (Cost: 14, Rows: 25)", cost: "Cost: 14" },
      { op: "NESTED LOOPS", details: "Nested Loops Join (Cost: 14)", cost: "Cost: 14" },
      { op: "INDEX RANGE SCAN (IDX_USERS_REGDATE)", details: "선행 테이블: 가입일 인덱스 스캔 (Cost: 2)", cost: "Cost: 2" },
      { op: "TABLE ACCESS BY INDEX ROWID (ORDERS)", details: "후행 테이블: ROWID 무작위 I/O (Cost: 1)", cost: "Cost: 1" }
    ]
  }
};

function renderExecutionPlanTree(queryKey, dialect = "oracle") {
  const viewport = document.getElementById("explain-tree-viewport");
  if (!viewport) return;
  
  viewport.innerHTML = '';
  
  const planInfo = explainPlansData[queryKey];
  if (!planInfo) return;
  
  // Render cost cards
  document.getElementById("explain-cost-val").innerText = planInfo.cost;
  document.getElementById("explain-io-blocks").innerText = planInfo.blocks;
  document.getElementById("explain-time-val").innerText = planInfo.time;
  
  // Render DBA terms based on selected dialect
  const termData = planInfo.dialectTerms[dialect] || planInfo.dialectTerms.oracle;
  document.getElementById("dialect-explain-term").innerText = termData.title;
  
  const bulletsContainer = document.getElementById("explain-dialect-bullets");
  bulletsContainer.innerHTML = '';
  termData.bullets.forEach(bullet => {
    const li = document.createElement("li");
    li.innerHTML = bullet;
    bulletsContainer.appendChild(li);
  });

  // ── DBMS_XPLAN Text Viewport ────────────────────────────────
  const textViewport = document.getElementById("explain-text-viewport");
  if (textViewport && planInfo.xplanText) {
    textViewport.innerHTML = '';
    const lines = planInfo.xplanText.split('\n');
    lines.forEach(line => {
      const span = document.createElement('span');
      span.style.display = 'block';

      // Colorize by line content
      if (/TABLE ACCESS FULL/.test(line)) {
        span.style.color = '#f87171'; // red for FULL scan
        span.style.fontWeight = '700';
      } else if (/\|\s*\d+\s*\|/.test(line) && /\*/.test(line)) {
        // rows with * (predicate applied)
        span.style.color = '#fb923c'; // orange
      } else if (/^[-]{5,}/.test(line) || /^[=]{5,}/.test(line)) {
        span.style.color = 'rgba(148, 163, 184, 0.4)';
      } else if (/^Predicate Information/.test(line) || /^Note/.test(line)) {
        span.style.color = '#a78bfa'; // purple heading
        span.style.fontWeight = '700';
      } else if (/access\(|filter\(/.test(line)) {
        span.style.color = '#34d399'; // green for access predicates
      } else if (/⚠️/.test(line)) {
        span.style.color = '#fbbf24'; // yellow warning
        span.style.fontWeight = '700';
      } else if (/^SQL_ID/.test(line)) {
        span.style.color = '#94a3b8'; // muted header
      } else if (/Plan hash value/.test(line)) {
        span.style.color = '#67e8f9';
      } else if (/INDEX (UNIQUE|RANGE) SCAN/.test(line)) {
        span.style.color = '#6ee7b7'; // light green for index ops
      } else if (/NESTED LOOPS|HASH JOIN/.test(line)) {
        span.style.color = '#93c5fd'; // blue join ops
      } else if (/^SELECT/.test(line.trim())) {
        span.style.color = '#fcd34d'; // yellow SQL text
      }

      span.textContent = line;
      textViewport.appendChild(span);
    });
  }
  
  // Create animated particles background
  const particles = document.createElement("div");
  particles.className = "flow-particles";
  for(let i=0; i<8; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    p.style.left = `${20 + Math.random()*60}%`;
    p.style.animationDelay = `${i * 0.4}s`;
    p.style.animationDuration = `${1.2 + Math.random()*0.8}s`;
    particles.appendChild(p);
  }
  viewport.appendChild(particles);
  
  // Render Nodes Tree (Linear block list connected)
  const nodeContainer = document.createElement("div");
  nodeContainer.style.display = "flex";
  nodeContainer.style.flexDirection = "column";
  nodeContainer.style.alignItems = "center";
  nodeContainer.style.zIndex = "2";
  
  planInfo.nodes.forEach((node, idx) => {
    // Render Node Card
    const nodeDiv = document.createElement("div");
    nodeDiv.className = `tree-node ${node.highlight ? 'highlight' : ''} ${node.danger ? 'danger' : ''}`;
    
    const op = document.createElement("span");
    op.className = "node-op";
    op.innerText = node.op;
    
    const details = document.createElement("span");
    details.className = "node-details";
    details.innerText = node.details;
    
    const cost = document.createElement("span");
    cost.className = "node-cost";
    cost.innerText = node.cost;
    
    nodeDiv.appendChild(op);
    nodeDiv.appendChild(details);
    nodeDiv.appendChild(cost);
    
    nodeContainer.appendChild(nodeDiv);
    
    // Add connector line if not the last node
    if (idx < planInfo.nodes.length - 1) {
      const conn = document.createElement("div");
      conn.className = `node-connector ${!node.danger ? 'active' : ''}`;
      nodeContainer.appendChild(conn);
    }
  });
  
  viewport.appendChild(nodeContainer);
}

/* -------------------------------------------------------------
 * 3. B-Tree Index Search Simulator
 * ------------------------------------------------------------- */
function renderBTreeSimulator(searchValue, scenario = "scenario_single") {
  const container = document.getElementById("btree-canvas-container");
  if (!container) return;
  
  container.innerHTML = '';
  
  // Define tree nodes layout in layers
  const treeLayout = {
    root: { keys: [30, 60], type: "root", id: "btree-root" },
    branches: [
      { keys: [10, 20], range: "val < 30", type: "branch", id: "branch-1" },
      { keys: [40, 50], range: "30 <= val < 60", type: "branch", id: "branch-2" },
      { keys: [70, 80], range: "val >= 60", type: "branch", id: "branch-3" }
    ],
    leaves: [
      { keys: [10, 15, 25], parentId: "branch-1", type: "leaf", id: "leaf-1" },
      { keys: [30, 42, 55], parentId: "branch-2", type: "leaf", id: "leaf-2" },
      { keys: [60, 62, 68], parentId: "branch-3", type: "leaf", id: "leaf-3" },
      { keys: [70, 75, 78], parentId: "branch-3", type: "leaf", id: "leaf-4" },
      { keys: [80, 88, 99], parentId: "branch-3", type: "leaf", id: "leaf-5" }
    ]
  };

  // Add scenario title banner
  const banner = document.createElement("div");
  banner.className = "fts-bypass-banner";
  banner.style = "text-align: center; margin-bottom: 20px; color: var(--accent-cyan); font-size: 0.85rem; font-weight: 700; background: rgba(6, 182, 212, 0.1); border: 1px solid rgba(6, 182, 212, 0.2); padding: 8px 16px; border-radius: 6px; animation: fadeIn 0.4s ease;";
  if (scenario === "scenario_single") {
    banner.innerHTML = "🎯 B-TREE INDEX SCAN: 단건 조회를 위해 루트 → 브랜치 → 리프 블록을 거쳐 해당 테이블 블록으로 다이렉트 탐색합니다.";
  } else if (scenario === "scenario_range") {
    banner.innerHTML = "📊 B-TREE INDEX RANGE SCAN: 범위 조회(10~80)를 위해 여러 번 인덱스를 스캔하며 대규모의 Random Access I/O를 유발합니다.";
  } else if (scenario === "scenario_small") {
    banner.innerHTML = "⚡ B-TREE INDEX SCAN (소형 테이블): 초소형 테이블 조회 시에도 인덱스 구조를 타는 부가 오버헤드가 발생합니다.";
  }
  container.appendChild(banner);

  // 1. Render Root Layer
  const rootLayer = document.createElement("div");
  rootLayer.className = "btree-layer";
  const rootNode = createBTreeNodeElement(treeLayout.root);
  rootLayer.appendChild(rootNode);
  container.appendChild(rootLayer);
  
  // 2. Render Branch Layer
  const branchLayer = document.createElement("div");
  branchLayer.className = "btree-layer";
  treeLayout.branches.forEach(branch => {
    const el = createBTreeNodeElement(branch);
    branchLayer.appendChild(el);
  });
  container.appendChild(branchLayer);
  
  // 3. Render Leaf Layer
  const leafLayer = document.createElement("div");
  leafLayer.className = "btree-layer";
  treeLayout.leaves.forEach(leaf => {
    const el = createBTreeNodeElement(leaf);
    leafLayer.appendChild(el);
  });
  container.appendChild(leafLayer);
  
  // 4. Render Physical Table Blocks Layer
  const tableLayer = document.createElement("div");
  tableLayer.className = "btree-layer";
  
  const targetRowBlock = document.createElement("div");
  targetRowBlock.id = "table-block-target";
  targetRowBlock.className = "btree-node-block table";
  if (scenario === "scenario_range") {
    targetRowBlock.innerHTML = `<span class="btree-key">TABLE BLOCKS</span> <span>User Range 10 ~ 80 (Random Access 다수 발생)</span>`;
  } else {
    targetRowBlock.innerHTML = `<span class="btree-key">TABLE BLOCK (Row ID)</span> <span>User: ${searchValue}</span>`;
  }
  tableLayer.appendChild(targetRowBlock);
  container.appendChild(tableLayer);
  
  // Start B-Tree search animation sequence
  animateBTreeSearch(searchValue, scenario);
}

function createBTreeNodeElement(nodeData) {
  const div = document.createElement("div");
  div.id = nodeData.id;
  div.className = `btree-node-block ${nodeData.type}`;
  
  nodeData.keys.forEach(k => {
    const span = document.createElement("span");
    span.className = "btree-key";
    span.innerText = k;
    span.setAttribute("data-key-val", k);
    div.appendChild(span);
  });
  
  return div;
}

function animateBTreeSearch(val, scenario = "scenario_single") {
  // Reset all searched classes
  document.querySelectorAll(".btree-node-block").forEach(el => {
    el.className = el.className.replace(" searched", "").replace(" missed", "");
  });
  document.querySelectorAll(".btree-key").forEach(el => {
    el.classList.remove("active");
  });

  const rootEl = document.getElementById("btree-root");
  
  // Step 1: Root Node Search (Delay 0)
  setTimeout(() => {
    rootEl.classList.add("searched");
    // Find target branch pointer
    let targetBranchId = "branch-1";
    if (val >= 30 && val < 60) {
      targetBranchId = "branch-2";
      rootEl.querySelector('[data-key-val="30"]').classList.add("active");
    } else if (val >= 60) {
      targetBranchId = "branch-3";
      rootEl.querySelector('[data-key-val="60"]').classList.add("active");
    } else {
      rootEl.querySelector('[data-key-val="30"]').classList.add("active");
    }
    
    // Dim other branches
    document.querySelectorAll(".branch").forEach(el => {
      if (el.id !== targetBranchId) el.classList.add("missed");
    });
    
    // Step 2: Branch Node Search (Delay 600ms)
    setTimeout(() => {
      const branchEl = document.getElementById(targetBranchId);
      branchEl.classList.remove("missed");
      branchEl.classList.add("searched");
      
      // Determine leaf
      let targetLeafId = "leaf-1";
      if (targetBranchId === "branch-1") {
        targetLeafId = "leaf-1";
        branchEl.querySelector('[data-key-val="10"]').classList.add("active");
      } else if (targetBranchId === "branch-2") {
        targetLeafId = "leaf-2";
        branchEl.querySelector('[data-key-val="40"]').classList.add("active");
      } else if (targetBranchId === "branch-3") {
        if (val >= 60 && val < 70) {
          targetLeafId = "leaf-3";
          branchEl.querySelector('[data-key-val="70"]').classList.add("active");
        } else if (val >= 70 && val < 80) {
          targetLeafId = "leaf-4";
          branchEl.querySelector('[data-key-val="70"]').classList.add("active");
        } else {
          targetLeafId = "leaf-5";
          branchEl.querySelector('[data-key-val="80"]').classList.add("active");
        }
      }
      
      // Dim other leaves
      document.querySelectorAll(".leaf").forEach(el => {
        if (el.id !== targetLeafId) el.classList.add("missed");
      });
      
      // Step 3: Leaf Search & RID Retrieval (Delay 1200ms)
      setTimeout(() => {
        const leafEl = document.getElementById(targetLeafId);
        leafEl.classList.remove("missed");
        leafEl.classList.add("searched");
        
        // Find closest match or exact match key in leaf
        let closestKey = leafEl.children[0];
        let diff = Math.abs(parseInt(closestKey.innerText) - val);
        for(let i=1; i<leafEl.children.length; i++) {
          const kVal = parseInt(leafEl.children[i].innerText);
          const kDiff = Math.abs(kVal - val);
          if (kDiff < diff) {
            diff = kDiff;
            closestKey = leafEl.children[i];
          }
        }
        closestKey.classList.add("active");
        
        // Step 4: Table block read (Delay 1800ms)
        setTimeout(() => {
          const tableBlock = document.getElementById("table-block-target");
          tableBlock.classList.add("searched");
          
          if (scenario === "scenario_single") {
            tableBlock.innerHTML = `<span class="btree-key active">ROWID BLOCK MATCHED</span> <span>User: ${val} (I/O 완료)</span>`;
            
            // Animate comparison bars
            document.getElementById("comp-bar-idx").style.width = `15%`;
            document.getElementById("comp-bar-full").style.width = `100%`;
            
            document.getElementById("comp-val-idx").innerText = "3 Blocks Read";
            document.getElementById("comp-val-full").innerText = "20 Blocks Read";
            
            const savings = Math.round(((20 - 3) / 20) * 100);
            document.getElementById("index-io-summary").innerHTML = `🎯 <strong>단건 조회 결과</strong>: 루트 블록 → 리프 블록 → 테이블 블록 순으로 <strong>단 3개의 블록만 I/O</strong>를 발생시켜 풀 스캔(20 Blocks) 대비 <strong>${savings}%의 I/O 비용을 절감</strong>했습니다!`;
          } else if (scenario === "scenario_range") {
            tableBlock.innerHTML = `<span class="btree-key active" style="background-color: var(--accent-orange);">RANDOM ACCESS OVERHEAD</span> <span>User ID 10 ~ 80 (24 Blocks Read)</span>`;
            
            document.getElementById("comp-bar-idx").style.width = `100%`;
            document.getElementById("comp-bar-full").style.width = `33%`;
            
            document.getElementById("comp-val-idx").innerText = "24 Blocks Read";
            document.getElementById("comp-val-full").innerText = "8 Blocks Read";
            
            const savings = Math.round(((24 - 8) / 24) * 100);
            document.getElementById("index-io-summary").innerHTML = `📊 <strong>대용량 범위 조회 결과</strong>: 인덱스 스캔은 범위 내 매 행마다 테이블 블록을 읽기 위해 <strong>무작위 Random Access I/O 오버헤드</strong>가 대량 유입되어 **총 24 Blocks Read**가 발생했습니다. 반면, 풀 스캔은 단 **8 Blocks Read**만에 전량을 회수하여, **풀 스캔이 인덱스 대비 ${savings}% 더 우수**합니다!`;
          } else if (scenario === "scenario_small") {
            tableBlock.innerHTML = `<span class="btree-key active">ROWID BLOCK MATCHED</span> <span>User: ${val} (3 Blocks Read)</span>`;
            
            document.getElementById("comp-bar-idx").style.width = `100%`;
            document.getElementById("comp-bar-full").style.width = `66%`;
            
            document.getElementById("comp-val-idx").innerText = "3 Blocks Read";
            document.getElementById("comp-val-full").innerText = "2 Blocks Read";
            
            const savings = Math.round(((3 - 2) / 3) * 100);
            document.getElementById("index-io-summary").innerHTML = `⚡ <strong>초소형 테이블 조회 결과</strong>: 인덱스를 탈 경우 인덱스 탐색 비용이 추가되어 **총 3 Blocks Read**가 유입되었으나, 풀 스캔은 테이블 전체 블록(단 **2 Blocks**)만 바로 순차적으로 읽고 끝나기 때문에 **풀 스캔이 인덱스 대비 ${savings}% 더 우수**합니다!`;
          }
        }, 600);
        
      }, 600);
      
    }, 600);
    
  }, 200);
}

function renderFullTableScanSimulator(searchValue, scenario = "scenario_single") {
  const container = document.getElementById("btree-canvas-container");
  if (!container) return;
  
  container.innerHTML = '';
  
  // Define tree nodes layout in layers
  const treeLayout = {
    root: { keys: [30, 60], type: "root", id: "btree-root" },
    branches: [
      { keys: [10, 20], range: "val < 30", type: "branch", id: "branch-1" },
      { keys: [40, 50], range: "30 <= val < 60", type: "branch", id: "branch-2" },
      { keys: [70, 80], range: "val >= 60", type: "branch", id: "branch-3" }
    ],
    leaves: [
      { keys: [10, 15, 25], parentId: "branch-1", type: "leaf", id: "leaf-1" },
      { keys: [30, 42, 55], parentId: "branch-2", type: "leaf", id: "leaf-2" },
      { keys: [60, 62, 68], parentId: "branch-3", type: "leaf", id: "leaf-3" },
      { keys: [70, 75, 78], parentId: "branch-3", type: "leaf", id: "leaf-4" },
      { keys: [80, 88, 99], parentId: "branch-3", type: "leaf", id: "leaf-5" }
    ]
  };

  // Add a FTS Bypass Banner
  const banner = document.createElement("div");
  banner.className = "fts-bypass-banner";
  banner.style = "text-align: center; margin-bottom: 20px; color: var(--accent-orange); font-size: 0.85rem; font-weight: 700; background: rgba(249, 115, 22, 0.1); border: 1px solid rgba(249, 115, 22, 0.2); padding: 8px 16px; border-radius: 6px; animation: fadeIn 0.4s ease;";
  if (scenario === "scenario_single") {
    banner.innerHTML = "⚠️ FULL TABLE SCAN: B-Tree 인덱스를 거치지 않고 디스크의 모든 물리 테이블 블록을 순차 탐색합니다 (실제 테이블 크기: 20 블록).";
  } else if (scenario === "scenario_range") {
    banner.innerHTML = "⚠️ FULL TABLE SCAN (Multi-Block Read): 대용량 데이터를 한 번에 연속해서 쭉 긁어오므로 인덱스 Random Access보다 빠릅니다.";
  } else if (scenario === "scenario_small") {
    banner.innerHTML = "⚠️ FULL TABLE SCAN (소형 테이블): 테이블 전체 블록이 단 2개뿐이므로, 인덱스 없이 직접 스캔하는 것이 가장 빠릅니다.";
  }
  container.appendChild(banner);

  // 1. Render Root Layer
  const rootLayer = document.createElement("div");
  rootLayer.className = "btree-layer";
  const rootNode = createBTreeNodeElement(treeLayout.root);
  rootLayer.appendChild(rootNode);
  container.appendChild(rootLayer);
  
  // 2. Render Branch Layer
  const branchLayer = document.createElement("div");
  branchLayer.className = "btree-layer";
  treeLayout.branches.forEach(branch => {
    const el = createBTreeNodeElement(branch);
    branchLayer.appendChild(el);
  });
  container.appendChild(branchLayer);
  
  // 3. Render Leaf Layer
  const leafLayer = document.createElement("div");
  leafLayer.className = "btree-layer";
  treeLayout.leaves.forEach(leaf => {
    const el = createBTreeNodeElement(leaf);
    leafLayer.appendChild(el);
  });
  container.appendChild(leafLayer);
  
  // 4. Render Sequential Table Blocks
  const tableLayer = document.createElement("div");
  tableLayer.className = "btree-layer fts-table-layer";
  tableLayer.style = "display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-top: 25px; width: 100%;";
  
  let blocksData = [];
  if (scenario === "scenario_small") {
    blocksData = [
      { id: "tb-block-1", label: "Block 1", range: "10 ~ 19", keys: [10, 12, 15] },
      { id: "tb-block-2", label: "Block 2", range: "20 ~ 29", keys: [25] }
    ];
  } else {
    blocksData = [
      { id: "tb-block-1", label: "Block 1", range: "10 ~ 19", keys: [10, 15] },
      { id: "tb-block-2", label: "Block 2", range: "20 ~ 29", keys: [25] },
      { id: "tb-block-3", label: "Block 3", range: "30 ~ 39", keys: [30] },
      { id: "tb-block-4", label: "Block 4", range: "40 ~ 49", keys: [42] },
      { id: "tb-block-5", label: "Block 5", range: "50 ~ 59", keys: [55] },
      { id: "tb-block-6", label: "Block 6", range: "60 ~ 69", keys: [60, 62, 68] },
      { id: "tb-block-7", label: "Block 7", range: "70 ~ 79", keys: [70, 75, 78] },
      { id: "tb-block-8", label: "Block 8", range: "80 ~ 99", keys: [80, 88, 99] }
    ];
  }
  
  blocksData.forEach(block => {
    const el = document.createElement("div");
    el.id = block.id;
    el.className = "btree-node-block table fts-block";
    el.style = "flex: 1; min-width: 80px; text-align: center; font-size: 0.72rem; padding: 12px 6px; transition: all 0.3s ease; border-radius: 6px;";
    el.innerHTML = `<strong style="display:block; margin-bottom: 4px; color: var(--color-text-muted);">${block.label}</strong><span style="font-size: 0.65rem; color: var(--color-text-dark);">${block.range}</span>`;
    tableLayer.appendChild(el);
  });
  
  container.appendChild(tableLayer);
  
  // Start Full Table Scan animation sequence
  animateFullTableScan(searchValue, blocksData, scenario);
}

function animateFullTableScan(val, blocksData, scenario = "scenario_single") {
  // Clear any existing active / searched state
  document.querySelectorAll(".btree-node-block").forEach(el => {
    el.className = el.className.replace(" searched", "").replace(" missed", "");
  });
  document.querySelectorAll(".btree-key").forEach(el => {
    el.classList.remove("active");
  });

  // Dim the entire B-Tree since it is completely bypassed
  document.getElementById("btree-root").classList.add("missed");
  document.querySelectorAll(".branch").forEach(el => el.classList.add("missed"));
  document.querySelectorAll(".leaf").forEach(el => el.classList.add("missed"));

  let currentBlockIndex = 0;
  
  function scanNextBlock() {
    if (currentBlockIndex >= blocksData.length) {
      // Completed scanning all blocks!
      if (scenario === "scenario_single") {
        document.getElementById("comp-bar-idx").style.width = `15%`;
        document.getElementById("comp-bar-full").style.width = `100%`;
        
        document.getElementById("comp-val-idx").innerText = "3 Blocks Read";
        document.getElementById("comp-val-full").innerText = "20 Blocks Read";
        
        document.getElementById("index-io-summary").innerHTML = `⚠️ <strong>풀 테이블 스캔(Full Scan) 완료!</strong>: 인덱스를 경유하지 않아 <strong>총 20개의 물리 블록(화면 요약 8블록)을 전부 순차 탐색</strong>했습니다. 단건 조회 시에는 심각한 디스크 대기 지표(db file scattered read)를 유발하게 됩니다.`;
      } else if (scenario === "scenario_range") {
        document.getElementById("comp-bar-idx").style.width = `100%`;
        document.getElementById("comp-bar-full").style.width = `33%`;
        
        document.getElementById("comp-val-idx").innerText = "24 Blocks Read";
        document.getElementById("comp-val-full").innerText = "8 Blocks Read";
        
        const savings = Math.round(((24 - 8) / 24) * 100);
        document.getElementById("index-io-summary").innerHTML = `⚠️ <strong>풀 테이블 스캔(Full Scan) 완료! (범위 10~80)</strong>: 대용량 조회 시에는 인덱스보다 풀 스캔이 압도적인 **Multi-Block Read** 효과를 발휘하여, 단 **8 Blocks I/O** 만으로 데이터 전량을 뭉텅이로 긁어와 **인덱스 대비 ${savings}% 효율을 보였습니다!**`;
      } else if (scenario === "scenario_small") {
        document.getElementById("comp-bar-idx").style.width = `100%`;
        document.getElementById("comp-bar-full").style.width = `66%`;
        
        document.getElementById("comp-val-idx").innerText = "3 Blocks Read";
        document.getElementById("comp-val-full").innerText = "2 Blocks Read";
        
        const savings = Math.round(((3 - 2) / 3) * 100);
        document.getElementById("index-io-summary").innerHTML = `⚠️ <strong>풀 테이블 스캔(Full Scan) 완료! (소형 테이블)</strong>: 테이블이 극히 작아 **단 2개의 블록**만 스캔하고 즉시 끝났습니다. 인덱스 생성 및 탐색 오버헤드가 없어 **인덱스 대비 ${savings}% 더 우월했습니다!**`;
      }
      return;
    }
    
    const block = blocksData[currentBlockIndex];
    const blockEl = document.getElementById(block.id);
    
    // Highlight searching
    blockEl.classList.add("searched");
    blockEl.style.transform = "scale(1.06)";
    blockEl.style.borderColor = "var(--accent-orange)";
    blockEl.style.boxShadow = "0 0 10px rgba(249, 115, 22, 0.4)";
    
    let isMatch = false;
    let matchText = "";
    
    if (scenario === "scenario_range") {
      // Range is 10 ~ 80, so Blocks 1 to 7 are matches!
      const blockNum = currentBlockIndex + 1;
      if (blockNum <= 7) {
        isMatch = true;
        matchText = `User ${block.range} 발견`;
      } else {
        isMatch = false;
        matchText = "80 초과 (Pass)";
      }
    } else {
      // Single row check
      const rangeParts = block.range.split(" ~ ").map(Number);
      isMatch = val >= rangeParts[0] && val <= rangeParts[1];
      matchText = `User ${val} 발견`;
    }
    
    setTimeout(() => {
      blockEl.style.transform = "scale(1)";
      blockEl.style.boxShadow = "none";
      if (isMatch) {
        blockEl.style.borderColor = "var(--accent-emerald)";
        blockEl.style.background = "rgba(16, 185, 129, 0.1)";
        blockEl.innerHTML = `<strong style="display:block; margin-bottom: 4px; color: var(--accent-emerald);">MATCH!</strong><span style="font-size: 0.65rem; color: var(--accent-emerald); font-weight:700;">${matchText}</span>`;
      } else {
        blockEl.style.borderColor = "rgba(239, 68, 68, 0.25)";
        blockEl.style.background = "rgba(239, 68, 68, 0.03)";
        blockEl.innerHTML = `<strong style="display:block; margin-bottom: 4px; color: var(--color-text-dark);">Pass</strong><span style="font-size: 0.62rem; color: var(--color-text-dark);">매칭 없음</span>`;
      }
      
      currentBlockIndex++;
      setTimeout(scanNextBlock, 250);
    }, 450);
  }
  
  // Start sequential scan
  setTimeout(scanNextBlock, 300);
}

/* -------------------------------------------------------------
 * 4. Lock Sandbox Steps Engine
 * ------------------------------------------------------------- */
const lockScenarios = {
  row_lock: {
    steps: [
      {
        session: "A",
        sql: "UPDATE users SET bal = 9900 WHERE id = 10; -- (커밋 없음)",
        resp: "1 row updated. (행 잠금 획득)",
        respClass: "success",
        rowLocks: { row1: "A" },
        blocking: false,
        dbaTips: "세션 A가 User ID 10번 행의 배타적 락(Exclusive Row Lock / TX)을 점유했습니다. 다른 세션은 이 행을 가공할 수 없습니다."
      },
      {
        session: "B",
        sql: "UPDATE users SET bal = 10200 WHERE id = 10; -- (동일 행 가공 시도)",
        resp: "세션 대기 상태 진입... (enq: TX - row lock contention)",
        respClass: "waiting",
        rowLocks: { row1: "A" },
        blocking: { from: "B", to: "A", msg: "Lock Contention" },
        dbaTips: "세션 B가 동일한 10번 행을 업데이트하려고 시도했으나, 세션 A가 트랜잭션을 끝내지 않아 세션 B가 무한 대기(Block) 상태에 들어갔습니다."
      },
      {
        session: "A",
        sql: "COMMIT; -- (트랜잭션 종료)",
        resp: "Commit complete. (락 해제 완료)",
        respClass: "success",
        rowLocks: { row1: "free" },
        blocking: false,
        dbaTips: "세션 A가 커밋을 실행하자 점유하고 있던 Row Lock이 즉각 해제되었습니다."
      },
      {
        session: "B",
        sql: "-- (자동 진행)",
        resp: "1 row updated. (대기 상태 해제 후 잠금 획득 완료)",
        respClass: "success",
        rowLocks: { row1: "B" },
        blocking: false,
        dbaTips: "세션 A의 락이 해제되자마자 대기 상태에 묶여있던 세션 B가 락을 안전하게 인계받아 업데이트를 완료했습니다. 락 대기를 방지하기 위해 트랜잭션은 항상 최소 단위로 빠르게 종료(COMMIT/ROLLBACK)해야 합니다."
      }
    ]
  },
  deadlock: {
    steps: [
      {
        session: "A",
        sql: "UPDATE users SET bal = 9900 WHERE id = 10;",
        resp: "1 row updated. (10번 행 잠금 획득)",
        respClass: "success",
        rowLocks: { row1: "A" },
        blocking: false,
        dbaTips: "세션 A가 User ID 10번 행의 배타적 행 락(Exclusive Row Lock)을 선점합니다."
      },
      {
        session: "B",
        sql: "UPDATE users SET bal = 24900 WHERE id = 20;",
        resp: "1 row updated. (20번 행 잠금 획득)",
        respClass: "success",
        rowLocks: { row1: "A", row2: "B" },
        blocking: false,
        dbaTips: "세션 B는 다른 행인 20번 행의 락을 점유했습니다. 두 세션 모두 서로 다른 데이터를 선점한 상태입니다."
      },
      {
        session: "A",
        sql: "UPDATE users SET bal = 25100 WHERE id = 20; -- (B가 잠근 20번 조회)",
        resp: "세션 대기 상태 진입... (20번 락 대기)",
        respClass: "waiting",
        rowLocks: { row1: "A", row2: "B" },
        blocking: { from: "A", to: "B", msg: "Row 20 Wait" },
        dbaTips: "세션 A가 20번 행의 가공을 시도했으나, 이미 세션 B가 잠그고 있으므로 세션 A는 B가 트랜잭션을 마칠 때까지 대기에 걸리게 됩니다."
      },
      {
        session: "B",
        sql: "UPDATE users SET bal = 10100 WHERE id = 10; -- (교착 상태 유발)",
        resp: "ORA-00060: 교착 상태(Deadlock)가 감지되었습니다!",
        respClass: "danger",
        rowLocks: { row1: "A", row2: "B" },
        blocking: { from: "B", to: "A", msg: "DEADLOCK CYCLE", cycle: true },
        dbaTips: "<strong>[교착 상태 감지!]</strong> 세션 B가 세션 A가 점유한 10번 행을 다시 요구하면서 'A는 B를 대기하고, B는 A를 대기하는' 완벽한 순환 고리(Deadlock Cycle)가 완성되었습니다. DBMS는 교착 상태를 강제 방지하기 위해 세션 B의 마지막 명령을 자동 롤백시키고 오류를 던집니다."
      }
    ]
  }
};
