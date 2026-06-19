# 제3장. SQL 진단: 실행 계획 분석과 옵티마이저의 메커니즘

**단원 학습 목표**

1. 비용 기반 옵티마이저(CBO)가 통계 정보를 참조하여 실행 계획을 수립하는 메커니즘을 이해한다.
2. `DBMS_XPLAN` 패키지를 활용하여 실제 실행 계획과 런타임 수치를 정확히 추출할 수 있다.
3. 실행 계획의 계층형 트리 구조를 파악하고 들여쓰기 규칙에 따라 연산 순서를 도출할 수 있다.
4. 주요 데이터 접근 경로와 조인 방식의 특징을 알고 병목 단계를 지목할 수 있다.
5. `Starts`, `E-Rows`, `A-Rows` 간의 수리적 오차를 추적하여 옵티마이저가 오판한 구간을 색출한다.
6. 통계 정보 수집 전략과 플랜 변경(Plan Regression) 장애에 대처할 수 있다.

---

## 3.1 비용 기반 옵티마이저(CBO)와 데이터 딕셔너리 통계 정보

### 1) CBO (Cost-Based Optimizer)의 경로 선택 원리

오라클의 비용 기반 옵티마이저(CBO)는 SQL 문장을 수신하면 구문 분석(Parsing) 단계를 거쳐 여러 가동 경로(실행 계획 대안)를 생성합니다. 각 경로에 대해 데이터를 읽는 데 필요한 디스크 I/O 횟수와 CPU 자원 소모량을 계산하여 '비용(Cost)'이라는 수치로 환산합니다. 옵티마이저는 생성된 대안 중 이 비용 공식의 결과값이 최소가 되는 실행 경로를 최종 선택합니다.

### 2) 통계 정보의 구성 요소

옵티마이저의 비용 계산 공식에 채워지는 핵심 변수들은 데이터 딕셔너리에 저장된 통계 정보입니다.

* **테이블 통계 (`NUM_ROWS`, `BLOCKS`, `AVG_ROW_LEN`)**: 테이블의 총 레코드 수와 디스크 점유 블록 수, 행의 평균 길이는 Full Table Scan 비용과 직결됩니다.
* **컬럼 통계 (`NUM_DISTINCT`, `LOW_VALUE`, `HIGH_VALUE`, `NUM_NULLS`, `HISTOGRAM`)**:
  * `NUM_DISTINCT` (카디널리티): 해당 컬럼에 존재하는 고유 값의 수입니다. 옵티마이저는 이 값을 기반으로 조건절의 **선택도(Selectivity)**를 계산합니다.
  * `HISTOGRAM` (히스토그램): 데이터 분포가 균등하지 않을 때(예: 상태 컬럼에서 'ACTIVE'가 99%, 'CLOSED'가 1%) 옵티마이저가 정확한 비용을 산출할 수 있도록 값별 분포도를 저장합니다.
* **인덱스 통계 (`BLEVEL`, `LEAF_BLOCKS`, `CLUSTERING_FACTOR`)**:
  * `BLEVEL` (Branch Level): B-Tree 인덱스의 루트 노드에서 리프 노드까지 도달하기 위해 거쳐야 하는 깊이입니다.
  * `CLUSTERING_FACTOR` (군집도): 인덱스 리프 노드의 정렬 순서가 실제 테이블 블록에 저장된 데이터의 물리적 정렬 순서와 얼마나 일치하는지 나타내는 지표입니다. 이 값이 테이블의 총 블록 수에 가까우면 효율적이며, 총 레코드 수에 가까우면 무작위 접근(Random I/O) 비용을 폭증시킵니다.

### 3) 선택도(Selectivity)와 카디널리티(Cardinality)의 수학적 관계

옵티마이저의 비용 판단 핵심은 **"이 조건절을 적용하면 전체 데이터 중 몇 퍼센트가 살아남는가?"**를 계산하는 것입니다.

* **선택도 공식 (등치 조건)**:
  $$\text{Selectivity} = \frac{1}{\text{NUM\_DISTINCT}}$$
* **카디널리티 공식**:
  $$\text{Cardinality (E-Rows)} = \text{NUM\_ROWS} \times \text{Selectivity}$$
* **실전 대입 예시**: `WHERE grade = 'VIP'` 조건을 가진 쿼리에서, `users` 테이블의 `NUM_ROWS = 1,000,000`이고 `grade` 컬럼의 `NUM_DISTINCT = 4`라면:
  $$\text{Selectivity} = \frac{1}{4} = 0.25 \quad \rightarrow \quad \text{E-Rows} = 1{,}000{,}000 \times 0.25 = 250{,}000$$
  옵티마이저는 25만 건이 반환될 것으로 예측하여 Full Table Scan을 선택할 가능성이 높습니다. 그러나 실제로 'VIP' 등급이 전체의 0.1%(1,000건)에 불과하다면 **히스토그램이 없을 경우 균등 분포를 가정**하여 심각한 오판이 발생합니다.

### 4) 통계 정보 노후화 (STALE)와 자동 수집 메커니즘

데이터가 대량으로 변경된 후 통계 정보가 갱신되지 않으면 데이터 딕셔너리는 STALE(노후화) 상태로 마킹됩니다. 실제 데이터는 1,000만 건인데 통계 정보는 과거의 100건으로 고정되어 있다면, 옵티마이저는 대량의 디스크 I/O가 필요한 쿼리를 가벼운 연산으로 간주하여 잘못된 실행 계획을 수립하게 됩니다.

* **자동 통계 수집 작업(Auto Task)**: 오라클은 매일 유지보수 윈도우(Maintenance Window, 기본 야간 22:00) 시간에 `DBMS_STATS.GATHER_*` 프로시저를 자동 실행하여 STALE 상태인 객체의 통계를 갱신합니다.
* **STALE 판정 기준**: 테이블의 전체 레코드 중 **10% 이상**의 DML 변경(INSERT/UPDATE/DELETE)이 발생하면 해당 객체의 통계는 STALE로 마킹됩니다.

**[실무 스크립트 3-1] 데이터 객체 통계 정보 노후화 및 신뢰성 진단**

```sql
SELECT ST.OWNER AS "소유자",
       ST.TABLE_NAME AS "테이블명",
       ST.NUM_ROWS AS "딕셔너리_레코드수",
       ST.BLOCKS AS "딕셔너리_블록수",
       TO_CHAR(ST.LAST_ANALYZED, 'YYYY-MM-DD HH24:MI') AS "최종_수집일시",
       ST.STALE_STATS AS "통계_노후화_여부"
  FROM DBA_TAB_STATISTICS ST
 WHERE ST.OWNER = '[SCHEMA_NAME]'
   AND ST.TABLE_NAME = '[TABLE_NAME]';
```

**[실무 스크립트 3-1b] 히스토그램 존재 여부 및 컬럼별 분포도 확인**

```sql
SELECT COLUMN_NAME AS "컬럼명",
       NUM_DISTINCT AS "고유값_수",
       NUM_NULLS AS "NULL_수",
       HISTOGRAM AS "히스토그램_유형",
       NUM_BUCKETS AS "버킷_수"
  FROM DBA_TAB_COL_STATISTICS
 WHERE OWNER = '[SCHEMA_NAME]'
   AND TABLE_NAME = '[TABLE_NAME]'
 ORDER BY COLUMN_NAME;
```

**[실무 스크립트 3-1c] 수동 통계 수집 명령 (긴급 상황용)**

```sql
-- 특정 테이블의 통계를 즉시 수집 (히스토그램 포함)
EXEC DBMS_STATS.GATHER_TABLE_STATS(
         ownname   => '[SCHEMA_NAME]',
         tabname   => '[TABLE_NAME]',
         estimate_percent => DBMS_STATS.AUTO_SAMPLE_SIZE,
         method_opt => 'FOR ALL COLUMNS SIZE AUTO',
         cascade    => TRUE  -- 해당 테이블의 인덱스 통계도 함께 수집
     );
```

---

## 3.2 DBMS_XPLAN 활용: 런타임 성능 지표를 포함한 플랜 추출 기법

단순 텍스트 플랜(`EXPLAIN PLAN FOR`)은 바인드 변수 상태나 메모리 적재 현황에 따라 실제 구동 플랜과 다를 수 있으므로, 반드시 실제 메모리와 디스크 히스토리에 바인딩된 런타임 실행 계획을 추출해야 합니다.

### 1) 메모리 캐시 기반 실시간 추적: DISPLAY_CURSOR

현재 메모리(Shared Pool 내 Library Cache)에 커서 형태로 상주하며 실행 중인 플랜과 자원 소모량을 직접 조회하는 방식입니다.

**[실무 스크립트 3-2] 런타임 프로파일링 지표를 포함한 실시간 실행 계획 추출**

```sql
SELECT * FROM TABLE(
         DBMS_XPLAN.DISPLAY_CURSOR(
           '[TARGET_SQL_ID]',
           NULL,
           'ALLSTATS LAST +COST +BYTES +NOTE'
         )
       );
```

* `ALLSTATS LAST` 옵션은 해당 쿼리가 가장 최근에 실행되었을 때의 실제 런타임 매트릭(실측 자원 소모량)을 출력하도록 명시합니다.
* `+COST`: 옵티마이저가 각 단계에 매긴 비용 수치를 함께 출력합니다.
* `+BYTES`: 각 단계에서 처리될 것으로 예상하는 데이터 크기(바이트)를 출력합니다.
* `+NOTE`: 플랜 하단의 참고 사항(동적 샘플링 적용 여부, 카디널리티 피드백 등)을 출력합니다.

### 2) 영구 저장소 기반 과거 시점 복원: DISPLAY_AWR

장애가 이미 종료되어 메모리 캐시에서 밀려난 과거의 SQL 문장은 AWR 히스토리 테이블에 보관된 실행 계획 스냅샷을 호출하여 정밀 복원해야 합니다.

**[실무 스크립트 3-3] AWR 성능 저장소 기반 실행 계획 역추적**

```sql
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_AWR('[TARGET_SQL_ID]'));
```

* 동일한 `SQL_ID`에 대해 여러 개의 실행 계획(Plan Hash Value)이 조회된다면 성능이 급격히 뒤바뀌는 플랜 변경 장애가 발생했음을 확정할 수 있습니다.

### 3) 실행 계획 비교를 위한 SQL_ID 및 Plan Hash Value 추출

**[실무 스크립트 3-3b] 특정 SQL의 실행 계획 변경 이력 추적**

```sql
SELECT SQL_ID,
       PLAN_HASH_VALUE AS "실행계획_해시",
       TO_CHAR(TIMESTAMP, 'YYYY-MM-DD HH24:MI') AS "플랜_캡처_시각",
       OPTIMIZER_COST AS "옵티마이저_비용"
  FROM DBA_HIST_SQL_PLAN
 WHERE SQL_ID = '[TARGET_SQL_ID]'
   AND ID = 0  -- 플랜 루트 노드만 추출
 ORDER BY TIMESTAMP;
```

* 동일 SQL_ID에 대해 서로 다른 `PLAN_HASH_VALUE`가 여러 건 검출된다면, 특정 시점에 실행 계획이 변경(Plan Flip)되었음을 증명합니다.

---

## 3.3 실행 계획 해독의 기술: 계층 구조 연산 순서와 주요 오퍼레이션

### 1) 트리 구조 들여쓰기(Indentation) 기반의 실행 순서 규칙

실행 계획은 계층형 트리 자료구조를 이룹니다. 들여쓰기 공간의 깊이에 따라 연산 순서를 판별하는 3가지 규칙은 다음과 같습니다.

1. **최우선 실행 원칙**: 들여쓰기가 가장 깊은 곳(오른쪽으로 가장 많이 밀려난 노드)에 위치한 오퍼레이션이 최초로 실행됩니다.
2. **동일 깊이 선위 실행 원칙**: 들여쓰기 깊이가 완전히 동일한 자식 노드가 여러 개 존재할 경우, 위에 있는 노드가 아래에 있는 노드보다 먼저 실행됩니다.
3. **부모-자식 관계**: 자식 노드의 연산이 종료되어 데이터 집합(Row Source)을 반환하면, 바로 위 레벨의 부모 노드가 해당 데이터를 입력값으로 받아 자신의 연산을 구동합니다.

### 2) 핵심 데이터 접근 경로 (Access Path) 종합

#### 가. TABLE ACCESS FULL (전체 테이블 스캔)
* 테이블의 첫 번째 블록부터 고수위선(HWM, High Water Mark) 아래의 모든 데이터 블록을 읽어 들입니다. OS 레벨의 다중 블록 읽기(Multi-Block I/O)를 사용하여 대량 데이터 처리에 유리합니다.
* **유리한 상황**: 조건절의 선택도가 낮아 전체 데이터의 10~15% 이상을 추출해야 하는 경우, 소규모 테이블(블록 수가 적은 경우).
* **불리한 상황**: 대용량 테이블에서 소량 데이터만 필요한 경우 과도한 디스크 I/O가 발생합니다.

#### 나. INDEX UNIQUE SCAN (인덱스 고유 스캔)
* 기본키(PK) 또는 유니크 인덱스를 경유하여 정확히 **1건**의 데이터를 검색합니다. B-Tree의 루트에서 리프까지 수직 하강 후, 단 하나의 ROWID로 테이블 블록에 접근합니다.
* **전제 조건**: 반드시 유니크 인덱스의 모든 구성 컬럼에 등치(=) 조건이 기입되어야 합니다.

#### 다. INDEX RANGE SCAN (인덱스 범위 스캔)
* B-Tree 인덱스의 루트 노드부터 시작하여 리프 노드까지 도달한 뒤, 정렬된 순서대로 인덱스를 범위 스캔하는 방식입니다. 소량 데이터를 고속 추출할 수 있으나, 건수가 많아지면 테이블 블록으로 넘어가는 무작위 접근(Random I/O) 비용이 폭증합니다.
* **핵심 포인트**: 범위 조건(`BETWEEN`, `>=`, `LIKE 'ABC%'`)이나 비유니크 인덱스의 등치 조건에서 발동됩니다.

#### 라. INDEX FULL SCAN (인덱스 전체 스캔)
* 인덱스의 리프 노드를 첫 번째부터 마지막까지 **순서대로(정렬 순서 보장)** 모두 탐색합니다. 테이블 접근 없이 인덱스 컬럼만으로 결과를 만들 수 있을 때(Index Only Access), 또는 `ORDER BY`절의 정렬 순서와 인덱스 정렬 순서가 일치하여 별도의 Sort 연산을 생략할 수 있을 때 선택됩니다.
* **비교**: Full Table Scan은 Multi-Block I/O를 사용하지만, Index Full Scan은 Single-Block I/O를 사용하므로 대용량 처리 시 상대적으로 느립니다.

#### 마. INDEX FAST FULL SCAN (인덱스 고속 전체 스캔)
* 인덱스의 물리적 블록을 Multi-Block I/O로 빠르게 퍼 올립니다. **정렬 순서를 보장하지 않으나**, Full Table Scan 대비 훨씬 작은 용량(인덱스 세그먼트)을 읽으므로 I/O 부하가 감소합니다.
* **활용 조건**: `SELECT`절과 `WHERE`절에 사용된 모든 컬럼이 하나의 인덱스 내에 포함되어 있어야 합니다. 병렬 쿼리(Parallel Query)와 결합이 가능합니다.

#### 바. INDEX SKIP SCAN (인덱스 스킵 스캔)
* 결합 인덱스(Composite Index)의 **선두 컬럼이 조건절에 없을 때**, 선두 컬럼의 고유 값별로 가상의 서브 인덱스를 생성하여 각각 범위 스캔을 수행합니다.
* **유리한 상황**: 선두 컬럼의 `NUM_DISTINCT`(고유 값 수)가 매우 적을 때 (예: 성별 컬럼 M/F 2종).
* **불리한 상황**: 선두 컬럼의 고유 값이 많으면 스킵 횟수가 폭증하여 오히려 Full Table Scan보다 느려집니다.

### 3) 핵심 조인 방식 (Join Method) 종합

#### 가. NESTED LOOPS (중첩 루프 조인)
* 선행 테이블(Driving Table)에서 조건에 맞는 행을 한 건 찾을 때마다 후행 테이블(Driven Table)의 인덱스를 매번 탐색하여 매칭합니다. 이중 For-Loop 문과 구조가 같습니다.
* **시간 복잡도**: $O(N \times M_{index})$ — 선행 건수 $N$이 소량이고 후행 테이블에 인덱스가 있을 때 최적입니다.
* **특성**: 첫 번째 결과 행이 즉시 반환되므로(부분 범위 처리) 온라인 화면 조회에 적합합니다.

#### 나. HASH JOIN (해시 조인)
* 조인 대상 중 크기가 작은 테이블(Build Input)을 먼저 전량 읽어 메모리(PGA) 내에 해시 테이블을 생성합니다. 이후 큰 테이블(Probe Input)을 스캔하면서 해시 함수를 통해 짝을 매칭하는 알고리즘입니다.
* **시간 복잡도**: $O(N + M)$ — 대용량 데이터 조인에 효율적입니다.
* **특성**: 모든 데이터를 처리한 후에야 결과를 반환합니다(전체 범위 처리). PGA 메모리가 부족하면 디스크 Temp 영역을 사용하여 성능이 저하됩니다.
* **전제 조건**: 등치 조인(=) 조건에서만 사용 가능합니다. 부등호 조인에서는 작동하지 않습니다.

#### 다. SORT MERGE JOIN (정렬 병합 조인)
* 두 테이블의 조인 키를 각각 정렬(Sort)한 후, 정렬된 두 결과 집합을 병합(Merge)하면서 매칭합니다.
* **시간 복잡도**: $O(N \log N + M \log M)$ — 정렬 비용이 주된 부담입니다.
* **특성**: 등치 조인(=)뿐 아니라 부등호 조인(`>=`, `BETWEEN`)에서도 사용 가능합니다. 두 테이블의 데이터가 이미 조인 키 순으로 정렬되어 있다면(인덱스 존재 시) Sort 단계를 생략하여 매우 효율적입니다.

#### [조인 방식 선택 요약 매트릭스]

| 판단 기준 | NESTED LOOPS | HASH JOIN | SORT MERGE JOIN |
| :--- | :--- | :--- | :--- |
| **데이터 규모** | 소량 (수천 건 이하) | 대량 (수만~수억 건) | 중~대량 |
| **인덱스 필요 여부** | 후행 테이블에 필수 | 불필요 | 불필요 (있으면 유리) |
| **조인 조건** | 등치/부등호 모두 가능 | 등치(=) 조건만 가능 | 등치/부등호 모두 가능 |
| **메모리 사용** | 최소 | PGA 해시 테이블 | PGA 정렬 영역 |
| **결과 반환 방식** | 부분 범위 처리 (즉시) | 전체 범위 처리 | 전체 범위 처리 |
| **주 사용 패턴** | 온라인 화면 조회 | 배치 대량 처리, 리포트 | 비등치 조인, 대량 정렬 |

### 4) 기타 주요 오퍼레이션

* **SORT ORDER BY**: `ORDER BY`절에 의한 결과 집합 정렬 연산입니다. PGA 메모리 내에서 처리되며, 데이터가 과대하면 Temp 디스크 영역을 사용합니다.
* **SORT GROUP BY**: `GROUP BY`절에 의한 그룹핑 및 집계 연산입니다.
* **HASH GROUP BY**: 오라클 10g 이상에서 해시 알고리즘을 활용한 그룹핑 연산입니다. 정렬을 수행하지 않으므로 `SORT GROUP BY`보다 효율적이나 결과 순서를 보장하지 않습니다.
* **FILTER**: 서브쿼리의 결과를 기반으로 메인 쿼리의 행을 걸러내는 연산입니다. 비상관(Uncorrelated) 서브쿼리는 1회만 실행되지만, 상관(Correlated) 서브쿼리는 메인 쿼리 행마다 반복 실행되어 심각한 성능 저하를 유발할 수 있습니다.
* **VIEW**: 인라인 뷰나 복합 뷰가 별도의 실행 블록으로 처리됨을 나타냅니다. 옵티마이저가 뷰를 해체(View Merging)하지 못한 경우에 나타나며, 불필요한 전체 데이터 처리를 유발할 수 있습니다.
* **COUNT STOPKEY**: `ROWNUM` 조건에 의해 특정 건수에 도달하면 하위 연산을 즉시 중단하는 최적화 오퍼레이션입니다.

---

## 3.4 성능 진단의 급소: 런타임 수리적 오차(E-Rows vs A-Rows) 분석 기술

수정이나 튜닝 지식이 없어도 실행 계획의 특정 라인에서 발생한 병목 현상과 원인을 규명하여 이관할 수 있는 핵심 진단 기술입니다.

### 1) 런타임 3대 핵심 지표의 정의

* **`Starts`**: 해당 연산 단계가 쿼리 수행 동안 실제로 호출되어 구동된 총 횟수입니다. 중첩 루프 조인 하위에 배치된 노드는 선행 테이블의 결과 건수만큼 반복 호출됩니다.
* **`E-Rows` (Estimated Rows)**: 통계 정보를 기반으로 옵티마이저가 파싱 시점에 예측한 행의 수입니다. **1회 실행 기준**의 예상값이므로, 총 예상 처리량은 `E-Rows x Starts`로 계산해야 합니다.
* **`A-Rows` (Actual Rows)**: 쿼리가 실행되면서 해당 노드가 실제로 처리하여 반환한 데이터의 실측 건수입니다. 모든 Starts 호출의 누적 합산값입니다.
* **`Buffers`**: 해당 단계에서 데이터를 읽기 위해 버퍼 캐시 상의 블록을 터치한 논리적 I/O 카운트입니다. 이 값이 클수록 해당 단계의 자원 소모가 과대합니다.
* **`Reads`**: 버퍼 캐시에 데이터가 없어 물리 디스크에서 직접 읽어 들인 블록 수입니다. Buffers 중에서 디스크 접근이 발생한 비율을 파악할 수 있습니다.

### 2) 수리적 불균형을 통한 악성 쿼리 진단 가이드

통계 정보가 정확한 정상 쿼리는 모든 연산 라인에서 다음의 수리적 균형 공식이 성립합니다.

$$\text{E-Rows} \times \text{Starts} \approx \text{A-Rows}$$

이 공식의 균형이 무너져 수백~수백만 배의 수리적 오차가 관측된다면, 그 라인이 바로 옵티마이저가 오판하여 시스템 자원을 폭식한 병목 지점(Root Cause)입니다.

**수리적 오차의 3대 발생 원인**:
1. **통계 정보 노후화**: 테이블 데이터가 대량 변경된 후 통계 정보가 갱신되지 않아 `NUM_ROWS`나 `NUM_DISTINCT` 값이 현실과 괴리됨.
2. **히스토그램 부재**: 데이터 분포가 극단적으로 편향(Skewed)된 컬럼에 히스토그램이 수집되지 않아 균등 분포를 가정함.
3. **복합 조건절 간 상관관계(Correlation)**: 옵티마이저는 `WHERE A = 1 AND B = 2` 조건에서 A와 B가 통계적으로 독립이라고 가정하지만, 실제로는 A와 B 사이에 강한 상관관계가 존재하는 경우.

### 3) 실전 런타임 플랜 해독 케이스 스터디

#### 케이스 A: 통계 노후화에 의한 조인 방식 오판

**[실행 대상 SQL]**
```sql
SELECT U.NAME, O.ORDER_ID, O.ORDER_DATE
  FROM TB_USER U
  JOIN TB_ORDER O ON U.USER_ID = O.USER_ID
 WHERE O.ORDER_DATE = TO_DATE('2026-05-18', 'YYYY-MM-DD');
```

```
------------------------------------------------------------------------------------------------------
| Id  | Operation                     | Name          | Starts | E-Rows | A-Rows | Buffers   | Cost  |
------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |               |      1 |        |      1 |       45M |  8725 |
|   1 |  NESTED LOOPS                 |               |      1 |      1 |      1 |       45M |  8725 |
|   2 |   TABLE ACCESS BY INDEX ROWID | TB_USER       |      1 |      1 |      1 |         4 |     3 |
|*  3 |    INDEX UNIQUE SCAN          | PK_USER       |      1 |      1 |      1 |         3 |     2 |
|   4 |   TABLE ACCESS BY INDEX ROWID | TB_ORDER      |      1 |      1 |    25M |       45M |  8722 |
|*  5 |    INDEX RANGE SCAN           | IX_ORDER_DATE |      1 |      1 |    25M |      200K |     4 |
------------------------------------------------------------------------------------------------------
```

* **연산 순서 판별**: 들여쓰기가 가장 깊은 `Id 3`번이 최초 실행되어 1건을 반환하고, 부모 노드인 `Id 2`번을 거쳐 `Id 1`번 `NESTED LOOPS` 조인으로 진입합니다. 조인 루프 횟수에 따라 후행 테이블인 `Id 5`번이 구동됩니다.
* **수리적 오차 추적**: `Id 5`번 단계를 보면 옵티마이저는 해당 날짜의 주문 데이터(`E-Rows`)가 단 **1건**일 것이라 예상했습니다. 그리하여 소량 처리에 유리한 **NESTED LOOPS 조인을 선택**했습니다.
* **병목 현상 산출**: 그러나 실제 런타임 환경에서 가동된 데이터(`A-Rows`)는 25,000,000건(25M)이었습니다. 1건이 터질 줄 알고 설계한 인덱스 스캔 노드에서 2,500만 건을 뒤지느라 `Buffers`를 **200,000번** 터치했고, 그 결과를 가지고 `Id 4`번 테이블 블록을 무작위 접근(Random I/O)하느라 무려 45,000,000번(45M)의 논리적 블록 읽기 과부하를 일으켰습니다.
* **최종 진단 결론**: `TB_ORDER` 테이블의 통계 정보 노후화로 인해 옵티마이저가 데이터 건수를 1건으로 오판했습니다. 대량 데이터 처리에 부적절한 중첩 루프 조인과 인덱스 레인지 스캔이 결합되어 논리적 블록 읽기 과부하(45M Buffers)를 발생시킨 병목 현상입니다. 테이블 통계 정보를 최신화하여 옵티마이저가 `HASH JOIN` 경로로 전환하도록 유도해야 합니다.

#### 케이스 B: 히스토그램 부재에 의한 접근 경로 오판

```
------------------------------------------------------------------------------------------------------
| Id  | Operation                     | Name              | Starts | E-Rows | A-Rows | Buffers | Cost |
------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |                   |      1 |        |     85 |      88 |  450 |
|   1 |  TABLE ACCESS BY INDEX ROWID  | TB_LOG            |      1 |  250K  |     85 |      88 |  450 |
|*  2 |   INDEX RANGE SCAN            | IX_LOG_STATUS     |      1 |  250K  |     85 |       3 |    4 |
------------------------------------------------------------------------------------------------------
   Predicate: STATUS = 'ERROR'
```

* **수리적 오차 추적**: `Id 2`번 인덱스 스캔에서 옵티마이저는 `STATUS = 'ERROR'` 조건에 매칭되는 건수를 **250,000건**(25만 건)으로 예측했습니다. 그러나 실제로는 **85건**만 존재했습니다.
* **원인 분석**: `STATUS` 컬럼의 `NUM_DISTINCT = 4`이고 `NUM_ROWS = 1,000,000`이므로, 히스토그램이 없는 상태에서 균등 분포를 가정하여 **1,000,000 ÷ 4 = 250,000** 건으로 계산한 것입니다. 실제로는 'ACTIVE' 99.5%, 'PENDING' 0.3%, 'CLOSED' 0.19%, 'ERROR' 0.01%의 극단적 편향 분포였습니다.
* **성능 영향**: 옵티마이저는 25만 건을 인덱스로 뽑으면 Random I/O가 과다하다고 판단하여, Full Table Scan이 더 저렴하다고 결론 내릴 수도 있었습니다. 이 케이스에서는 인덱스를 선택했지만, `E-Rows`를 25만 건으로 잡은 결과 후속 조인에서 HASH JOIN을 선택하는 등 연쇄적 오판이 발생합니다.
* **해결책**: `DBMS_STATS.GATHER_TABLE_STATS`에서 `method_opt => 'FOR COLUMNS SIZE 254 STATUS'`를 명시하여 `STATUS` 컬럼에 히스토그램을 수집합니다.

#### 케이스 C: 상관 서브쿼리에 의한 반복 실행 폭증

**[실행 대상 SQL]**
```sql
SELECT E.EMP_NAME, E.DEPT_NO, S.PAY_DATE, S.SALARY
  FROM TB_EMP E, TB_SALARY S
 WHERE S.EMP_ID = E.EMP_ID
   AND S.PAY_DATE = (
       SELECT MAX(SUB.PAY_DATE)
         FROM TB_SALARY SUB
        WHERE SUB.EMP_ID = E.EMP_ID
   );
```

```
------------------------------------------------------------------------------------------------------
| Id  | Operation                     | Name          | Starts | E-Rows | A-Rows | Buffers   | Cost  |
------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |               |      1 |        |    500 |      800K |    25 |
|*  1 |  FILTER                       |               |      1 |        |    500 |      800K |       |
|*  2 |   HASH JOIN                   |               |      1 |    500 |    500 |        90 |     8 |
|   3 |    TABLE ACCESS FULL          | TB_EMP        |      1 |    500 |    500 |        40 |     3 |
|   4 |    TABLE ACCESS FULL          | TB_SALARY     |      1 |   1000 |   1000 |        50 |     4 |
|*  5 |   TABLE ACCESS FULL           | TB_SALARY     |    500 |      1 |    450 |      800K |    17 |
------------------------------------------------------------------------------------------------------
   Predicate Information (identified by operation id):
   ---------------------------------------------------
   1 - filter(S.PAY_DATE = (SELECT MAX(PAY_DATE) FROM TB_SALARY SUB WHERE SUB.EMP_ID = E.EMP_ID))
   2 - access(S.EMP_ID = E.EMP_ID)
```

* **수리적 오차 추적**: `Id 5`번 `TB_SALARY` 풀 스캔의 `Starts`가 **500**입니다. 이는 메인 조인 결과 500건에 대해 상관 서브쿼리가 매 행마다 반복 실행되었음을 의미합니다.
* **병목 산출**: `TB_SALARY` 테이블이 한 번 풀 스캔할 때 1,600블록을 읽는다면, 500번 반복 시 **500 × 1,600 = 800,000** 블록(800K Buffers)의 논리적 I/O가 누적됩니다.
* **해결책**: 상관 서브쿼리를 인라인 뷰 + 조인으로 변환(Subquery Unnesting)하거나, 분석 함수(`ROW_NUMBER() OVER(PARTITION BY ...)`)를 활용하여 1회 스캔으로 전환합니다.

---

## 3.5 플랜 변경(Plan Regression) 장애 대응

### 1) 플랜 변경 장애란?

어제까지 0.1초에 실행되던 쿼리가 갑자기 30초 이상 걸리기 시작하는 현상입니다. SQL 소스 코드가 전혀 변경되지 않았는데도, 옵티마이저가 기존의 최적 실행 계획을 포기하고 비효율적인 대안 경로로 전환한 것이 원인입니다.

### 2) 플랜 변경의 주요 트리거

| 트리거 | 메커니즘 | 빈도 |
| :--- | :--- | :--- |
| **자동 통계 수집** | 야간 배치 작업 후 통계가 갱신되며 비용 계산 결과가 달라짐 | 매우 잦음 |
| **바인드 변수 피킹(Bind Variable Peeking)** | 최초 하드 파싱 시 입력된 바인드 값의 분포가 이후 실행과 다름 | 잦음 |
| **적응형 커서 공유(Adaptive Cursor Sharing)** | 옵티마이저가 런타임 피드백을 기반으로 새 플랜을 시도 | 간헐적 |
| **DB 패치/업그레이드** | 옵티마이저 알고리즘 변경 | 드문 편 |

### 3) 긴급 대응: SQL Plan Baseline을 활용한 플랜 고정

성능이 보장된 기존 실행 계획을 SQL Plan Management(SPM) 기능으로 등록하여, 옵티마이저가 반드시 해당 경로만 사용하도록 강제합니다.

**[실무 스크립트 3-4] 현재 메모리의 양호한 플랜을 Baseline으로 고정**

```sql
-- 1단계: 양호한 플랜의 SQL_ID와 PLAN_HASH_VALUE를 확인한 후 로드
DECLARE
  v_plans PLS_INTEGER;
BEGIN
  v_plans := DBMS_SPM.LOAD_PLANS_FROM_CURSOR_CACHE(
               sql_id          => '[TARGET_SQL_ID]',
               plan_hash_value => [GOOD_PLAN_HASH_VALUE],
               fixed           => 'YES',
               enabled         => 'YES'
             );
  DBMS_OUTPUT.PUT_LINE('Loaded plans: ' || v_plans);
END;
/
```

```sql
-- 2단계: 등록된 Baseline 확인
SELECT SQL_HANDLE,
       PLAN_NAME,
       ENABLED,
       ACCEPTED,
       FIXED,
       OPTIMIZER_COST
  FROM DBA_SQL_PLAN_BASELINES
 WHERE SQL_TEXT LIKE '%[쿼리_일부_키워드]%';
```

---

## 3.6 옵티마이저 힌트(Hint)의 원리와 실무 활용

### 1) 힌트란?

SQL 문장 내에 `/*+ HINT_NAME */` 형태로 기입하는 옵티마이저 지시자(Directive)입니다. 통계 정보 기반의 비용 계산 결과를 무시하고, DBA가 직접 접근 경로나 조인 방식을 강제 지정할 때 사용합니다.

### 2) 핵심 힌트 종합

#### 접근 경로 제어 힌트
* **`/*+ FULL(table_alias) */`**: 지정된 테이블을 강제로 Full Table Scan하도록 유도합니다.
* **`/*+ INDEX(table_alias index_name) */`**: 지정된 인덱스를 강제 사용하도록 유도합니다.
* **`/*+ INDEX_FFS(table_alias index_name) */`**: Index Fast Full Scan을 강제합니다.
* **`/*+ NO_INDEX(table_alias index_name) */`**: 특정 인덱스의 사용을 금지합니다.

#### 조인 방식 제어 힌트
* **`/*+ USE_NL(table_alias) */`**: 지정된 테이블을 후행(Driven)으로 Nested Loops 조인을 강제합니다.
* **`/*+ USE_HASH(table_alias) */`**: 지정된 테이블을 대상으로 Hash Join을 강제합니다.
* **`/*+ USE_MERGE(table_alias) */`**: Sort Merge Join을 강제합니다.
* **`/*+ LEADING(t1 t2 t3) */`**: 조인 순서를 t1 -> t2 -> t3 순으로 강제 지정합니다.

#### 기타 유용한 힌트
* **`/*+ PARALLEL(table_alias, degree) */`**: 병렬 처리 활성화. 대용량 배치 쿼리에 사용합니다.
* **`/*+ GATHER_PLAN_STATISTICS */`**: 실행 시 런타임 통계(A-Rows, Buffers 등)를 수집하도록 합니다. `DISPLAY_CURSOR`의 `ALLSTATS LAST` 출력을 위한 전제 조건입니다.
* **`/*+ OPT_PARAM('_optimizer_use_feedback', 'false') */`**: 카디널리티 피드백 기능을 해당 쿼리에 한정하여 비활성화합니다.

### 3) 힌트 사용 시 주의사항

* 힌트는 **최후의 수단**으로만 사용해야 합니다. 데이터 분포가 변하면 고정된 힌트가 오히려 성능을 악화시킬 수 있습니다.
* 힌트 문법 오류(오타, 잘못된 alias)가 있으면 오라클은 **에러를 발생시키지 않고 힌트를 무시**합니다. 반드시 실행 계획을 확인하여 힌트가 적용되었는지 검증해야 합니다.
* 장기적으로는 통계 정보 최신화와 SQL Plan Baseline 관리가 힌트 의존보다 안정적입니다.

---

## 3.7 실전 이슈 분석 시나리오 (Case Studies)

### [이슈 1] 야간 통계 수집 후 플랜 변경으로 인한 주간 서비스 장애

* **이슈 현상**: 매일 오전 09시 서비스 시작 후 특정 주문 조회 화면의 응답 시간이 0.2초에서 45초로 급증하며, 연쇄적으로 WAS 커넥션 풀이 고갈되어 전체 서비스 장애로 확산됨.
* **현장 데이터 분석 단계**:
  1. AWR 리포트의 `SQL ordered by Elapsed Time` 섹션에서 특정 SQL_ID가 전체 DB Time의 **62%**를 독식하고 있음을 확인.
  2. `DISPLAY_AWR`로 해당 SQL의 과거 실행 계획을 조회한 결과, **어제(PLAN_HASH_VALUE: 1234567)**까지 `INDEX RANGE SCAN + NESTED LOOPS`로 0.2초에 실행되던 쿼리가, **오늘(PLAN_HASH_VALUE: 9876543)** `TABLE ACCESS FULL + HASH JOIN`으로 변경되어 45초로 폭증함.
  3. 원인 추적: 야간 자동 통계 수집 작업이 `TB_ORDER` 테이블의 통계를 갱신하면서 `CLUSTERING_FACTOR` 값이 변동되어 옵티마이저의 인덱스 비용 계산 결과가 뒤바뀜.

* **긴급 조치**: `DBMS_SPM.LOAD_PLANS_FROM_CURSOR_CACHE`를 활용하여 기존 양호한 플랜(PLAN_HASH_VALUE: 1234567)을 SQL Plan Baseline으로 고정 등록.
* **근본 해결**: 통계 수집 시 해당 테이블은 고정 통계(Locked Statistics)로 보호하여 자동 갱신 대상에서 제외.

**[실무 스크립트 3-5] 테이블 통계 고정(Lock) 및 해제**

```sql
-- 특정 테이블의 통계를 고정하여 자동 수집 대상에서 제외
EXEC DBMS_STATS.LOCK_TABLE_STATS('[SCHEMA_NAME]', '[TABLE_NAME]');

-- 수동으로 통계를 갱신할 때는 먼저 해제 후 수집
EXEC DBMS_STATS.UNLOCK_TABLE_STATS('[SCHEMA_NAME]', '[TABLE_NAME]');
EXEC DBMS_STATS.GATHER_TABLE_STATS('[SCHEMA_NAME]', '[TABLE_NAME]', cascade => TRUE);
EXEC DBMS_STATS.LOCK_TABLE_STATS('[SCHEMA_NAME]', '[TABLE_NAME]');
```

### [이슈 2] 묵시적 형변환에 의한 인덱스 무력화 장애

* **이슈 현상**: 회원번호(`MEMBER_NO VARCHAR2(10)`) 기반 조회 API가 평소 5ms 내에 응답하다가, 특정 개발팀의 신규 배포 이후 3초 이상 지연 발생.
* **현장 데이터 분석 단계**:
  1. `DISPLAY_CURSOR`로 해당 SQL의 실행 계획 추출:
  ```
  | Id  | Operation         | Name      | Starts | E-Rows | A-Rows | Buffers |
  |   0 | SELECT STATEMENT  |           |      1 |        |      1 |   24500 |
  |*  1 |  TABLE ACCESS FULL| TB_MEMBER |      1 |      1 |      1 |   24500 |
  -----------------------------------------------------------------------
     Predicate: TO_NUMBER("MEMBER_NO") = 2026001234
  ```
  2. `Predicate` 섹션을 주목: 옵티마이저가 `MEMBER_NO` 컬럼에 `TO_NUMBER()` 함수를 자동 적용했습니다. 이는 **묵시적 형변환(Implicit Type Conversion)**이 발생한 증거입니다.
  3. 원인: 신규 배포된 Java 소스에서 `PreparedStatement`의 파라미터를 `setInt(1, memberNo)`로 기입하여 숫자형으로 전달했습니다. DB 컬럼은 문자형(`VARCHAR2`)이므로, 옵티마이저는 컬럼 전체에 `TO_NUMBER()` 변환을 적용하여 기존 인덱스(`IX_MEMBER_NO`)를 사용할 수 없게 만들었습니다.

* **해결**: Java 소스의 파라미터 기입을 `setString(1, String.valueOf(memberNo))`으로 수정하여 문자형으로 전달하도록 교정합니다. 추가로, 인덱스가 정상 작동하는지 `DISPLAY_CURSOR`로 재검증합니다.

---

## 3.8 학습 성취도 평가 문제

1. **실행 계획 분석 중, 특정 조인 단계의 `Starts` 수치가 50,000이고 해당 단계 하위의 `INDEX RANGE SCAN` 오퍼레이션에서 `E-Rows`가 1, `A-Rows`가 2로 확인되었습니다. 이 노드의 총 `Buffers` 수치는 150,000입니다. 이 연산 과정의 비효율성을 수리적으로 논하고 병목 유무를 진단하시오.**

   * *모범 답안*: 단일 수행당 실제 건수는 `A-Rows / Starts = 2 / 50,000 = 0.00004`건으로 매우 소량이며, 예상치인 `E-Rows = 1`과도 큰 오차가 없어 옵티마이저의 데이터 예측 자체는 정합성을 유지하고 있습니다. 그러나 이 단계가 중첩 루프 조인의 하위 루프로 배치되어 총 50,000번(`Starts`) 반복 호출되고 있다는 점이 부하 요인입니다. 인덱스 범위 스캔은 수행될 때마다 인덱스 트리를 타며 최소 3~4개의 블록을 읽어야 하므로, 단 건 조회라 하더라도 호출 횟수와 곱해져 총 `Buffers = 150,000`번의 자원 누적 오버헤드를 발생시킵니다. 즉, 인덱스 자체의 결함이라기보다 선행 테이블의 결과 집합이 대량임에도 중첩 루프 조인을 선택하여 발생한 '조인 루프 횟수 폭증에 따른 미시적 자원 누적 병목'입니다. 대량 연산에 유리한 `HASH JOIN` 방식으로 조인 경로를 변경하도록 조치해야 합니다.

2. **AWR 리포트에서 `Soft Parse %` 지표가 99.8%이고 `Buffer Hit %`가 72%인 시스템이 있습니다. 이 시스템의 성능 상태를 진단하고, 조사해야 할 대기 이벤트와 1차 해결 방향을 논하시오.**

   * *모범 답안*: `Soft Parse %`가 99.8%이므로 SQL 재사용률은 양호하여 하드 파싱 문제는 배제됩니다. 그러나 `Buffer Hit %`가 72%로, 정상 기준(95% 이상)에 크게 미달합니다. 이는 전체 쿼리의 28%가 메모리(Buffer Cache)에 캐싱된 데이터가 아닌 물리 디스크에서 데이터를 직접 읽고 있음을 의미합니다. AWR의 `Top Foreground Wait Events` 섹션에서 `db file scattered read` (Full Table Scan) 또는 `db file sequential read` (인덱스 경유 Random I/O) 이벤트가 상위권에 위치할 것으로 예상됩니다. 우선적으로 `SQL ordered by Physical Reads` 섹션에서 물리 읽기가 과다한 SQL을 추출하여 인덱스 부재 여부를 점검하고, 필요시 적절한 인덱스 구축 또는 쿼리 조건절 최적화를 수행해야 합니다.

3. **결합 인덱스가 `(DEPT_CODE, EMP_NAME)` 순서로 구성된 테이블에서 `WHERE EMP_NAME = '홍길동'` 조건만으로 조회할 때, 옵티마이저가 선택할 수 있는 접근 경로와 그 효율성을 논하시오.**

   * *모범 답안*: 결합 인덱스의 선두 컬럼인 `DEPT_CODE`가 조건절에 없으므로, 일반적인 Index Range Scan은 불가능합니다. 옵티마이저는 두 가지 대안을 고려합니다. (1) **Index Skip Scan**: `DEPT_CODE`의 고유 값(NUM_DISTINCT)이 적다면(예: 부서 코드 10개), 가상으로 10개의 서브 인덱스를 만들어 각각 `EMP_NAME = '홍길동'`을 탐색합니다. 부서가 적을수록 효율적이지만, 부서가 500개라면 500번의 스킵이 발생하여 Full Table Scan보다 느려집니다. (2) **Table Access Full**: 테이블 전체를 Multi-Block I/O로 스캔합니다. 데이터 규모가 작거나 선두 컬럼의 종류가 많을 때 옵티마이저가 이 경로를 선택합니다. 근본적 해결책은 `EMP_NAME` 단독 인덱스를 추가로 생성하거나, 결합 인덱스의 컬럼 순서를 조회 패턴에 맞게 재설계하는 것입니다.

4. **아래의 실행 계획에서 힌트를 사용하지 않고 HASH JOIN으로 유도하기 위한 가장 바람직한 DBA 조치를 논하시오.**
   ```
   | Id  | Operation                     | Name      | E-Rows | Cost  |
   |   1 |  NESTED LOOPS                 |           |      1 |    10 |
   |   2 |   TABLE ACCESS BY INDEX ROWID | TB_DEPT   |      1 |     3 |
   |   3 |    INDEX UNIQUE SCAN          | PK_DEPT   |      1 |     2 |
   |   4 |   TABLE ACCESS BY INDEX ROWID | TB_EMP    |      1 |     7 |
   |   5 |    INDEX RANGE SCAN           | IX_EMP_DN |      1 |     3 |
   ```

   * *모범 답안*: `TB_EMP` 테이블의 `E-Rows`가 1건으로 표시되어 있으므로, 옵티마이저가 소량 데이터로 판단하여 Nested Loops 조인을 선택한 것입니다. 힌트 없이 Hash Join으로 유도하려면 `TB_EMP` 테이블의 통계 정보를 정확하게 갱신하여 `NUM_ROWS`와 `CLUSTERING_FACTOR` 등 실제 데이터 규모를 옵티마이저에게 반영해야 합니다. `DBMS_STATS.GATHER_TABLE_STATS` 프로시저로 최신 통계를 수집하면, 옵티마이저는 실제 대량 건수에 기반하여 비용을 재계산하고 대량 처리에 유리한 Hash Join을 자동 선택하게 됩니다. 힌트를 통한 강제 지정은 데이터 분포 변경 시 오히려 성능을 저하시킬 수 있으므로, 통계 정보 최신화가 가장 바람직한 근본 해결책입니다.
