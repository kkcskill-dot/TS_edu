# 세션 5 · DML & 트랜잭션

## 1. INSERT / UPDATE / DELETE
```sql
INSERT INTO employees (emp_id, emp_name, dept_id, salary)
VALUES (1001, '김철수', 10, 4500);

UPDATE employees
SET    salary = salary * 1.1
WHERE  dept_id = 10;              -- ⚠️ WHERE 빠지면 전체 갱신!

DELETE FROM employees
WHERE  emp_id = 1001;
```
> 가장 흔한 사고: `UPDATE`/`DELETE`에서 **WHERE 누락**. 실행 전 같은 조건으로 `SELECT COUNT(*)`로 영향 행수를 먼저 확인하세요.

## 2. MERGE — 있으면 UPDATE, 없으면 INSERT (Upsert)
```sql
MERGE INTO target t
USING source s ON (t.id = s.id)
WHEN MATCHED THEN
  UPDATE SET t.amt = s.amt
WHEN NOT MATCHED THEN
  INSERT (id, amt) VALUES (s.id, s.amt);
```

## 3. 트랜잭션 — 전부 성공 or 전부 취소 (원자성)
```sql
UPDATE accounts SET bal = bal - 100 WHERE id = 'A';
UPDATE accounts SET bal = bal + 100 WHERE id = 'B';
COMMIT;        -- 확정 (여기서부터 다른 세션도 볼 수 있음)
-- 문제가 생기면
ROLLBACK;      -- 마지막 COMMIT 이후 변경 취소
```
- **ACID**: 원자성 / 일관성 / 격리성 / 지속성
- `COMMIT` 전 변경은 **내 세션에만** 보입니다(다른 세션은 이전 값).

## 4. 격리수준 맛보기
- Oracle 기본은 **READ COMMITTED**: 커밋된 데이터만 읽음 + 문장 단위 일관성(Undo로 스냅샷).
- 한 트랜잭션 내 일관성이 필요하면 `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`.
- 갱신 충돌 방지: `SELECT ... FOR UPDATE` 로 행 잠금.

> ✅ 핵심: DML은 트랜잭션으로 묶여 COMMIT 전엔 취소 가능. UPDATE/DELETE는 WHERE를 두 번 확인.
