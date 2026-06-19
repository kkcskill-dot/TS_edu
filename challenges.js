/* -------------------------------------------------------------
 * TS class Challenges Database
 * Real-world SQL Tuning Exercises for Developers
 * ------------------------------------------------------------- */

const sqlChallenges = {
  1: {
    level: 1,
    name: "기본 인덱스 부재 (Missing Index)",
    desc: "회원 테이블(USERS)에서 특정 가입일을 기준으로 가입한 사용자를 조회하는 화면입니다. 현재 하루에 10만 건 이상의 가입 데이터가 들어오지만 성능이 초 단위로 늘어지고 있습니다. 쿼리와 테이블 구조를 보고 알맞은 튜닝 방안을 선택하세요.",
    asisSql: "SELECT * FROM users WHERE register_date = '2026-05-18';",
    tobeSql: "SELECT * FROM users WHERE register_date = '2026-05-18'; -- (인덱스 활용)",
    dialectData: {
      oracle: {
        asisPlan: "TABLE ACCESS FULL (USERS)",
        tobePlan: "INDEX RANGE SCAN (IDX_USERS_REGDATE)"
      }
    },
    asisMetrics: {
      io: "24,500 Blocks",
      time: "3,200 ms",
      plan: "TABLE ACCESS FULL"
    },
    tobeMetrics: {
      io: "8 Blocks",
      time: "1.2 ms",
      plan: "INDEX RANGE SCAN"
    },
    options: [
      {
        id: "opt-A",
        title: "register_date 컬럼에 단일 인덱스 생성",
        desc: "CREATE INDEX idx_users_regdate ON users(register_date)를 생성하여 옵티마이저가 인덱스 탐색을 타도록 유도합니다.",
        isCorrect: true,
        feedback: "정답입니다! register_date 컬럼에 단일 인덱스를 생성함으로써 데이터베이스는 2만 개가 넘는 데이터 블록을 처음부터 끝까지 다 뒤지던 Full Table Scan을 멈추고, Index Range Scan을 통해 단 몇 개의 인덱스 블록 및 대상 테이블 블록만을 스캔하게 되어 99% 이상의 I/O 비용을 절감합니다."
      },
      {
        id: "opt-B",
        title: "SELECT * 대신 SELECT register_date로 컬럼만 제한",
        desc: "전체 컬럼(*)을 조회하지 않고 필요한 날짜 컬럼만 명시하여 데이터 통신 크기를 줄입니다.",
        isCorrect: false,
        feedback: "오답입니다. 조회할 컬럼 수를 줄이면 네트워크 전송 부하는 다소 줄어들 수 있으나, 테이블 전체 블록을 읽는 Full Table Scan 병목 현상은 전혀 해결되지 않습니다. 여전히 디스크 Read 대기가 심각할 것입니다."
      },
      {
        id: "opt-C",
        title: "서버 사양 업그레이드 (Scale-Up)",
        desc: "하드웨어 CPU와 메모리(SGA/PGA) 용량을 추가하여 테이블을 완전히 메모리에 올려 처리하게 합니다.",
        isCorrect: false,
        feedback: "오답입니다. 하드웨어 스케일업은 임시 방편에 불과합니다. 하루에 10만 건씩 증가하는 테이블을 인덱스 없이 다 뒤지는 쿼리는 조만간 더 거대한 I/O 병목에 직면하게 되며, 비효율적인 비용 낭비입니다."
      }
    ]
  },
  2: {
    level: 2,
    name: "인덱스 사용 차단 패턴 (Leading Wildcard LIKE)",
    desc: "상품 테이블(PRODUCTS)의 상품명(product_name) 조건에 이미 인덱스가 걸려있음에도, 앞뒤로 와일드카드를 결합한 부분 검색을 수행하자 5초 이상 쿼리가 지연되며 CPU 사용량이 치솟고 있습니다.",
    asisSql: "SELECT * FROM products WHERE product_name LIKE '%Galaxy%';",
    tobeSql: "SELECT * FROM products WHERE product_name LIKE 'Galaxy%';",
    dialectData: {
      oracle: {
        asisPlan: "TABLE ACCESS FULL (PRODUCTS)",
        tobePlan: "INDEX RANGE SCAN (IDX_PRODUCT_NAME)"
      }
    },
    asisMetrics: {
      io: "45,000 Blocks",
      time: "5,100 ms",
      plan: "TABLE ACCESS FULL"
    },
    tobeMetrics: {
      io: "12 Blocks",
      time: "2.4 ms",
      plan: "INDEX RANGE SCAN"
    },
    options: [
      {
        id: "opt-A",
        title: "기존 인덱스를 삭제하고 복합 인덱스로 재생성",
        desc: "상품명과 다른 컬럼을 묶어 새로운 인덱스를 만들고 성능 상승을 유도합니다.",
        isCorrect: false,
        feedback: "오답입니다. 아무리 정교한 인덱스나 복합 인덱스를 만들더라도 검색 문자열의 제일 앞에 와일드카드(%)가 있으면 정렬 기반 탐색인 B-Tree 구조상 첫 시작점을 찾을 수 없어 인덱스를 사용할 수 없습니다."
      },
      {
        id: "opt-B",
        title: "비즈니스 로직을 전방 매칭(Prefix) 검색으로 수정",
        desc: "LIKE 'Galaxy%' 형태로 검색 조건을 강제하여 인덱스 스캔의 최적 정렬 순서를 태우도록 변경합니다.",
        isCorrect: true,
        feedback: "정답입니다! LIKE 검색 시 앞부분에 `%`가 없으면(전방 매칭), B-Tree 인덱스는 인덱스 시작 노드부터 문자가 사전순으로 일치하는 구간을 찾아 바로 탐색하는 'Index Range Scan'을 개시할 수 있습니다. 부득이하게 양방향 검색이 필요하다면 DBMS 인덱스 대신 ElasticSearch 같은 형태소 역색인 엔진을 연동하는 것이 정석입니다."
      },
      {
        id: "opt-C",
        title: "ORDER BY product_name DESC 정렬 구문 추가",
        desc: "정렬 구문을 쿼리에 추가함으로써 옵티마이저가 정렬된 인덱스를 사용하도록 강제합니다.",
        isCorrect: false,
        feedback: "오답입니다. `ORDER BY`를 추가하면 인덱스를 사용할 수는 있지만, 이미 LIKE '%Galaxy%' 조건 때문에 전체 테이블을 필터링해야 하므로 오히려 엄청난 용량의 Sort Buffer 메모리 부하와 임시 세그먼트 I/O 병목만 가중시킵니다."
      }
    ]
  },
  3: {
    level: 3,
    name: "형변환 및 컬럼 가공 오류 (Implicit Type Conversion)",
    desc: "주문 테이블(ORDERS)의 주문번호(order_no)는 문자형(VARCHAR2) 컬럼이며 인덱스가 구축되어 있습니다. 그런데 개발자가 편의상 조회 쿼리에 숫자 상수(2026051801)를 그대로 대입하자 인덱스가 작동을 멈추고 느려졌습니다.",
    asisSql: "SELECT * FROM orders WHERE order_no = 2026051801; -- (참고: order_no는 문자형)",
    tobeSql: "SELECT * FROM orders WHERE order_no = '2026051801';",
    dialectData: {
      oracle: {
        asisPlan: "TABLE ACCESS FULL (ORDERS)",
        tobePlan: "INDEX UNIQUE SCAN (IDX_ORDER_NO)"
      }
    },
    asisMetrics: {
      io: "18,200 Blocks",
      time: "1,800 ms",
      plan: "TABLE ACCESS FULL (Implicit)"
    },
    tobeMetrics: {
      io: "3 Blocks",
      time: "0.4 ms",
      plan: "INDEX UNIQUE SCAN"
    },
    options: [
      {
        id: "opt-A",
        title: "상수 값을 문자열 리터럴로 명시하여 대입",
        desc: "order_no = '2026051801' 과 같이 싱글 쿼테이션을 붙여 컬럼의 원본 타입을 훼손하지 않게 합니다.",
        isCorrect: true,
        feedback: "완벽한 정답입니다! 컬럼의 데이터 타입(VARCHAR2)과 조건절 입력 값의 타입(Number)이 매칭되지 않으면 데이터베이스 엔진은 컬럼을 내부적으로 변형하여 비교하는 묵시적 형변환(예: TO_NUMBER(order_no) = 2026051801)을 작동시킵니다. 인덱스가 적용된 컬럼 자체에 가공이 발생하면 인덱스를 전혀 타지 못하고 Full Table Scan을 하게 되므로, 타입을 명확히 맞추는 습관은 매우 기본적이면서 극적인 튜닝법입니다."
      },
      {
        id: "opt-B",
        title: "옵티마이저 힌트 사용",
        desc: "/*+ INDEX(orders idx_order_no) */ 힌트 구문을 강제로 삽입하여 강제적 인덱스 스캔을 실행시킵니다.",
        isCorrect: false,
        feedback: "오답입니다. 형변환이 발생하는 조건에서는 힌트를 부여하더라도 억지로 인덱스 전체를 훑는 비효율적인 Index Full Scan을 유발하거나, 옵티마이저가 힌트를 완전히 무시하고 여전히 Full Table Scan을 수행하게 됩니다."
      },
      {
        id: "opt-C",
        title: "order_no 컬럼 데이터를 숫자형으로 물리적 타입 변경",
        desc: "DB 테이블의 해당 컬럼 설정을 통째로 숫자형(NUMBER) 컬럼으로 마이그레이션 및 재구축합니다.",
        isCorrect: false,
        feedback: "오답입니다. 이미 대량의 실데이터가 적재되어 있는 운영 서버에서 컬럼의 물리적 데이터 타입을 수정하는 DDL 작업은 테이블 전체 락(Lock)을 유발하고 대규모 데이터 마이그레이션 리스크가 뒤따르는 대단히 위험한 접근이며, 올바른 소프트 튜닝이 아닙니다."
      }
    ]
  },
  4: {
    level: 4,
    name: "비효율적 대량 서브쿼리 (Slow EXISTS Subquery)",
    desc: "VIP 등급(grade = 'VIP')인 고객들의 모든 주문 데이터를 찾기 위해 EXISTS 절 서브쿼리를 사용했으나, 주문 건수가 늘어남에 따라 서브쿼리가 매 행마다 동작하여 조회 응답 시간이 10초에 임박합니다. 성능을 최적화하세요.",
    asisSql: "SELECT * FROM orders o \nWHERE EXISTS (\n  SELECT 1 FROM users u \n  WHERE u.id = o.user_id AND u.grade = 'VIP'\n);",
    tobeSql: "SELECT o.* \nFROM orders o \nJOIN users u ON o.user_id = u.id \nWHERE u.grade = 'VIP';",
    dialectData: {
      oracle: {
        asisPlan: "TABLE ACCESS FULL & NESTED SUBQUERY",
        tobePlan: "HASH JOIN (HASH JOIN / INDEX SCAN)"
      }
    },
    asisMetrics: {
      io: "82,000 Blocks",
      time: "9,400 ms",
      plan: "NESTED SUBQUERY SCAN"
    },
    tobeMetrics: {
      io: "92 Blocks",
      time: "15 ms",
      plan: "HASH JOIN"
    },
    options: [
      {
        id: "opt-A",
        title: "EXISTS 구문을 IN 구문으로 변경하고 인덱스 힌트 삽입",
        desc: "EXISTS 연산 대신 단순 IN 조건절로 변경한 후 서브쿼리를 동작시킵니다.",
        isCorrect: false,
        feedback: "오답입니다. 최신 옵티마이저는 IN과 EXISTS를 대부분 유사한 실행 경로(Semi-Join)로 자동 변환하여 처리하므로, 쿼리 구문의 단순한 교체와 힌트만으로는 복잡한 다중 서브쿼리 대용량 탐색 병목을 완벽히 해결하기 힘듭니다."
      },
      {
        id: "opt-B",
        title: "명시적 INNER JOIN으로 전환하여 옵티마이저의 조인 최적화 유도",
        desc: "두 테이블을 명시적으로 JOIN하고 VIP 조건에 인덱스 필터를 적용하도록 쿼리를 리팩토링합니다.",
        isCorrect: true,
        feedback: "훌륭한 튜닝 역량입니다! 억지로 루프를 돌리는 대량 서브쿼리 형태를 명시적 INNER JOIN으로 리팩토링하면, DBMS 옵티마이저는 두 테이블의 통계 정보(크기, 분포도)를 정확히 비교하여 가장 저렴한 조인 방식(예: 작은 테이블인 users를 메모리에 얹는 Hash Join 또는 인덱스를 타는 Nested Loops Join)을 유연하게 선택해 극적인 최적화를 이뤄냅니다."
      },
      {
        id: "opt-C",
        title: "EXISTS 내 서브쿼리를 제거하고 두 개의 쿼리로 나누어 애플리케이션에서 직접 매핑",
        desc: "VIP 회원 ID 목록을 조회하는 쿼리를 먼저 돌린 뒤, 그 ID 목록을 IN 절에 넣어 다시 주문 쿼리를 조회합니다.",
        isCorrect: false,
        feedback: "반쪽짜리 답변입니다. VIP 고객 수가 수만 명에 이르는 경우 애플리케이션 메모리에 그 방대한 ID를 담아 보내는 쿼리(`WHERE user_id IN (1, 2, ..., 50000)`)는 최악의 네트워크 오버헤드를 야기하고 파싱 에러(ORA-01795)를 유발할 수 있습니다."
      }
    ]
  },
  5: {
    level: 5,
    name: "결합 인덱스 컬럼 순서 지정 오류 (Composite Index Column Ordering)",
    desc: "주문 테이블(ORDERS)에서 특정 상점(store_id)의 배송 완료(status = 'DELIVERED') 건을 조회하는 쿼리가 매우 늘어지고 있습니다. 현재 테이블에는 status가 선두 컬럼이고 store_id가 후행 컬럼인 결합 인덱스(status, store_id)가 생성되어 있습니다. status는 종류가 3개뿐이라 변별력이 매우 낮고, store_id는 5,000종류로 변별력이 높습니다. 스캔 범위가 너무 비대해져 I/O 부하가 높습니다.",
    asisSql: "SELECT * FROM orders WHERE status = 'DELIVERED' AND store_id = 999;",
    tobeSql: "SELECT * FROM orders WHERE store_id = 999 AND status = 'DELIVERED'; -- (IDX_ORDERS_STORE_STATUS 결합 인덱스 사용)",
    dialectData: {
      oracle: {
        asisPlan: "INDEX RANGE SCAN (IDX_ORDERS_STATUS_STORE) -- (대량 블록 스캔)",
        tobePlan: "INDEX RANGE SCAN (IDX_ORDERS_STORE_STATUS) -- (최소 블록 스캔)"
      }
    },
    asisMetrics: {
      io: "12,400 Blocks",
      time: "1,500 ms",
      plan: "INDEX RANGE SCAN (status, store_id)"
    },
    tobeMetrics: {
      io: "6 Blocks",
      time: "0.8 ms",
      plan: "INDEX RANGE SCAN (store_id, status)"
    },
    options: [
      {
        id: "opt-5A",
        title: "SQL 조건절의 기술 순서를 WHERE store_id = 999 AND status = 'DELIVERED' 로 단순히 순서 변경",
        desc: "쿼리 조건절의 선두 순서를 인덱스 순서와 무관하게 변별력이 높은 컬럼부터 배치하여 옵티마이저의 동작을 개선합니다.",
        isCorrect: false,
        feedback: "오답입니다. SQL 조건절 내의 조건 나열 순서는 옵티마이저가 실행 계획을 세울 때 자동으로 최적화하므로 성능에 전혀 영향을 미치지 않습니다. 인덱스 구성 컬럼의 실제 정렬 순서(인덱스 정의)가 핵심입니다."
      },
      {
        id: "opt-5B",
        title: "결합 인덱스의 순서를 변별력이 높은 컬럼이 앞서도록 (store_id, status) 순으로 재생성",
        desc: "= 조건으로 상시 사용되는 컬럼 중 카디널리티가 높은(분포도가 좋은) store_id를 선두 컬럼으로 배치해 리프 노드 스캔을 최소화합니다.",
        isCorrect: true,
        feedback: "정답입니다! 결합 인덱스를 구성할 때, '=' 조건으로 조회되는 두 컬럼 중 카디널리티가 압도적으로 높은(중복도가 낮은) 컬럼을 인덱스 선두에 배치해야 인덱스 리프 노드 스캔 범위를 최소한으로 좁힐 수 있습니다. status를 선두에 두면 'DELIVERED'에 해당하는 수많은 데이터를 인덱스 레벨에서 무수히 스캔하며 필터링하게 되어 비효율적입니다."
      },
      {
        id: "opt-5C",
        title: "status 컬럼과 store_id 컬럼에 각각 단일 인덱스를 추가하여 개별 탐색 유도",
        desc: "두 컬럼 각각에 단일 컬럼 인덱스를 두어, 옵티마이저가 Index Merge를 통해 교집합을 찾도록 유도합니다.",
        isCorrect: false,
        feedback: "오답입니다. 두 개의 단일 인덱스를 결합하여 교집합을 추출하는 Index Merge(또는 Bitmap conversion)는 하나의 결합 인덱스(store_id, status)를 통해 한 번에 탐색하는 것보다 I/O 연산 비용 및 메모리 오버헤드가 훨씬 큽니다."
      }
    ]
  },
  6: {
    level: 6,
    name: "인덱스 컬럼 가공에 의한 무력화 (Index Column Modification)",
    desc: "매출 데이터 테이블(SALES)에서 특정 년도 5월에 해당하는 매출액 총합을 집계하고 있습니다. sale_date 컬럼에 단일 인덱스가 구축되어 있지만, 월 단위 비교를 위해 좌변 컬럼에 TO_CHAR 함수를 사용하자 인덱스를 타지 않고 1억 건에 달하는 테이블 전체를 풀 스캔하는 최악의 병목 현상이 발생하고 있습니다.",
    asisSql: "SELECT SUM(amount) FROM sales WHERE TO_CHAR(sale_date, 'YYYYMM') = '202505';",
    tobeSql: "SELECT SUM(amount) FROM sales WHERE sale_date >= TO_DATE('2025-05-01', 'YYYY-MM-DD') AND sale_date < TO_DATE('2025-06-01', 'YYYY-MM-DD');",
    dialectData: {
      oracle: {
        asisPlan: "TABLE ACCESS FULL (SALES) -- (인덱스 무력화)",
        tobePlan: "INDEX RANGE SCAN (IDX_SALES_DATE) -- (인덱스 활용 범위 검색)"
      }
    },
    asisMetrics: {
      io: "185,000 Blocks",
      time: "24,000 ms",
      plan: "TABLE ACCESS FULL"
    },
    tobeMetrics: {
      io: "45 Blocks",
      time: "8.2 ms",
      plan: "INDEX RANGE SCAN"
    },
    options: [
      {
        id: "opt-6A",
        title: "조건절 좌변 컬럼 가공을 제거하고, 우변의 상수를 가공하여 날짜 범위(Range) 검색으로 쿼리 튜닝",
        desc: "sale_date 컬럼에 씌운 TO_CHAR 함수를 걷어내고, 우변 조건값을 TO_DATE 형식의 범위(>=, <) 조건으로 변경하여 인덱스 스캔을 살려냅니다.",
        isCorrect: true,
        feedback: "완벽한 정답입니다! 인덱스는 데이터가 정렬된 구조입니다. 좌변의 인덱스 컬럼 자체를 함수(`TO_CHAR`, `SUBSTR` 등)로 가공하거나 연산(예: `sale_date + 1`)을 가하면 B-Tree 인덱스 고유의 정렬값이 훼손되므로 옵티마이저가 인덱스를 사용할 수 없어 풀 테이블 스캔을 하게 됩니다. 좌변 컬럼은 있는 그대로 보존하고, 우변의 비교 값을 가공하여 범위 검색(Range Search)을 수행하는 것이 정석 튜닝 방법입니다."
      },
      {
        id: "opt-6B",
        title: "TO_CHAR(sale_date, 'YYYYMM') 조건에 부합하는 함수 기반 인덱스(FBI) 추가 생성",
        desc: "CREATE INDEX idx_sales_fbi ON sales(TO_CHAR(sale_date, 'YYYYMM'))를 생성하여 함수식 자체를 인덱스 키로 등록합니다.",
        isCorrect: false,
        feedback: "오답입니다. 함수 기반 인덱스(Function-Based Index)를 생성하면 인덱스 스캔은 가능하지만, 테이블의 DML(INSERT/UPDATE) 시마다 매번 CPU 연산을 통해 인덱스 블록을 정렬해야 하므로 쓰기 성능이 급격히 악화됩니다. 쿼리를 범위 조건으로 튜닝하여 기존 인덱스를 재사용하는 것이 훨씬 안전하고 효율적인 방법입니다."
      },
      {
        id: "opt-6C",
        title: "sales 테이블의 모든 파티션을 FULL 스캔하되 병렬 쿼리(Parallel Query) 힌트 활용",
        desc: "/*+ PARALLEL(sales 8) */ 힌트를 사용하여 다중 CPU 스레드를 동원해 풀 스캔 속도를 물리적으로 끌어올립니다.",
        isCorrect: false,
        feedback: "오답입니다. 병렬 쿼리는 대용량 배치 작업에는 유용하지만, 빈번히 발생하는 온라인 트랜잭션 환경에서 사용하면 서버 전체의 CPU 자원을 순간적으로 고갈시켜 다른 동시 접속 세션들까지 전부 먹통으로 만드는 위험한 임시방편입니다."
      }
    ]
  },
  7: {
    level: 7,
    name: "클러스터링 팩터 불량과 옵티마이저 오판 (Poor Clustering Factor)",
    desc: "주문 테이블(TB_ORDER)의 주문일자(ORDER_DATE) 컬럼에 구축된 인덱스(IX_ORDER_DATE)를 이용하여 한 달 치 데이터를 조회하는 화면입니다. 옵티마이저는 데이터가 인덱스 순서대로 테이블에 잘 모여있을 것이라 가정(통계정보 오류)하고 인덱스 스캔을 선택했으나, 실제 물리적 정렬 상태(Clustering Factor)가 최악이어서, 테이블 블록을 디스크에서 무작위로 계속 읽어들이는 심각한 Random I/O 병목이 발생하여 시스템이 멈추다시피 했습니다. 올바른 해결 방안은 무엇일까요?",
    asisSql: "SELECT /*+ INDEX(O IX_ORDER_DATE) */ * FROM TB_ORDER O WHERE ORDER_DATE >= TO_DATE('2026-05-19', 'YYYY-MM-DD');",
    tobeSql: "SELECT * FROM TB_ORDER O WHERE ORDER_DATE >= TO_DATE('2026-05-19', 'YYYY-MM-DD'); -- (인덱스 힌트 제거 및 Table Full Scan 유도)",
    dialectData: {
      oracle: {
        asisPlan: "INDEX RANGE SCAN (IX_ORDER_DATE) -> TABLE ACCESS BY INDEX ROWID (TB_ORDER) [Buffers: 120,000]",
        tobePlan: "TABLE ACCESS FULL (TB_ORDER) [Buffers: 450]"
      }
    },
    asisMetrics: {
      io: "120,000 Blocks",
      time: "45,000 ms",
      plan: "INDEX RANGE SCAN + BY ROWID"
    },
    tobeMetrics: {
      io: "450 Blocks",
      time: "200 ms",
      plan: "TABLE ACCESS FULL"
    },
    options: [
      {
        id: "opt-7A",
        title: "강제 인덱스 힌트를 제거하여 옵티마이저가 Table Full Scan을 하도록 유도하거나, ORDER_DATE 기준으로 데이터를 재정렬 후 적재",
        desc: "스캔할 범위가 넓고 클러스터링 팩터가 나쁜 상황에서는, 무작위 Single Block Read를 유발하는 인덱스 스캔보다 Multi-Block Read를 사용하는 Table Full Scan이 훨씬 효율적입니다. 혹은 물리적 테이블 데이터를 날짜순으로 재정렬(Reorganization)하여 클러스터링 팩터를 개선해야 합니다.",
        isCorrect: true,
        feedback: "정답입니다! 클러스터링 팩터(Clustering Factor)란 인덱스 정렬 순서와 테이블 실제 행들의 물리적 디스크 정렬도가 얼마나 일치하는지 나타내는 지표입니다. 이것이 나쁘면 인덱스를 통해 테이블 블록을 읽을 때마다 매번 새로운 디스크 블록을 읽는 Random I/O(Single Block Read) 폭사가 발생합니다. 이럴 때는 오히려 테이블 전체를 듬직하게 Multi-Block Read로 한 번에 쓸어 담는 Full Table Scan이 훨씬 적은 I/O로 빠르게 처리될 수 있습니다."
      },
      {
        id: "opt-7B",
        title: "IX_ORDER_DATE 인덱스를 재생성(REBUILD)하여 인덱스 내부 파편화 제거",
        desc: "ALTER INDEX ix_order_date REBUILD 명령을 실행하여 인덱스 정렬 상태를 강제로 원상복구합니다.",
        isCorrect: false,
        feedback: "오답입니다. 인덱스 리빌드(Rebuild)는 인덱스 세그먼트 내부의 정렬과 빈 공간 정리에만 영향을 줍니다. 테이블 실제 데이터 행들의 물리적인 저장 순서(Clustering Factor의 핵심)는 전혀 바뀌지 않으므로, 리빌드 이후에도 Random I/O 병목은 동일하게 발생합니다."
      },
      {
        id: "opt-7C",
        title: "주문일자(ORDER_DATE) 컬럼을 인덱스 선두로 하는 복합 인덱스(ORDER_DATE, CUSTOMER_ID)로 변경",
        desc: "복합 인덱스를 새롭게 구성하여 데이터의 변별력을 더욱 높이고 탐색 속도를 가속화합니다.",
        isCorrect: false,
        feedback: "오답입니다. 복합 인덱스를 생성해도 여전히 테이블의 물리적인 데이터 정렬(Clustering Factor)은 엉망인 상태이기 때문에, 결국 넓은 범위의 날짜를 읽으면서 테이블로 들어갈 때(Table Access By ROWID) 발생하는 무수한 Random I/O 블록 읽기는 전혀 해소되지 않습니다."
      }
    ]
  }
};
