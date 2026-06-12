# 6장. DML 튜닝

INSERT/UPDATE/DELETE/MERGE의 성능은 **인덱스·로그(redo/undo)·Call 수·Lock**이 좌우한다.

## 6.1 기본 DML 튜닝

### DML 성능에 영향을 미치는 요소
- **인덱스**: 테이블 1건 변경 시 딸린 **모든 인덱스도 갱신** → 인덱스가 많을수록 DML 느림.
- **redo/undo 로깅**, 제약(FK·체크), 트리거.

### 데이터베이스 Call과 Array Processing
한 건씩 처리하면 **DB Call(네트워크 왕복)** 이 폭증. **배열 처리**로 한 번에 여러 건.
```sql
-- JDBC: addBatch()/executeBatch(), PL/SQL: FORALL
FORALL i IN 1..arr.COUNT
  INSERT INTO t VALUES arr(i);
```

### 대량 DML 튜닝
- **인덱스/제약 일시 해제(UNUSABLE) → 적재 → 재생성**: 대량 적재 시 인덱스 갱신 부하 회피.
- **수정 가능 조인 뷰**: 조인 결과를 직접 UPDATE.
- **MERGE**: 있으면 UPDATE/없으면 INSERT를 한 문장으로(여러 번 스캔 회피).
```sql
MERGE INTO tgt t USING src s ON (t.id=s.id)
WHEN MATCHED THEN UPDATE SET t.v=s.v
WHEN NOT MATCHED THEN INSERT (id,v) VALUES (s.id,s.v);
```

## 6.2 Direct Path I/O
버퍼 캐시를 거치지 않고 **데이터파일에 직접** 쓰기 → 대량 적재 고속.
```sql
INSERT /*+ APPEND */ INTO t SELECT ... ;   -- Direct Path Insert(HWM 위에 적재, redo 최소)
```
- **병렬 DML**: `ALTER SESSION ENABLE PARALLEL DML;` + `/*+ PARALLEL */`.
> 주의: Direct Path Insert는 적재 중 테이블 Lock·완료 전 조회 제약 등 동작 차이가 있음.

## 6.3 파티션을 활용한 DML 튜닝
- **파티션 단위 작업**으로 대량 UPDATE/DELETE/INSERT를 효율화.
- 대량 DELETE → 해당 파티션 **DROP/TRUNCATE**, 대량 INSERT → **파티션 교환(EXCHANGE)**.
> (연계: 고성능 DB 설계 — 파티션 라이프사이클 🔗)

## 6.4 Lock과 트랜잭션 동시성 제어
- **오라클 Lock**: 행 단위 Lock(다른 행은 막지 않음), **읽는 세션은 쓰기를 막지 않음**(Undo 기반 일관성).
- **TX 동시성**: 갱신 충돌은 `SELECT ... FOR UPDATE`로 선점, 적절한 커밋 주기.
- **채번 방식**: 시퀀스 vs MAX+1 — MAX+1은 동시 INSERT에서 경합·중복 위험, **시퀀스 권장**.

> ✅ **6장 핵심**: DML은 **인덱스 수 = 부하**. 대량은 배열 처리·Direct Path·인덱스 해제·파티션으로. 동시성은 Lock·커밋 주기·채번 설계로. (실습: 락 & 동시성 샌드박스 ♻️ · 바인드/배열 ♻️)
