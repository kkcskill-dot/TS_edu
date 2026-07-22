# 2회차: 대용량 해시 조인과 메모리 튜닝

> 💡 **학습 목표**
> 실무에서 가장 많이 마주하는 조인 방식인 **해시 조인(Hash Join)**의 내부 메커니즘을 뜯어보고, 메모리(PGA) 크기가 성능에 미치는 엄청난 영향력을 확인합니다.

---

## 1. 해시 조인의 3가지 모드와 비용 차이

해시 조인은 작은 쪽 테이블(Build Input)을 메모리(PGA)에 올려 해시 맵을 만든 뒤, 큰 쪽 테이블(Probe Input)을 스캔하며 해시 맵을 탐색하는 방식입니다. 이때 **PGA 메모리 여유 공간**에 따라 3단계 운명이 결정됩니다.

### ① In-Memory 해시 조인 (Best)
- Build Input이 PGA 메모리에 한 번에 쏙 들어가는 경우.
- 디스크 I/O가 전혀 발생하지 않아 해시 조인이 낼 수 있는 최고의 성능을 냅니다.

### ② 1-Pass 해시 조인 (Warning)
- Build Input이 메모리보다 커서, 맵을 만들다가 메모리가 꽉 차면 남은 데이터를 디스크(Temp 영역)에 잠시 기록합니다.
- 조인 대상 데이터를 디스크에 딱 **한 번** 썼다가 읽어옵니다. 속도 저하가 체감되지만 야간 배치라면 버틸 만합니다.

### ③ Multipass 해시 조인 (Critical Danger)
- Build Input이 메모리보다 지나치게 커서, Temp 영역을 썼다 지웠다를 **수없이 반복**하는 끔찍한 상황입니다.

> [!CAUTION]
> **장애 사례: "평소 10분 걸리던 야간 배치가 아침 9시가 되도록 안 끝나요!"**
> - **원인**: 통계정보 오차로 인해 옵티마이저가 100만 건짜리 작은 테이블 대신 1억 건짜리 초대형 테이블을 Build Input(해시 맵 생성 대상)으로 덜컥 잡아버렸습니다. 
> - **현상**: 1억 건을 메모리에 구겨 넣으려다 실패하고 끝없는 Multipass 늪에 빠져 디스크 I/O 병목으로 서버가 멈춰버렸습니다.
> - **해결**: `/*+ LEADING(작은테이블 큰테이블) USE_HASH(큰테이블) */` 힌트를 투입해 Build Input을 작은 테이블로 강제 고정합니다.

---

## 2. PGA_AGGREGATE_TARGET 파라미터 제어 전략

`PGA_AGGREGATE_TARGET`은 데이터베이스가 세션들에게 할당할 총 PGA 메모리의 목푯값입니다. 

> [!TIP]
> **세션 단위 PGA 한도 해제 기법**
> 수억 건의 데이터를 집계하는 강력한 월마감 쿼리 하나를 돌릴 때, 1-Pass나 Multipass로 떨어지는 것을 막고 억지로 In-Memory로 끌어올리고 싶다면 아래 스크립트로 현재 세션의 메모리 한도를 일시적으로 풀어줄 수 있습니다.
> ```sql
> ALTER SESSION SET WORKAREA_SIZE_POLICY = MANUAL;
> ALTER SESSION SET HASH_AREA_SIZE = 1073741824; -- 1GB 할당
> ```
> *(주의: 동시 접속자가 많은 주간 OLTP 환경에서 사용하면 DB 메모리 고갈로 서버가 즉시 다운될 수 있습니다!)*

---

## 3. 🧪 실습 Lab — 해시 조인 메모리 추적기

### Step 1. V$SQL_WORKAREA로 쿼리의 Temp 사용량 훔쳐보기
현재 돌고 있는, 혹은 방금 끝난 해시 조인 쿼리가 In-Memory로 돌았는지, Temp로 쫓겨났는지 확인하는 진단 쿼리입니다.

```sql
SELECT sql_id, 
       operation_type, 
       estimated_optimal_size / 1024 / 1024 AS est_opt_mb, -- In-Memory에 필요한 최소 MB
       last_memory_used / 1024 / 1024 AS last_mem_mb,     -- 실제 사용한 메모리 MB
       last_execution,                                    -- 'OPTIMAL', 'ONE PASS', 'MULTI-PASS'
       max_tempseg_size / 1024 / 1024 AS max_temp_mb      -- 디스크를 얼마나 썼는지
  FROM v$sql_workarea
 WHERE sql_id = '여기에_조회할_SQL_ID입력'
 ORDER BY estimated_optimal_size DESC;
```

### Step 2. 조인 순서 뒤집기 (Before / After)

```sql
-- (Before) 통계정보 오류로 T_LARGE(1억건)가 Build Input이 된 비극의 쿼리
SELECT /*+ LEADING(l s) USE_HASH(s) */ 
       s.code_nm, SUM(l.amount)
  FROM t_large l, t_small s
 WHERE l.code = s.code
 GROUP BY s.code_nm;
-- V$SQL_WORKAREA 조회 결과: last_execution = 'MULTI-PASS', max_temp_mb = 15000 (15GB)

-- (After) 작은 테이블을 먼저 읽어 해시 맵을 만들도록 통제
SELECT /*+ LEADING(s l) USE_HASH(l) */ 
       s.code_nm, SUM(l.amount)
  FROM t_small s, t_large l
 WHERE l.code = s.code
 GROUP BY s.code_nm;
-- V$SQL_WORKAREA 조회 결과: last_execution = 'OPTIMAL', max_temp_mb = 0 (메모리만 사용!)
```

---

## 4. 한 장 정리

- 해시 조인의 성능은 **"어느 테이블로 해시 맵을 만들 것인가(Build Input)"**가 99%를 결정한다.
- 옵티마이저가 헛발질하여 대형 테이블을 Build Input으로 잡으면 **Multipass Hash Join**이라는 대참사가 벌어진다.
- 배치 프로그램에서 해시 조인을 쓸 때는 통계정보 변화에 휘둘리지 않도록 가급적 `LEADING(작은것 큰것)` 힌트를 박아두는 것이 방어적 프로그래밍의 기본이다.
- 내 쿼리가 왜 느린지 궁금하다면 디스크 I/O를 의심하고, `V$SQL_WORKAREA`에서 Temp 사용 이력을 반드시 조회하라.
