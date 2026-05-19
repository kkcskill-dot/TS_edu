# 제1장. 오라클 데이터베이스 아키텍처 및 V$SESSION 기초

오라클 데이터베이스는 단순히 데이터를 저장하는 공간을 넘어, 수많은 컴포넌트가 정교하게 협업하는 복잡한 시스템입니다. 성능 진단 엔지니어로서 우리는 이 거대한 오케스트라의 각 파트가 어떤 역할을 하며 어떻게 소통하는지 이해해야 합니다.

---

## 1. 데이터베이스 메모리 및 스토리지 구조

### 가. SGA (System Global Area)
* **정의**: 데이터베이스 인스턴스의 심장부와 같은 공유 메모리 영역입니다.
* **구성 및 역할**:
  * 데이터 블록을 캐싱하는 **Buffer Cache**
  * 데이터 변경 내용을 임시 저장하는 **Redo Log Buffer**
  * 락(Lock) 정보를 관리하는 영역 등을 포함하며, 데이터베이스에 접속한 모든 세션이 공유합니다.

### 나. 백그라운드 프로세스
* **정의**: 오라클이 원활하게 작동하도록 SGA와 Disk 사이에서 묵묵히 일하는 프로세스들입니다.
* **주요 프로세스**:
  * **DBWn**: 더티 버퍼 캐시 블록을 디스크의 데이터 파일에 쓰는 프로세스
  * **LGWR**: 리두 로그 버퍼의 내용을 리두 로그 파일에 쓰는 프로세스
  * **CKPT**: 체크포인트를 관리하고 데이터 파일 헤더를 동기화하는 프로세스
  * **ARC0**: 다 찬 리두 로그 파일을 아카이브 로그로 백업하는 프로세스

### 다. Disk (Storage)
* **정의**: 데이터가 영구적으로 저장되는 물리 공간입니다.
* **주요 구성 파일**:
  * 실제 데이터가 담긴 **Data Files**
  * 변경 내역이 물리적으로 기록되는 **Redo Log Files**
  * 트랜잭션 롤백과 일관성을 위한 **Undo Files**
  * 데이터베이스의 상태 및 구조 정보를 담은 **Control Files**

---

## 2. Redo와 Undo 트러블슈팅

데이터 무결성과 트랜잭션 보장을 위한 오라클의 핵심 메커니즘입니다.

### 가. Redo와 Undo의 역할 비교
* **Redo ("다시 하기")**: 장애 발생 시 데이터 복구를 위해 모든 변경 내역을 안전하게 선기록(Write-Ahead Logging)합니다.
* **Undo ("실행 취소")**: 변경 전 데이터를 임시 보존하여 `ROLLBACK`을 수행하고, 다중 사용자 환경에서 **읽기 일관성(Consistent Read)**을 보장합니다.

### 나. Redo 100% 도달 시 문제점: 데이터베이스 멈춤 (DB Hang)
* **원인**: Redo Log는 여러 그룹을 순환하며 덮어쓰는(Circular) 구조를 가집니다. 만약 백업(Archiving) 지연이나 트랜잭션 폭증으로 덮어쓸 수 있는 여분의 공간이 없게 되면 **Log Switch Hang**이 유발됩니다.
* **장애 현상**: 트랜잭션을 처리하는 시스템 전체의 DML 작업이 멈춥니다(Hang). 사용자는 응용 프로그램에서 무한 대기 상태(Lock Waiting)를 겪게 됩니다.

### 다. Undo 100% 도달 시 문제점: DML 실패 및 조회 에러
* **장애 현상 1 (DML 불가)**: 새로운 `INSERT`, `UPDATE`, `DELETE` 작업이 변경 전 값을 기록할 Undo 공간을 할당받지 못해 실패합니다.
  > `ORA-30036: unable to extend segment by 8 in undo tablespace` 에러 발생
* **장애 현상 2 (조회 실패)**: 장시간 수행되는 `SELECT` 쿼리가 참조해야 할 과거 시점의 데이터(Undo Block)가 공간 부족으로 다른 트랜잭션에 의해 덮어씌워져 유실되면 쿼리가 강제 실패합니다.
  > `ORA-01555: snapshot too old` 에러 발생

---

## 3. V$SESSION 파헤치기

`V$SESSION`은 오라클 데이터베이스의 세션 메타데이터와 현재 활동 정보를 담고 있는 핵심 동적 성능 뷰입니다.

### 가. 핵심 조회 쿼리
```sql
SELECT SID, SERIAL#
     , USERNAME, STATUS, SCHEMANAME, TYPE
     , OSUSER, PROCESS, MODULE, MACHINE, PROGRAM, LOGON_TIME
     , SQL_ID, SQL_HASH_VALUE, SQL_EXEC_START
     , PREV_SQL_ID
FROM V$SESSION
WHERE STATUS = 'ACTIVE' AND SQL_ID IS NOT NULL
```

### 나. 세션 상세 속성 해독

#### 1) 세션 식별 정보
* **`SID`**: Session Identifier. 세션의 고유 식별자
* **`SERIAL#`**: Session Serial Number. 동일 SID가 재사용될 때 구분하기 위한 일련번호
* **`USERNAME`**: 접속한 데이터베이스 사용자명 (백그라운드 프로세스는 `NULL`로 표시)
* **`SCHEMANAME`**: 현재 세션의 기본 스키마명

#### 2) 세션 상태 정보
* **`STATUS`**: 세션 상태
  * `ACTIVE`: SQL 실행 중
  * `INACTIVE`: 대기 중
  * `KILLED`: 강제 종료됨
  * `SNIPED`: 리소스 매니저에 의해 종료 예정
* **`TYPE`**: 세션 타입
  * `USER`: 일반 사용자 세션
  * `BACKGROUND`: 백그라운드 프로세스

#### 3) OS 및 클라이언트 정보
* **`OSUSER`**: OS(운영체제) 사용자명
* **`PROCESS`**: 클라이언트 측 프로세스 ID
* **`MACHINE`**: 클라이언트가 실행 중인 머신(컴퓨터)명
* **`PROGRAM`**: 세션을 시작한 프로그램명 (예: sqlplus.exe, JDBC Thin Client)
* **`MODULE`**: 애플리케이션 모듈명 (`DBMS_APPLICATION_INFO` 패키지로 설정 가능)

#### 4) 로그온 시간 및 SQL 정보
* **`LOGON_TIME`**: 세션이 데이터베이스에 접속한 시각 (DATE 타입)
* **`SQL_ID`**: 현재 실행 중인 SQL의 고유 식별자 (13자리 해시 문자열)
* **`SQL_HASH_VALUE`**: SQL의 해시 값 (구버전 호환용, SQL_ID 사용 권장)
* **`SQL_EXEC_START`**: 현재 SQL 실행 시작 시각 (DATE 타입)
* **`PREV_SQL_ID`**: 직전에 실행했던 SQL의 SQL_ID (현재 `ACTIVE` 상태이거나 마지막 실행 SQL)

---

## 4. 시스템 부하의 거시적 파악 (AAS와 CPU Core)

성능 진단의 첫 단계는 시스템이 허용 가능한 동시 처리 임계치를 초과했는지 판단하는 것입니다. 운영체제(OS)의 CPU 자원과 DBMS의 활성 세션 간의 상관관계를 이해해야 합니다.

### 가. AAS (Average Active Sessions) 모델링
* **개념**: AAS는 특정 구간 동안 데이터베이스에서 대기 중이거나 CPU를 점유하며 연산을 수행 중인 세션(프로세스/스레드)의 평균 개수입니다.
* **수학적 정의**:
  $$\\text{{AAS}} = \\frac{{\\text{{DB Time}}}}{{\\text{{Elapsed Time}}}}$$
* **실전 대입**: 만약 60초(Elapsed Time) 동안 수집된 DB Time의 총합이 240초라고 가정해 보겠습니다.
  $$\\frac{{240}}{{60}} = 4$$
  이 결과값 4가 의미하는 바는, 해당 60초의 시간 동안 **"평균적으로 4개의 세션(스레드)이 단 1초도 쉬지 않고 동시에 데이터베이스에 부하를 주고 있었다"**는 뜻입니다.

### 나. CPU Core와 AAS의 상관관계 (Queueing 관점)
DBMS가 탑재된 서버의 CPU Core 수가 $N$ (예: 16) 일 때, 물리적으로 동시에 처리 가능한 스레드의 수는 $N$개입니다.
* **$\\text{{AAS}} < N$ (정상 상태)**: Run Queue에 대기 중인 프로세스가 없으며, 즉각적인 CPU 할당이 가능합니다.
* **$\\text{{AAS}} \\gg N$ (지연 상태)**: OS의 스케줄러(Scheduler)는 한정된 CPU를 수많은 Active Session에 할당하기 위해 빈번한 컨텍스트 스위칭(Context Switching)을 발생시킵니다. 이로 인해 실제 연산 처리보다 스레드 교체에 따른 오버헤드가 급증하며 시스템 전체의 응답 시간이 저하됩니다.

---

## 5. V$SESSION 활용: 메모리 상태의 거시적 매핑

오라클의 V$ 뷰는 디스크에 저장된 실물 테이블이 아니라, DBMS가 구동 중인 메모리(SGA) 영역의 C 언어 구조체 배열을 SQL 인터페이스로 매핑한 동적 성능 뷰입니다. 장애 발생 시 `V$SESSION`을 집계하여 현재 부하의 성격을 빠르게 파악해야 합니다.

### [스크립트 1] 이벤트별 Active 세션 집계
이 쿼리는 현재 상태(STATE)와 대기 이벤트(EVENT)를 기준으로 세션을 그룹화하여, 시스템 부하의 근본 원인(Root Cause)을 도출합니다.

```sql
SELECT EVENT
       , STATE
       , COUNT(*) AS SESSION_CNT
  FROM V$SESSION
 WHERE STATUS = 'ACTIVE'
   AND TYPE = 'USER'
 GROUP BY EVENT
          , STATE
 GROUP BY SESSION_CNT DESC;
```

---

## 6. 핵심 대기 이벤트(Wait Event) 및 Lock 정밀 분석

앞선 집계 쿼리를 통해 도출된 병목 현상을 6가지 핵심 대기 이벤트로 분류하여, 컴퓨터 구조 및 알고리즘 관점에서 분석합니다.

### 가. db file sequential read (단일 블록 I/O 병목)
* **문제 정의**: 디스크에서 하나의 데이터 블록을 메모리(Buffer Cache)로 적재할 때 발생하는 동기화된(Synchronous) 읽기 대기입니다.
* **주요 원인**: 주로 B-Tree 인덱스 탐색(Index Range Scan) 시 발생합니다. 인덱스를 경유하지만, 조건절의 선택도(Selectivity)가 낮아 지나치게 많은 리프 노드(Leaf Node)와 테이블 블록에 무작위 접근(Random I/O)을 시도할 때 발생합니다.
* **해결책**: 추출할 데이터가 전체의 10~15%를 초과할 경우, 무작위 접근보다 순차 접근(Sequential Access)을 하는 Full Table Scan이 I/O 비용 측면에서 유리합니다. 조건절의 변별력을 높이거나 인덱스 구조를 재설계해야 합니다.
* **탐지 SQL**:
```sql
SELECT S.SID
       , S.USERNAME
       , S.EVENT
       , Q.SQL_TEXT
       , Q.DISK_READS
       , Q.BUFFER_GETS
  FROM V$SESSION S
       JOIN V$SQL Q
         ON S.SQL_ID = Q.SQL_ID
            AND S.SQL_CHILD_NUMBER = Q.CHILD_NUMBER
 WHERE S.EVENT = 'db file sequential read'
   AND S.STATUS = 'ACTIVE';
```

### 나. db file scattered read (다중 블록 I/O 병목)
* **문제 정의**: 디스크에서 연속된 여러 개의 블록(Multi-block)을 한 번에 메모리로 적재할 때 발생합니다. 물리적으로 연속된 데이터를 읽으므로 블록들이 버퍼 캐시에 흩어져서(Scattered) 올라옵니다.
* **주요 원인**: 인덱스가 부재하거나 옵티마이저가 인덱스 스캔의 비용(Cost)이 높다고 판단하여 Full Table Scan을 수행할 때 발생합니다.
* **해결책**: 대용량 테이블에 대한 조건 없는 Full Scan은 디스크 I/O 대역폭을 고갈시킵니다. 악성 세션을 식별하여 조치하고, 필수 검색 조건(예 : 파티션 키)을 강제해야 합니다.
* **탐지 SQL**:
```sql
SELECT SID
       , TARGET
       , OPNAME
       , ROUND(( SOFAR / TOTALWORK ) * 100, 2) AS "PROGRESS(%)"
       , TIME_REMAINING                        AS "REMAIN_SEC"
  FROM V$SESSION_LONGOPS
 WHERE TIME_REMAINING > 0
   AND OPNAME LIKE '%Table Scan%';
```

### 다. direct path read / temp (PGA 직접 I/O 및 Out-of-Core 연산)
* **문제 정의**: 데이터를 SGA의 공용 버퍼 캐시를 거치지 않고 프로세스 할당 메모리인 PGA로 직접 적재할 때 발생합니다.
* **주요 원인**: 대규모 정렬(Sort) 연산이나 해시 조인(Hash Join) 수행 시, PGA 메모리 용량을 초과하여 디스크의 임시 공간(Temp Tablespace)을 스왑(Swap) 영역처럼 사용할 때 발생합니다. (Out-of-Core Algorithm 수행 시 오버헤드)
* **해결책**: 배치 작업의 데이터 단위를 분할하거나, 시스템 차원에서 PGA_AGGREGATE_TARGET 파라미터의 메모리 할당량을 검토해야 합니다.
* **탐지 SQL**:
```sql
SELECT S.SID
       , S.USERNAME
       , S.PROGRAM
       , U.TABLESPACE
       , ROUND(( U.BLOCKS * 8192 ) / 1024 / 1024, 2) AS "TEMP_USAGE_MB"
       , Q.SQL_TEXT
  FROM V$SORT_USAGE U
       JOIN V$SESSION S
         ON U.SESSION_ADDR = S.SADDR
       JOIN V$SQL Q
         ON S.SQL_ID = Q.SQL_ID;
```

### 라. log file sync (WAL 메커니즘 동기화 지연)
* **문제 정의**: 트랜잭션 종료(COMMIT) 시점마다, 변경된 데이터를 보장하기 위해 Redo Log 버퍼의 내용을 디스크에 기록하는 작업(Write-Ahead Logging)이 완료될 때까지 대기하는 현상입니다.
* **주요 원인**: 스토리지의 쓰기 성능(IOPS) 저하, 또는 애플리케이션의 반복문 내에서 트랜잭션 단위를 묶지 않고 건별로 COMMIT을 수행하는 논리적 오류가 주원인입니다.
* **해결책**: 애플리케이션 레벨에서 JDBC Batch Processing 등을 활용하여 단일 트랜잭션으로 묶어 I/O 시스템 콜 횟수를 최소화해야 합니다.
* **탐지 SQL**:
```sql
SELECT S.SID
       , S.PROGRAM
       , S.MACHINE
       , ST.VALUE AS "COMMIT_COUNT"
  FROM V$SESSION S
       JOIN V$SESSTAT ST
         ON S.SID = ST.SID
       JOIN V$STATNAME SN
         ON ST.STATISTIC# = SN.STATISTIC#
 WHERE SN.NAME = 'user commits'
   AND S.TYPE = 'USER'
 ORDER BY ST.VALUE DESC
FETCH FIRST 5 ROWS ONLY;
```

### 마. library cache lock / pin (구조 변경에 따른 상호 배제)
* **문제 정의**: SGA 내의 공유 풀(Shared Pool)에 적재된 파싱(Parsing)된 SQL이나 프로시저 객체 구조를 보호하기 위한 상호 배제(Mutual Exclusion) 락입니다.
* **주요 원인**: 서비스 운영 시간에 특정 테이블에 DDL(ALTER)을 수행하거나 프로시저를 재컴파일할 경우, 해당 객체의 AST(Abstract Syntax Tree)를 참조하는 모든 세션의 진입이 차단됩니다.
* **해결책**: DDL 락을 유발한 세션을 식별하여 강제 종료하고, 데이터베이스 스키마 변경 작업은 반드시 트래픽이 없는 점검 시간에 수행하도록 파이프라인 정책을 수정해야 합니다.

### 바. enq : TX - row lock contention (트랜잭션 동시성 제어)
* **문제 정의**: 다중 버전 동시성 제어(MVCC) 환경에서, 동일한 레코드(Row)에 대해 다수의 세션이 동시에 쓰기 연산(UPDATE/DELETE)을 시도할 때 발생하는 데이터 무결성 보호 락입니다.
* **주요 원인**: 특정 레코드에 갱신 트랜잭션이 집중되거나, 애플리케이션의 예외 처리 누락으로 인해 커넥션이 종료되지 않고 락을 점유한 상태(Connection Leak)로 방치될 때 발생합니다.
* **해결책**: 락 트리 순회 쿼리를 사용해 계층 구조의 최상단에 있는 트랜잭션(Root Blocker)을 식별해야 합니다.

### [스크립트 2] Wait-For Graph (락 트리) 순회 쿼리
관계형 데이터베이스의 계층형 쿼리(`START WITH ~ CONNECT BY`)를 활용하여 트리 자료구조 형태의 락 대기 상태를 추적합니다. LEVEL 1이 임계 구역(Critical Section)을 점유한 상태입니다.

```sql
SELECT LEVEL
       , LPAD(' ', ( LEVEL - 1 ) * 2, ' ')
         || SID                   AS "LOCK_TREE"
       , SERIAL#
       , STATUS
       , USERNAME
       , MACHINE
       , EVENT
       , SECONDS_IN_WAIT
       , NVL(SQL_ID, PREV_SQL_ID) AS TARGET_SQL_ID
  FROM V$SESSION
 WHERE TYPE = 'USER'
START WITH BLOCKING_SESSION IS NULL
           AND SID IN (SELECT BLOCKING_SESSION
                         FROM V$SESSION
                        WHERE BLOCKING_SESSION IS NOT NULL)
CONNECT BY PRIOR SID = BLOCKING_SESSION;
```

---

## 7. 장애 조치 시 3대 제약 조건 (Constraints)

이론적 원인을 파악했다 하더라도, 실제 운영 환경에서는 시스템의 안정성을 위협하는 성급한 조치를 지양해야 합니다.

### 가. 상태를 고려하지 않은 프로세스 Kill 금지 (Rollback Overhead)
DML(UPDATE 등) 락을 유발한 세션을 강제로 종료(Kill)하면, DBMS는 ACID 속성을 유지하기 위해 언두(Undo) 세그먼트를 읽어 변경된 데이터를 모두 롤백해야 합니다. 갱신된 데이터가 대량일 경우 롤백에 소요되는 시간 복잡도는 작업 시간 이상으로 비례하며, 해당 기간 동안 테이블의 해당 레코드는 계속 락 상태로 유지됩니다.

### 나. 부하 상태에서의 데이터 딕셔너리 조인 금지
CPU 사용률이 한계치에 도달한 상황에서 `DBA_OBJECTS`와 같은 시스템 카탈로그 뷰를 복잡하게 조인하여 쿼리하는 것은 시스템 붕괴를 초래할 수 있습니다. 카탈로그 뷰는 연산 비용이 높으므로 장애 상황에서는 메모리를 직접 매핑한 가벼운 V$ 동적 성능 뷰만을 제한적으로 사용해야 합니다.

### 다. Connection Storm 방지 (커넥션 풀 고갈 제어)
특정 쿼리의 병목으로 인해 애플리케이션의 응답이 지연될 때, 클라이언트의 반복적인 재요청은 WAS의 커넥션 풀(Connection Pool)을 급격히 고갈시킵니다. 이는 동일한 악성 쿼리를 기하급수적으로 복제하여 DBMS 프로세스를 마비시키는 **Connection Storm** 현상으로 이어지므로, 애플리케이션 단에서 재시도 횟수를 제한하는 **서킷 브레이커(Circuit Breaker)** 도입을 권장해야 합니다.

---

## 8. 인스턴스 유형별 대기 이벤트 심화

### 가. Single Instance 환경
* **`db file sequential read`**: 디스크로부터 하나의 데이터 블록을 메모리로 읽어 들일 때 발생합니다. (주로 인덱스 좁은 범위 탐색)
* **`db file scattered read`**: 디스크로부터 여러 블록을 한 번에 읽어 메모리에 적재할 때 발생합니다. (FTS, Index Fast Full Scan)
* **`log file sync`**: 세션이 `COMMIT` 또는 `ROLLBACK`을 수행할 때, LGWR 프로세스가 Redo Buffer의 내용을 디스크의 Redo Log File에 기록할 때까지 대기합니다. (배치 처리로 묶어서 단일 커밋할 것)
* **`buffer busy waits` / `read by other session`**: 동일한 데이터 블록을 여러 세션이 동시에 접근할 때 발생하는 경합 또는 타 세션이 올린 블록에 대한 대기 현상입니다. (Hot Block 분산 필요)

### 나. RAC (Real Application Clusters) 환경
RAC 환경은 노드 간 인터커넥트를 통한 블록 전송(Cache Fusion) 과정이 추가되므로 `gc` (Global Cache) 관련 이벤트가 발생합니다.
* **`gc cr block 2-way / 3-way`**: 읽기 작업(`SELECT`) 시 타 노드의 버퍼 캐시에 있는 읽기 일관성(CR) 버전 블록을 인터커넥트로 가져올 때 발생합니다. (Application Partitioning 필요)
* **`gc current block 2-way / 3-way`**: DML을 수행하기 위해 최신(Current) 블록을 타 노드에서 가져오며 변경 권한을 획득할 때 발생합니다. (시퀀스 캐시 크기 조정, 해시 파티셔닝 적용)
* **`gc buffer busy acquire / gc buffer busy release`**: RAC 버전의 `buffer busy waits`로, 노드 간 전송 중인 블록을 동시 요청할 때 발생합니다. (I/O 튜닝을 통해 블록 요청량 감소)

### 다. Exadata 환경
Exadata는 스토리지 셀(Storage Cell) 연산을 오프로딩(Offloading)하는 기능이 핵심이며, 스토리지 관련 대기 이벤트는 `cell`로 시작합니다.
* **`cell smart table scan`**: Exadata의 **Smart Scan** 기능이 작동하여 스토리지 레벨에서 데이터를 필터링한 후, 필요한 결과셋만 DB 서버로 전송할 때 발생합니다. (최상위에 있으면 성공적으로 연동 중이나, 응답이 길다면 Cell 부하 확인)
* **`cell multiblock physical read`**: Smart Scan이 작동하지 못하고 일반 DBMS처럼 다중 블록을 캐시로 읽어 들일 때 발생합니다. (병렬 쿼리 활성화 유무 확인 필요)
* **`cell single block physical read`**: Cell 스토리지에서 인덱스를 경유해 단일 블록을 읽을 때 발생합니다. (인덱스 효율 체크)
* **`cell smart index scan`**: Index Fast Full Scan 등 대용량 인덱스 스캔 시에도 Smart Scan 기능이 적용되어 필터링이 일어날 때 기록되는 대기 이벤트입니다.