# 데이터 접근 방식(Join Method) 분석 가이드

## 1. Data 접근 방식 개요

흔히 JOIN이라 하면 Inner Join 혹은 Outer Join과 같은 논리적 결합을 떠올리기 쉽다. 본 문서에서 다루는 JOIN은 논리적 결과 집합이 아닌, 데이터베이스가 물리적으로 테이블 간에 어떠한 방식으로 접근하여 데이터를 엮어내는가(Join Method)에 대한 내용을 다룬다.

## 2. JOIN 방식의 종류

오라클 데이터베이스에서 데이터 결합 시 주로 활용되는 데이터 접근 방식은 크게 세 가지로 분류된다.

1. **Nested Loop Join**: 순차적 루프에 의한 접근 방식
2. **Sort Merge Join**: 정렬을 통한 접근 방식
3. **Hash Join**: 해시 함수를 이용한 접근 방식

---

## 3. Nested Loop Join (NL Join)

Nested Loop Join(NL Join)은 실무 환경에서 가장 흔하게 접할 수 있는 기본적인 JOIN 방식이다.

* **특징**:
  * 소량의 데이터를 처리하거나 부분범위 처리에 적합하다.
  * 무작위 접근(Random Access) 위주의 JOIN 방식이다. 따라서 인덱스 구성이 아무리 완벽하더라도 대량의 데이터를 JOIN할 때에는 매우 비효율적으로 동작한다.
  * 데이터를 한 레코드씩 순차적으로 반복 결합(Loop)한다는 점이 핵심이다.
  * 인덱스 구성 전략이 성능에 절대적인 영향을 미친다. JOIN 컬럼에 대한 인덱스 존재 유무와 그 형태에 따라 JOIN 효율이 극명하게 달라진다.

NL JOIN의 동작 메커니즘은 프로그래밍 언어의 `FOR` 문으로 이해하면 수월하다.

### PL/SQL 비유 예제
```sql
SELECT /* 예시 쿼리 */
  FROM TABLE_A A
     , TABLE_B B
 WHERE A.ID = '1234'
   AND A.NAME = B.NAME
   AND B.BIRT_DT = '19900101';
```

```sql
-- 내부 동작 논리
FOR TABLE_A.ID = '1234'
LOOP
    FOR TABLE_A.NAME = TABLE_B.NAME
    LOOP
        IF TABLE_B.BIRT_DT = '19900101' THEN
            -- 결과 반환
        END IF;
    END LOOP;
END LOOP;
```

* **동작 순서**:
  1. 테이블A(선행 테이블)에서 ID가 '1234'인 ROW를 우선 추출한다.
  2. (1)에서 추출한 ROW 수만큼 테이블B(후행 테이블)의 NAME 인덱스를 탐색하여 ROW를 찾는다.
  3. (2)에서 찾아낸 테이블B의 ROW 중 BIRT_DT 값이 '19900101'인 데이터를 최종적으로 필터링한다.

### 주의사항 및 최적화 전략
NL JOIN 환경에서 성능을 보장하려면 **선행 테이블(A)에서 추출되는 데이터의 절대적인 양이 적어야 하며**, **후행 테이블(B)의 JOIN 컬럼(NAME)에 인덱스가 필수적으로 존재**해야 한다. (후행 테이블에 인덱스가 없다면 심각한 성능 저하가 발생한다.)

* 테이블 접근 순서가 매우 중요하므로 `LEADING`, `ORDERED` 등의 HINT를 적절히 활용하여 JOIN 범위를 좁힐 수 있는 작은 테이블을 선행 테이블로 선택한다.

### 관련 HINT
* `USE_NL(A)`: 특정 테이블에 대해 NESTED LOOP JOIN을 유도하는 힌트. JOIN 순서가 아닌 방식을 지정한다.
* `NO_USE_NL`: NESTED LOOP JOIN을 제외한 방식으로 유도한다. 단, NL JOIN이 가장 최적일 경우 옵티마이저가 무시할 수 있다.
* `USE_NL_WITH_INDEX`: NL JOIN 수행 시 외측 루프의 처리 주관 인덱스를 지정할 때 사용한다.
* `ORDERED`: FROM 절에 기술한 순서대로 JOIN을 수행하도록 유도한다.
* `LEADING`: FROM 절의 테이블 작성 순서와 무관하게 JOIN 순서를 직접 제어한다. (`ORDERED`와 함께 사용 시 `LEADING` 힌트는 무시된다.)

---

## 4. Hash Join

대량의 데이터 처리에 유리하며, NL Join으로 감당하기 힘든 대용량 데이터 환경에서 훌륭한 대안이 된다.

* **특징**:
  * 메모리(PGA)에 Hash 테이블을 구성하고, Hash 함수를 통해 JOIN을 수행하므로 CPU 및 메모리 사용량이 증가한다. 따라서 빈번하게 호출되는 온라인 쿼리에는 부적합하다.
  * JOIN에 사용될 두 테이블 중 작은 쪽을 Hash 테이블로 선정하고, 조인될 다른 테이블의 키 값을 해시 알고리즘으로 비교하여 결합하는 방식이다.
  * JOIN 컬럼에 적절한 인덱스가 구비되어 있지 않아 NL JOIN이 비효율적일 때 사용할 수 있다.

### HASH JOIN 동작 예제
```sql
SELECT /* 예시 쿼리 */
  FROM TABLE_A A
     , TABLE_B B
 WHERE A.ID = B.ID
   AND A.GENDER = '남성'
   AND B.ADDRESS = '서울';
```
* **동작 순서**:
  1. 테이블A에서 '남성'에 해당하는 ROW를 일괄 추출한다.
  2. JOIN 조건인 ID 값을 바탕으로 메모리에 HASH 테이블을 생성한다.
  3. 테이블B에서 '서울'에 해당하는 ROW를 추출한다.
  4. 추출된 테이블B의 JOIN 조건(ID)을 HASH 함수로 변환한 후, 메모리에 상주한 테이블A의 HASH 테이블에 접근하여 빠르게 JOIN한다.

### 주의사항 및 최적화 전략
* 작은 테이블을 선행 테이블로 두는 것이 HASH 테이블 구성 비용을 최소화하므로 성능에 절대적으로 유리하다.
* 후행 테이블을 대용량 테이블로 둘 수 있어 대량 데이터 처리에 매우 탁월하다.
* 실시간 응답성이 필요한 화면 조회용 쿼리보다는 배치(Batch) 프로그램이나 통계 쿼리에 적합하다.

### 관련 HINT
* `USE_HASH`: HASH JOIN 방식으로 수행되도록 유도한다.
* `NO_USE_HASH`: HASH JOIN을 제외한 다른 JOIN 방식으로 유도한다.

---

## 5. Sort Merge Join

JOIN 절 조건 컬럼에 인덱스가 없는 경우 빈번히 발생하던 JOIN 방식이다. 그러나 근래에는 대량 데이터 처리 시 성능이 더 우수한 Hash Join으로 대부분 대체되어 자주 사용되지 않는다.

### Sort Merge Join 동작 예제
```sql
SELECT /* 예시 쿼리 */
  FROM TABLE_A A
     , TABLE_B B
 WHERE A.ID = B.ID
   AND A.GENDER = '남성'
   AND B.ADDRESS = '서울';
```
* **동작 순서**:
  1. 테이블A에서 '남성'에 해당하는 ROW를 추출한 후 JOIN 조건인 ID를 기준으로 정렬(Sort)한다.
  2. 테이블B에서 '서울'에 해당하는 ROW를 추출한 후 JOIN 조건인 ID를 기준으로 정렬(Sort)한다.
  3. 정렬이 완료된 두 데이터 집합을 차례대로 병합(Merge)하여 JOIN을 완성한다.

### 주의사항 및 최적화 전략
* 인덱스 구성과 무관하게 전체 범위에 대해서 데이터를 일괄 처리해야 하는 대용량 환경에 사용될 수 있다.
* 하지만 데이터를 정렬(Sort)하는 데 막대한 리소스와 비용이 발생하므로 가급적 정렬이 불필요한 Hash Join으로 유도하는 것이 바람직하다.

### 관련 HINT
* `USE_MERGE`: SORT MERGE JOIN 방식으로 수행되도록 유도한다.
