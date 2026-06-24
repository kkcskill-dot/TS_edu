# 실전 문제: 관리 구문 및 성능 최적화

> [!TIP]
> **출제 포인트**
> TCL 구문(`COMMIT`, `ROLLBACK`)의 특성, DDL 구문 실행 시 Auto Commit 여부, 옵티마이저의 **조인 수행 원리**(NL 조인 vs 해시 조인), 그리고 인덱스 사용 제약 사항들이 주로 출제됩니다.

---

## 1. DDL, DML, TCL의 이해

### 📝 문제 1
**DELETE, TRUNCATE, DROP 명령어에 대한 설명으로 부적절한 것은?**
1. DROP은 테이블의 정의(구조)와 모든 데이터를 파괴하여 삭제한다.
2. TRUNCATE 명령어는 테이블을 스토리지 할당이 없는 초기상태로 만든다.
3. TRUNCATE 명령어는 Undo 로그를 생성하지 않기 때문에 전체 데이터 삭제 시 DELETE보다 빠르다.
4. DROP은 Auto Commit이 되지만, DELETE와 TRUNCATE는 사용자 Commit으로 수행된다.

> [!NOTE]
> **정답 및 해설: 4번**
> `TRUNCATE`와 `DROP`은 모두 데이터 정의어(DDL)이므로 오라클 환경에서 실행 즉시 **Auto Commit** 처리됩니다. `DELETE`만 DML이므로 롤백이 가능합니다.

---

## 2. 권한 제어 (DCL)

### 📝 문제 2
**권한 관리 명령어인 DCL 구문 작성 규칙으로 알맞은 것은?**
`GRANT INSERT (__) TABLE명 (__) USER명;`
1. IN, TO
2. ON, FROM
3. ON, TO
4. IN, FROM

> [!NOTE]
> **정답 및 해설: 3번**
> 객체 권한을 부여하는 `GRANT` 명령어의 문법은 `GRANT 권한종류 ON 오브젝트명 TO 사용자명;` 입니다. (회수할 때는 `REVOKE 권한 ON 오브젝트 FROM 사용자;`)

---

## 3. 조인 수행 원리 (옵티마이저)

### 📝 문제 3
**SQL 최적화를 수행하는 옵티마이저의 조인 수행 원리 중, 동등(=) 조인에서만 사용 가능하며 테이블에 인덱스가 없어도 대량의 데이터를 가장 빠르게 처리하는 조인 기법은?**
1. Nested Loop Join (NL Join)
2. Sort Merge Join
3. Hash Join
4. Cartesian Join

> [!NOTE]
> **정답 및 해설: 3번**
> **해시 조인(Hash Join)**은 선행 테이블을 해시 메모리에 적재하여 후행 테이블과 조인하는 방식으로, 대용량 Equal(=) 조인에 압도적인 성능을 자랑합니다.

---

## 4. 인덱스 (Index) 활용

### 📝 문제 4
**다음 중 옵티마이저가 인덱스를 사용할 수 없는(Full Table Scan 유발) 조건절이 아닌 것은?**
1. WHERE 컬럼명 LIKE '%SQLD'
2. WHERE TO_CHAR(숫자컬럼) = '100'
3. WHERE 컬럼명 IS NOT NULL
4. WHERE 컬럼명 BETWEEN 100 AND 200

> [!NOTE]
> **정답 및 해설: 4번**
> `BETWEEN` 연산자는 연속된 범위 검색이므로 인덱스 레인지 스캔(Range Scan)을 정상적으로 사용할 수 있습니다. 반면 전방 와일드카드(`%`), 좌변 컬럼 가공(`TO_CHAR`), `IS NOT NULL` 등은 인덱스 사용을 심각하게 제한하거나 불가능하게 만듭니다.
