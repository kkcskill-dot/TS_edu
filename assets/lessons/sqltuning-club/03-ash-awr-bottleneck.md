# 3회차: ASH와 AWR 기반 시계열 병목 역추적

> 💡 **학습 목표**
> "방금 전까지 느렸는데 지금은 괜찮아요" 같은 귀신 곡할 노릇의 장애를 만났을 때, 오라클의 블랙박스인 **ASH(Active Session History)**와 **AWR(Automatic Workload Repository)**을 활용하여 범인을 색출하는 과학 수사 기법을 배웁니다.

---

## 1. 실시간 CPU 스파이크 범인 검거 (ASH)

ASH는 1초마다 DB에서 활동 중인 세션들의 상태(무엇을 기다리는지, 어떤 SQL을 실행 중인지)를 스냅샷으로 찍어 기록하는 실시간 감시 카메라입니다.

> [!NOTE]
> **장애 사례: "갑자기 CPU가 100%를 치고 장애가 났었어요!"**
> - **접근법**: 장애가 발생했던 정확한 시간대(예: 14시 10분 ~ 15분)의 ASH 데이터를 조회하여, 해당 시간대에 `ON CPU` 상태로 머물고 있었던 세션과 SQL_ID를 그룹핑(Group By)합니다.
> - **해결**: 압도적인 비중을 차지하는 악성 SQL(보통 통계정보 오류로 갑자기 풀스캔을 도는 쿼리)을 식별하고 튜닝을 진행합니다.

```sql
-- 과거 특정 시간대의 CPU 스파이크 원인 SQL 찾기
SELECT sql_id, count(*) as active_seconds
  FROM v$active_session_history
 WHERE sample_time BETWEEN TO_DATE('2023-10-25 14:10:00', 'YYYY-MM-DD HH24:MI:SS') 
                       AND TO_DATE('2023-10-25 14:15:00', 'YYYY-MM-DD HH24:MI:SS')
   AND session_state = 'ON CPU'
 GROUP BY sql_id
 ORDER BY active_seconds DESC;
```

---

## 2. AWR 기반 실행계획 변동 이력 추적

잘 돌던 쿼리가 갑자기 느려지는 가장 흔한 원인은 **"실행계획(Plan)의 갑작스러운 변경"**입니다.
AWR은 과거의 악성 SQL들의 수행 통계와 실행계획 변동 이력을 며칠 단위로 보관합니다.

> [!WARNING]
> **Plan Hash Value의 배신**
> AWR 뷰(`DBA_HIST_SQLSTAT`)를 조회하면 동일한 `SQL_ID`가 여러 개의 `PLAN_HASH_VALUE`를 가지는 것을 볼 수 있습니다. 
> "어제까지는 PLAN_A로 잘 돌았는데, 오늘 아침 통계정보 수집 후 갑자기 PLAN_B로 바뀌면서 100배 느려졌다"는 식의 인과관계를 밝혀낼 수 있습니다. 이럴 땐 SQL Profile이나 SPM(SQL Plan Management)을 통해 과거의 좋은 Plan으로 고정시켜야 합니다.

---

## 3. V$ 뷰를 활용한 세션 정밀 추적

현재 DB가 버벅거린다면 `V$SESSION`과 `V$SESSION_WAIT` 뷰를 조인하여 세션별 대기 이벤트(Wait Event)를 추적해야 합니다.

- **db file sequential read**: 인덱스를 통해 테이블을 한 건씩 읽느라 기다리는 중 (보통 정상적이나 수치가 높으면 인덱스 비효율 의심)
- **db file scattered read**: 테이블 전체를 무식하게 풀스캔(Full Scan) 하느라 디스크 I/O를 기다리는 중
- **enq: TX - row lock contention**: 누군가 업데이트 중인 행(Row)을 나도 업데이트하려고 줄 서서 기다리는 중 (애플리케이션 트랜잭션 로직 문제)

> [!TIP]
> 튜너는 SQL만 보는 사람이 아닙니다. 시스템의 어떤 자원(CPU, 디스크, 락)이 경합하고 있는지를 대기 이벤트로 먼저 파악한 뒤, 그 원인이 되는 SQL로 좁혀 들어가는 Top-Down 접근법이 핵심입니다.
