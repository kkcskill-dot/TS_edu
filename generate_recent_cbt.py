import json
import re

questions = [
  {
    "qNum": 1,
    "text": "■ 문제 1. 다음 중 아래에서 엔터티 내에 주식별자를 도출하는 기준으로 옳지 않은 것은? [50회]",
    "options": [
      "해당 업무에서 자주 이용되는 속성을 주식별자로 지정한다.",
      "지정된 주식별자의 값은 자주 변하지 않는 것이어야 한다.",
      "명칭, 내역 등과 같이 이름으로 기술되는 것들을 주식별자로 지정한다.",
      "복합으로 주식별자를 구성할 경우 너무 많은 속성을 포함하지 않도록 한다."
    ],
    "correctIdx": 2,
    "explanation": "명칭, 내역 등 이름으로 기술되는 속성들은 식별자로 지정하기 부적절합니다. 동명이인이 존재할 수 있기 때문에 유일성을 보장하기 어렵습니다."
  },
  {
    "qNum": 2,
    "text": "■ 문제 2. 데이터 모델링에서 관계 표기법의 구성 요소로 옳지 않은 것은? [50회]",
    "options": [
      "관계명",
      "관계차수",
      "관계선택사양",
      "관계분류"
    ],
    "correctIdx": 3,
    "explanation": "관계의 표기법은 1) 관계명(Relationship Name), 2) 관계차수(Degree/Cardinality), 3) 관계선택사양(Optionality)의 3가지입니다. '관계분류'는 포함되지 않습니다."
  },
  {
    "qNum": 3,
    "text": "■ 문제 3. 하나의 엔터티에 구성되어 있는 여러 개의 속성 중 엔터티를 대표할 수 있는 속성은 무엇인가? [50회]",
    "options": [
      "일반 속성",
      "설계 속성",
      "파생 속성",
      "식별자"
    ],
    "correctIdx": 3,
    "explanation": "하나의 엔터티 내에서 각 인스턴스(행)들을 유일하게 구분하고 대표할 수 있는 속성을 식별자(Identifier)라고 합니다."
  },
  {
    "qNum": 4,
    "text": "■ 문제 4. 발생시점 및 파생 여부에 따른 엔터티 분류 중 중심(Main) 엔터티로 가장 적절한 것은? [50회]",
    "options": [
      "사원",
      "프로젝트",
      "고객",
      "부서"
    ],
    "correctIdx": 1,
    "explanation": "사원, 고객, 부서는 기본(Fundamental) 엔터티에 해당하며, 이 기본 엔터티들로부터 발생하여 업무의 중심이 되는 '프로젝트', '주문', '계약' 등이 중심 엔터티입니다."
  },
  {
    "qNum": 5,
    "text": "■ 문제 5. 다음 중 스키마의 3단계 구조에 포함되지 않는 것은? [50회]",
    "options": [
      "외부 스키마",
      "내부 스키마",
      "개념 스키마",
      "응용 스키마"
    ],
    "correctIdx": 3,
    "explanation": "데이터베이스 구조를 3단계로 나눈 ANSI/SPARC 3단계 스키마는 외부 스키마, 개념 스키마, 내부 스키마로 구성됩니다. 응용 스키마는 존재하지 않습니다."
  },
  {
    "qNum": 6,
    "text": "■ 문제 6. 아래 테이블에 대한 [뷰 생성 스크립트]를 실행한 후, 조회 SQL의 실행결과로 맞는 것은? [50회]<br><br><code>[뷰 생성 스크립트]<br>CREATE VIEW V_TBL AS<br>SELECT * FROM TBL<br>WHERE C1 = 'B' OR C1 IS NULL;<br><br>[조회 SQL]<br>SELECT SUM(C2) C2<br>FROM V_TBL<br>WHERE C2 >= 200 AND C1 = 'B';</code>",
    "options": [
      "0",
      "200",
      "300",
      "400"
    ],
    "correctIdx": 1,
    "explanation": "뷰의 조건(C1='B' 또는 NULL)과 조회 조건(C2>=200 그리고 C1='B')을 모두 만족하는 행은 C1='B'이고 C2가 200 이상인 행들입니다. 이들의 C2 값을 SUM하면 200입니다."
  },
  {
    "qNum": 7,
    "text": "■ 문제 7. 아우터 조인(OUTER JOIN)에서 ON 절의 역할에 대한 설명으로 올바른 것은? [50회]",
    "options": [
      "모든 테이블의 출력 기준을 결정한다.",
      "기준 테이블(LEFT/RIGHT)의 데이터는 조인 조건에 만족하지 않더라도 항상 모두 표시된다.",
      "기준이 아닌 테이블의 데이터만 조인 조건으로 필터링되어 출력된다.",
      "ON 절의 조건은 WHERE 절의 조건과 완전히 동일하게 동작한다."
    ],
    "correctIdx": 1,
    "explanation": "OUTER JOIN에서 ON 절은 조인할 대상을 결정하며, 기준이 되는 쪽(예: LEFT OUTER JOIN의 좌측) 테이블의 데이터는 ON 절 조건 만족 여부와 무관하게 항상 모두 표시됩니다."
  },
  {
    "qNum": 8,
    "text": "■ 문제 8. 아래 SQL의 수행 결과로 올바른 것은? [50회]<br><code>SELECT SUBSTR('abcdefg', 7-3) FROM DUAL;</code>",
    "options": [
      "cdef",
      "defg",
      "efg",
      "fg"
    ],
    "correctIdx": 1,
    "explanation": "SUBSTR('abcdefg', 4)와 동일하므로 4번째 문자 'd'부터 문자열의 끝까지인 'defg'를 반환합니다."
  },
  {
    "qNum": 9,
    "text": "■ 문제 9. 아래 SQL의 수행 결과로 올바른 것은? [50회]<br><code>SELECT NVL(COUNT(*), 9999) FROM TAB1 WHERE 1=2;</code>",
    "options": [
      "0",
      "9999",
      "1",
      "ERROR"
    ],
    "correctIdx": 0,
    "explanation": "COUNT(*)는 조건에 만족하는 행이 없어도 에러나 NULL이 아닌 0을 반환합니다. 결과가 0이므로 NVL 함수는 적용되지 않아 그대로 0이 출력됩니다."
  },
  {
    "qNum": 10,
    "text": "■ 문제 10. 다음 그룹 함수 중 결합 가능한 모든 값에 대하여 다차원 집계를 생성하는 함수는 무엇인가? [50회]",
    "options": [
      "ROLLUP",
      "GROUPING SETS",
      "GROUP BY",
      "CUBE"
    ],
    "correctIdx": 3,
    "explanation": "CUBE 함수는 인자로 나열된 컬럼들이 가질 수 있는 모든 가능한 조합에 대해 다차원 집계를 생성합니다. 시스템 부하가 가장 큽니다."
  },
  {
    "qNum": 11,
    "text": "■ 문제 11. Natural Join의 특징이 아닌 것은? [50회]",
    "options": [
      "두 테이블 간 동일한 이름을 가진 컬럼으로 조인이 이루어진다.",
      "등가조인(Equi Join)과 비등가조인(Non-Equi Join)이 모두 가능하다.",
      "USING 절을 사용할 수 없다.",
      "ON 절을 사용할 수 없다."
    ],
    "correctIdx": 1,
    "explanation": "NATURAL JOIN은 동일한 이름을 가진 컬럼에 대해 자동으로 '등가조인(Equi Join)'만을 수행합니다. 비등가조인은 불가능합니다."
  },
  {
    "qNum": 12,
    "text": "■ 문제 12. 테이블 컬럼의 데이터 타입을 변경하거나 기본값(DEFAULT)을 변경하는 DDL 명령어는? [50회]",
    "options": [
      "ALTER TABLE ... ADD",
      "ALTER TABLE ... DROP",
      "ALTER TABLE ... MODIFY",
      "ALTER TABLE ... RENAME"
    ],
    "correctIdx": 2,
    "explanation": "컬럼의 데이터 타입, 길이, DEFAULT 제약조건 등을 변경할 때는 ALTER TABLE [테이블명] MODIFY (오라클 기준) 또는 ALTER COLUMN (SQL Server 기준) 명령어를 사용합니다."
  },
  {
    "qNum": 13,
    "text": "■ 문제 13. 데이터 제어어(DCL) 및 트랜잭션 제어어(TCL)에 해당하지 않는 것은? [50회]",
    "options": [
      "GRANT",
      "ROLLBACK",
      "REVOKE",
      "ALTER"
    ],
    "correctIdx": 3,
    "explanation": "ALTER 명령어는 데이터베이스 객체의 구조를 변경하는 데이터 정의어(DDL)입니다."
  },
  {
    "qNum": 14,
    "text": "■ 문제 14. SQL 집합 연산자에서 교집합에 해당하는 것은? [50회]",
    "options": [
      "UNION ALL",
      "EXCEPT",
      "INTERSECT",
      "UNION"
    ],
    "correctIdx": 2,
    "explanation": "두 개의 쿼리 결과 집합 중 공통으로 존재하는 데이터(교집합)만 추출하는 연산자는 INTERSECT입니다."
  },
  {
    "qNum": 15,
    "text": "■ 문제 15. DELETE, TRUNCATE, DROP 명령어에 대한 설명으로 부적절한 것은? [50회]",
    "options": [
      "DROP은 테이블의 정의(구조)와 모든 데이터를 파괴하여 삭제한다.",
      "TRUNCATE 명령어는 테이블을 스토리지 할당이 없는 초기상태로 만든다.",
      "TRUNCATE 명령어는 Undo 로그를 생성하지 않기 때문에 전체 데이터 삭제 시 DELETE보다 빠르다.",
      "DROP은 Auto Commit이 되지만, DELETE와 TRUNCATE는 사용자 Commit으로 수행된다."
    ],
    "correctIdx": 3,
    "explanation": "TRUNCATE와 DROP은 데이터 정의어(DDL)이므로 둘 다 실행 즉시 Auto Commit 됩니다. (단, SQL Server에서는 트랜잭션 내의 TRUNCATE는 롤백 가능합니다.)"
  },
  {
    "qNum": 16,
    "text": "■ 문제 16. 계층형 질의(Hierarchical Query)에 대한 내용 중 잘못된 것은? [50회]",
    "options": [
      "START WITH 절은 데이터 전개가 시작될 기준 데이터를 지정한다.",
      "CONNECT BY 절은 부모-자식 간의 조인 조건을 명시한다.",
      "PRIOR 키워드를 사용하여 전개 방향(순방향/역방향)을 결정한다.",
      "단말 노드(Leaf) 여부를 반환하는 CONNECT_BY_ISLEAF 가상 컬럼의 레벨은 항상 1이다."
    ],
    "correctIdx": 3,
    "explanation": "CONNECT_BY_ISLEAF 가상 컬럼은 해당 행이 계층 트리의 가장 마지막 리프(Leaf) 노드인지 여부를 확인하여, 리프 노드이면 1, 자식이 있는 노드이면 0을 반환합니다."
  },
  {
    "qNum": 17,
    "text": "■ 문제 17. 제3정규형(3NF) 모델링에 대한 설명으로 올바른 것은? [49회]",
    "options": [
      "모든 속성은 반드시 하나의 원자값(Atomic Value)만을 가져야 한다.",
      "엔터티의 일반속성은 주식별자 전체에 종속적이어야 한다.",
      "엔터티의 일반속성 간에는 서로 종속적(이행적 함수 종속)이지 않아야 한다.",
      "다대다(M:N) 관계를 해소하기 위해 교차 엔터티를 생성해야 한다."
    ],
    "correctIdx": 2,
    "explanation": "제3정규형(3NF)은 식별자가 아닌 일반 속성들 간에 이행적 함수 종속(A->B, B->C)이 존재하지 않도록 분리하는 것을 말합니다. (일반속성간 종속성 해결)"
  },
  {
    "qNum": 18,
    "text": "■ 문제 18. 속성이 가질 수 있는 데이터 값의 범위, 크기, 타입 등을 정의한 것을 무엇이라 하는가? [49회]",
    "options": [
      "식별자",
      "릴레이션",
      "인스턴스",
      "도메인"
    ],
    "correctIdx": 3,
    "explanation": "각 속성이 취할 수 있는 값의 형식과 유효한 범위를 도메인(Domain)이라고 합니다."
  },
  {
    "qNum": 19,
    "text": "■ 문제 19. 주식별자를 구성하는 복합 속성 중 하나만이라도 제거되면 유일성을 만족하지 못하는 특성은 무엇인가? [49회]",
    "options": [
      "유일성",
      "최소성",
      "불변성",
      "존재성"
    ],
    "correctIdx": 1,
    "explanation": "주식별자를 구성하는 컬럼의 개수는 유일성을 만족하는 가장 최소의 조합으로 구성되어야 한다는 것이 '최소성(Minimality)'입니다."
  },
  {
    "qNum": 20,
    "text": "■ 문제 20. 모델링 단계에서 타 엔터티와의 식별자/비식별자 관계(Relationship)를 통해 부모로부터 상속받아 도출되는 속성은 무엇인가? [49회]",
    "options": [
      "기본 속성",
      "파생 속성",
      "설계 속성",
      "외부 식별자 (외래키, FK)"
    ],
    "correctIdx": 3,
    "explanation": "부모 엔터티의 주식별자를 자식 엔터티로 전달(상속)받아 생성되는 식별자를 외부 식별자(Foreign Key)라고 부릅니다."
  },
  {
    "qNum": 21,
    "text": "■ 문제 21. 다음 중 데이터를 조회할 때 빠른 성능을 낼 수 있도록 하기 위해 원래 속성의 값을 미리 계산하여 저장해 둔 속성으로 가장 적절한 것은? [48회]",
    "options": [
      "기본속성(Basic Attribute)",
      "설계속성(Designed Attribute)",
      "파생속성(Derived Attribute)",
      "PK속성(Primary Key Attribute)"
    ],
    "correctIdx": 2,
    "explanation": "총금액, 평균 등 다른 속성들로부터 계산이나 변형되어 도출된 속성을 파생속성이라고 합니다. 조회 성능 향상을 위해 반정규화 기법으로 흔히 사용됩니다."
  },
  {
    "qNum": 22,
    "text": "■ 문제 22. 다음 중 두 엔터티 간 관계(Relationship)의 기수성(1:1, 1:M, M:N)을 나타내는 개념으로 가장 적절한 것은? [48회]",
    "options": [
      "관계명(Relationship Name)",
      "관계선택사양(Relationship Optionality)",
      "관계분류(Relationship Class)",
      "관계차수(Relationship Degree/Cardinality)"
    ],
    "correctIdx": 3,
    "explanation": "한 인스턴스가 다른 엔터티의 몇 개 인스턴스와 연관될 수 있는지를 나타내는 수치(1:1, 1:M 등)를 관계차수(Cardinality)라고 합니다."
  },
  {
    "qNum": 23,
    "text": "■ 문제 23. SELECT 문장의 논리적 실행 순서를 올바르게 나열한 것은? [48회]",
    "options": [
      "SELECT -> FROM -> WHERE -> GROUP BY -> HAVING -> ORDER BY",
      "FROM -> SELECT -> WHERE -> GROUP BY -> HAVING -> ORDER BY",
      "FROM -> WHERE -> GROUP BY -> HAVING -> ORDER BY -> SELECT",
      "FROM -> WHERE -> GROUP BY -> HAVING -> SELECT -> ORDER BY"
    ],
    "correctIdx": 3,
    "explanation": "SQL의 논리적 실행 순서는 대상 집합을 가져오고(FROM), 필터링(WHERE), 묶고(GROUP BY), 그룹필터(HAVING)한 뒤, 출력할 컬럼을 고르고(SELECT), 최종 정렬(ORDER BY)합니다."
  },
  {
    "qNum": 24,
    "text": "■ 문제 24. 아래의 테이블 (주문번호, 회원번호, 주문금액) 에서 연봉의 순서에 따른 출력결과가 다음과 같을 때 SQL의 빈칸에 알맞은 윈도우 함수는?<br><br><code>[결과]<br>X 100 0<br>Y 200 100<br>X 300 200<br><br>[SQL]<br>SELECT (____)(COL1, 1, 0) OVER(ORDER BY 연봉) FROM TABLE;</code> [49회]",
    "options": [
      "LEAD",
      "LAG",
      "FIRST_VALUE",
      "LAST_VALUE"
    ],
    "correctIdx": 1,
    "explanation": "결과를 보면 현재 행보다 '이전 행'의 값을 가져오고 있습니다 (맨 첫 행은 이전 값이 없으므로 지정한 기본값 0을 출력). 이전 행의 값을 가져오는 윈도우 함수는 LAG 입니다."
  },
  {
    "qNum": 25,
    "text": "■ 문제 25. 다음 GROUP 함수 중 괄호 내 인자의 순서가 변경되더라도 생성되는 소계의 결과가 완전히 동일한 함수는 무엇인가? [47회]",
    "options": [
      "ROLLUP",
      "GROUPING",
      "GROUPING SETS",
      "CUBE"
    ],
    "correctIdx": 3,
    "explanation": "ROLLUP은 인자의 순서에 따라 계층적인 소계를 산출하므로 순서가 바뀌면 결과가 달라집니다. 하지만 CUBE는 가능한 모든 다차원 조합에 대한 소계를 산출하므로 인자의 순서가 무관합니다."
  },
  {
    "qNum": 26,
    "text": "■ 문제 26. 트랜잭션(Transaction)의 특성 중, 트랜잭션이 성공적으로 수행 완료되면 그 트랜잭션이 갱신한 데이터베이스의 내용은 영구적으로 저장된다는 특성은? [47회]",
    "options": [
      "원자성(Atomicity)",
      "일관성(Consistency)",
      "고립성(Isolation)",
      "지속성(Durability)"
    ],
    "correctIdx": 3,
    "explanation": "COMMIT된 데이터는 시스템 장애가 발생하더라도 데이터베이스에 영구히 남아야 한다는 성질을 지속성(Durability)이라고 합니다."
  },
  {
    "qNum": 27,
    "text": "■ 문제 27. 다음 중 저장 프로시저(Stored Procedure)와 트리거(Trigger)에 대한 설명으로 가장 적절하지 않은 것은? [47회]",
    "options": [
      "프로시저는 응용프로그램의 복잡한 로직을 DB 내부에 저장하여 캡슐화하고 성능을 개선할 수 있다.",
      "프로시저는 사용자가 EXECUTE 명령을 통해 명시적으로 호출하여 실행한다.",
      "트리거는 테이블에 대한 INSERT, UPDATE, DELETE 구문이 실행될 때 데이터베이스가 자동으로 실행한다.",
      "프로시저와 트리거 내부에서는 모두 COMMIT, ROLLBACK을 사용하여 자율적으로 트랜잭션을 제어할 수 있다."
    ],
    "correctIdx": 3,
    "explanation": "트리거(Trigger) 내부에서는 호출한 DML문과 동일한 트랜잭션 사이클에 묶여야 하므로 COMMIT이나 ROLLBACK 등의 TCL 명령어를 사용할 수 없습니다."
  },
  {
    "qNum": 28,
    "text": "■ 문제 28. 조인 조건이 없는 두 테이블을 조인하거나, 모든 데이터 간의 가능한 조합(M*N 건)을 추출하기 위해 사용하는 조인은? [47회]",
    "options": [
      "INNER JOIN",
      "NATURAL JOIN",
      "OUTER JOIN",
      "CROSS JOIN"
    ],
    "correctIdx": 3,
    "explanation": "조인 조건 없이 데카르트 곱(Cartesian Product)을 생성하는 조인을 CROSS JOIN 이라고 합니다."
  },
  {
    "qNum": 29,
    "text": "■ 문제 29. 집합 연산자에 대한 설명으로 가장 적절한 것은? [47회]",
    "options": [
      "UNION ALL 은 두 집합의 중복을 제거하기 위해 내부적으로 정렬(SORT) 작업을 수행한다.",
      "UNION 은 상호 배타적인 조건일 때 주로 사용되며 두 집합을 그대로 합친다.",
      "INTERSECT 는 두 결과 집합의 합집합을 구한다.",
      "UNION 은 두 결과 집합의 합집합이며 중복된 행은 하나의 행으로 취급하여 제거한다."
    ],
    "correctIdx": 3,
    "explanation": "UNION은 중복을 제거하기 위해 정렬을 수행하며, UNION ALL은 정렬 없이 단순히 두 결과를 이어 붙이므로 성능상 훨씬 빠릅니다."
  },
  {
    "qNum": 30,
    "text": "■ 문제 30. 권한 관리 명령어인 DCL 구문 작성 규칙으로 알맞은 것은?<br><code>GRANT INSERT (__) TABLE명 (__) USER명;</code> [48회]",
    "options": [
      "IN, TO",
      "ON, FROM",
      "ON, TO",
      "IN, FROM"
    ],
    "correctIdx": 2,
    "explanation": "객체 권한을 부여하는 GRANT 명령어의 문법은 `GRANT 권한종류 ON 오브젝트 TO 사용자;` 입니다. (회수할 때는 `REVOKE 권한 ON 오브젝트 FROM 사용자;`)"
  },
  {
    "qNum": 31,
    "text": "■ 문제 31. 오라클(Oracle) 환경에서 아래 SQL을 수행할 때 결과의 정렬 순서로 가장 알맞은 것은?<br><code>SELECT * FROM TABLE ORDER BY COL1 ASC;</code> [49회]",
    "options": [
      "NULL 값은 데이터가 없는 것이므로 오름차순 시 가장 먼저(맨 앞) 출력된다.",
      "NULL 값은 무한대로 가장 큰 값으로 인식되어 오름차순 시 맨 마지막에 출력된다.",
      "NULL 값은 오름차순 시 에러를 유발하므로 반드시 IS NOT NULL로 제외해야 한다.",
      "NULL 값은 무시되어 정렬 결과에서 아예 누락된다."
    ],
    "correctIdx": 1,
    "explanation": "Oracle 데이터베이스는 NULL을 '가장 큰 값'으로 취급하므로, 오름차순(ASC) 정렬을 할 경우 결과 집합의 맨 마지막에 위치하게 됩니다. (SQL Server는 반대)"
  },
  {
    "qNum": 32,
    "text": "■ 문제 32. 윈도우 순위 함수 중 중복 순위가 존재해도 다음 순위 값을 건너뛰지 않고 빽빽하게 순차적으로 부여하는 함수는? [49회]",
    "options": [
      "RANK()",
      "ROW_NUMBER()",
      "PERCENT_RANK()",
      "DENSE_RANK()"
    ],
    "correctIdx": 3,
    "explanation": "동점자가 2명일 때 RANK()는 1, 1, 3 으로 2를 건너뛰지만, DENSE_RANK()는 1, 1, 2 와 같이 빽빽하게(Dense) 순위를 매깁니다."
  },
  {
    "qNum": 33,
    "text": "■ 문제 33. 다중 컬럼/다중 행 서브쿼리 문법 중 에러가 발생하는 구문을 고르시오. [49회]",
    "options": [
      "WHERE (A, B) IN (SELECT A, B FROM ...)",
      "WHERE A >= (SELECT MAX(A) FROM ... GROUP BY B)",
      "WHERE EXISTS (SELECT 1 FROM ...)",
      "WHERE A > ALL (SELECT A FROM ...)"
    ],
    "correctIdx": 1,
    "explanation": "GROUP BY가 포함되어 여러 행(Multiple Rows)을 반환할 수 있는 서브쿼리를 단일행 비교 연산자(>=)와 함께 사용하면 'single-row subquery returns more than one row' 에러가 발생합니다."
  },
  {
    "qNum": 34,
    "text": "■ 문제 34. 데이터베이스에서 NOT NULL 조건이 없는 컬럼에 대해 집계 함수를 수행했을 때 처리 방법으로 알맞은 것은? [49회]",
    "options": [
      "AVG(컬럼)은 전체 행의 수(NULL 포함)를 분모로 하여 평균을 계산한다.",
      "SUM(컬럼) + 10 의 결과는 NULL 값이 있을 경우 에러를 발생시킨다.",
      "COUNT(*)와 COUNT(컬럼)은 항상 100% 동일한 결과를 반환한다.",
      "AVG(컬럼)은 NULL인 데이터 행을 분모(건수)에서 완전히 제외하고 평균을 계산한다."
    ],
    "correctIdx": 3,
    "explanation": "AVG, SUM 등 모든 컬럼 명시 집계 함수는 NULL 값을 가진 행을 연산 대상에서 완전히 제외합니다. (예: 10, 20, NULL의 AVG는 30/2 = 15가 됩니다.)"
  },
  {
    "qNum": 35,
    "text": "■ 문제 35. 아래 SQL 함수 중 특정 문자열의 일부분을 추출하기 위해 사용하는 함수는? [49회]",
    "options": [
      "LPAD",
      "RTRIM",
      "CONCAT",
      "SUBSTR (또는 SUBSTRING)"
    ],
    "correctIdx": 3,
    "explanation": "문자열 내의 시작 위치와 길이를 지정하여 부분 문자열을 잘라내는 함수는 SUBSTR입니다."
  },
  {
    "qNum": 36,
    "text": "■ 문제 36. 테이블 생성시 기본값(DEFAULT) 제약조건에 대한 설명으로 올바른 것은? [49회]",
    "options": [
      "DEFAULT가 설정된 컬럼에 명시적으로 NULL을 INSERT하면 에러가 발생한다.",
      "INSERT문에서 해당 컬럼을 아예 명시하지 않고 누락시킬 때만 DEFAULT 값이 자동으로 입력된다.",
      "DEFAULT 값은 숫자나 문자 상수만 가능하며 SYSDATE 같은 함수는 사용할 수 없다.",
      "이미 데이터가 들어있는 테이블에 ALTER로 DEFAULT 제약조건을 추가하면 기존 NULL 데이터들이 일괄 업데이트된다."
    ],
    "correctIdx": 1,
    "explanation": "INSERT 문에서 컬럼 리스트에 컬럼명 자체를 생략해야 DEFAULT 제약조건이 발동하여 기본값이 입력됩니다. 명시적으로 NULL을 넣으면 그대로 NULL이 들어갑니다."
  },
  {
    "qNum": 37,
    "text": "■ 문제 37. 아래 SQL의 결과를 예측하시오.<br><code>SELECT ROUND(10333.33, -2) FROM DUAL;</code> [46회]",
    "options": [
      "10333",
      "10333.33",
      "10300",
      "10400"
    ],
    "correctIdx": 2,
    "explanation": "ROUND 함수의 두 번째 인자가 음수(-2)이면 소수점 이상 자리, 즉 십의 자리(10^1)에서 반올림을 수행합니다. 33의 십의자리인 3은 버려지므로 10300이 됩니다."
  },
  {
    "qNum": 38,
    "text": "■ 문제 38. COALESCE 함수에 대한 설명으로 올바른 것은? [46회]",
    "options": [
      "두 개의 인자를 받아 첫 번째 인자가 NULL이면 두 번째 인자를, 아니면 첫 번째를 반환한다.",
      "주어진 여러 개의 인자 중에서 첫 번째로 NULL이 아닌 값을 반환한다.",
      "두 인자의 값이 같으면 NULL을, 다르면 첫 번째 인자를 반환한다.",
      "조건이 만족되면 특정 값을 반환하는 IF-THEN-ELSE 로직을 수행한다."
    ],
    "correctIdx": 1,
    "explanation": "COALESCE(A, B, C...)는 콤마로 나열된 파라미터들을 순차적으로 평가하여 제일 처음으로 NULL이 아닌 값을 뱉어내는 표준 함수입니다."
  },
  {
    "qNum": 39,
    "text": "■ 문제 39. 부서 테이블(DEPT)에는 있으나 사원 테이블(EMP)에는 소속된 사원이 단 한 명도 없는 빈 부서를 포함하여 모든 부서 정보를 출력하고자 할 때, 가장 적절한 조인 기법은? [46회]",
    "options": [
      "INNER JOIN",
      "CROSS JOIN",
      "RIGHT OUTER JOIN (사원 RIGHT OUTER JOIN 부서)",
      "NATURAL JOIN"
    ],
    "correctIdx": 2,
    "explanation": "아우터 조인(OUTER JOIN)을 사용하면 조인 조건(소속 사원 존재)을 만족하지 않는 기준 테이블(부서)의 행들도 누락되지 않고 강제로 결과 집합에 포함되어 출력됩니다."
  },
  {
    "qNum": 40,
    "text": "■ 문제 40. GROUPING SETS 에 대한 설명으로 올바른 것은? [46회]",
    "options": [
      "GROUPING SETS (A, B) 는 A와 B가 결합된 단일 그룹핑 결과를 산출한다.",
      "GROUPING SETS (A, B) 는 ROLLUP(A, B) 와 완벽히 동일한 결과이다.",
      "GROUPING SETS (A, B) 는 GROUP BY A 결과와 GROUP BY B 결과를 UNION ALL 한 것과 동일하다.",
      "전체 총계(Total) 소계 행을 무조건 생성한다."
    ],
    "correctIdx": 2,
    "explanation": "GROUPING SETS는 나열된 괄호 내의 그룹들에 대해 각각 개별적으로 집계를 수행한 뒤 그 결과들을 통합(UNION ALL)하여 보여줍니다."
  },
  {
    "qNum": 41,
    "text": "■ 문제 41. 윈도우 함수에서 사용하는 파티션 범위 지정 절(Window Frame) 중 올바르지 않은 것은? [48회]",
    "options": [
      "ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW",
      "RANGE BETWEEN 1 PRECEDING AND 1 FOLLOWING",
      "ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING",
      "RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED PRECEDING"
    ],
    "correctIdx": 3,
    "explanation": "UNBOUNDED PRECEDING(파티션의 맨 첫 행)에서 시작하여 UNBOUNDED PRECEDING으로 끝나는 구간 지정은 불가능합니다."
  },
  {
    "qNum": 42,
    "text": "■ 문제 42. SQL 최적화를 수행하는 옵티마이저(Optimizer)의 조인 수행 원리 중, 동등(=) 조인에서만 사용 가능하며 조인 대상 테이블에 인덱스가 없어도 메모리 해시맵을 생성하여 대량의 데이터를 가장 빠르게 처리하는 조인 기법은? [46~50회 통합]",
    "options": [
      "Nested Loop Join (NL Join)",
      "Sort Merge Join",
      "Hash Join",
      "Cartesian Join"
    ],
    "correctIdx": 2,
    "explanation": "해시 조인(Hash Join)은 선행 테이블을 해시 메모리에 적재하여 후행 테이블과 조인하는 방식으로, 대용량 Equal Join에 압도적인 성능을 냅니다."
  },
  {
    "qNum": 43,
    "text": "■ 문제 43. 성능 데이터 모델링에서 디스크 I/O를 경감하기 위해 하나의 테이블에 너무 많은 컬럼이 존재하는 경우 고려할 수 있는 해결 방안은? [46~50회 통합]",
    "options": [
      "수평 분할 (Horizontal Partitioning)",
      "수직 분할 (Vertical Partitioning 또는 1:1 테이블 분리)",
      "통계 테이블 추가",
      "파생 칼럼 추가"
    ],
    "correctIdx": 1,
    "explanation": "하나의 테이블에 컬럼(속성)이 너무 많으면 디스크 블록 공간 부족으로 Row Chaining이 발생합니다. 자주 접근하는 컬럼과 그렇지 않은 컬럼을 수직으로(1:1 관계) 쪼개어 분리하는 수직 분할이 효과적입니다."
  },
  {
    "qNum": 44,
    "text": "■ 문제 44. 인덱스의 구조 중 실제 데이터 로우 자체가 인덱스 키의 정렬 순서대로 물리적으로 정렬되어 저장되는 인덱스 방식은? [46~50회 통합]",
    "options": [
      "B-Tree 인덱스",
      "비트맵(Bitmap) 인덱스",
      "클러스터형(Clustered) 인덱스",
      "비클러스터형(Non-Clustered) 인덱스"
    ],
    "correctIdx": 2,
    "explanation": "SQL Server 등에서 지원하는 클러스터형 인덱스(Clustered Index)는 테이블의 데이터 페이지 자체가 인덱스의 리프 노드가 되어 물리적으로 데이터를 정렬해 둡니다. 따라서 테이블당 1개만 생성 가능합니다."
  },
  {
    "qNum": 45,
    "text": "■ 문제 45. 뷰(View)의 특성에 대한 설명 중 올바른 것은? [46~50회 통합]",
    "options": [
      "뷰는 실제 데이터를 디스크에 저장하고 있다.",
      "뷰는 복잡한 질의를 단순하게 캡슐화하고 데이터 보안성을 제공할 수 있다.",
      "뷰에 대한 INSERT, UPDATE 연산은 어떠한 제약 조건 없이 원본 테이블과 완벽히 동일하게 수행된다.",
      "모든 뷰는 인덱스를 자유롭게 생성하여 조회 속도를 극적으로 높일 수 있다."
    ],
    "correctIdx": 1,
    "explanation": "일반 뷰는 데이터 딕셔너리에 저장된 SELECT SQL 구문 그 자체입니다. 물리적인 데이터를 갖지 않으며(독립성), 사용자에게 보여주고 싶은 컬럼만 노출하여 보안을 강화할 수 있습니다."
  },
  {
    "qNum": 46,
    "text": "■ 문제 46. 다음 중 트랜잭션의 커밋(COMMIT)과 롤백(ROLLBACK) 수행 시 나타나는 현상이 아닌 것은? [46~50회 통합]",
    "options": [
      "COMMIT을 하면 다른 세션(사용자)들이 내가 변경한 데이터를 조회할 수 있게 된다.",
      "ROLLBACK을 하면 SAVEPOINT 없이도 이전 COMMIT 시점으로 롤백된다.",
      "COMMIT이나 ROLLBACK을 수행하면 변경 대상 행에 걸려있던 배타적 잠금(Locking)이 해제된다.",
      "COMMIT 이전에 수행한 DDL 명령어(CREATE, DROP 등)들도 내가 ROLLBACK 하면 모두 원상복구된다."
    ],
    "correctIdx": 3,
    "explanation": "오라클 환경에서 DDL 명령어(CREATE, ALTER, DROP 등)는 실행 즉시 암묵적으로 Auto-Commit이 수행됩니다. 따라서 롤백으로 DDL 결과를 취소할 수 없습니다."
  },
  {
    "qNum": 47,
    "text": "■ 문제 47. 다음 중 분산 데이터베이스 환경에서 로컬 DB 환경으로 데이터를 물리적으로 복제하여 성능을 개선하는 기법은? [46~50회 통합]",
    "options": [
      "테이블 요약 분산",
      "위치 투명성",
      "테이블 복제 분산 (부분 복제 / 광역 복제)",
      "지역 사상 투명성"
    ],
    "correctIdx": 2,
    "explanation": "테이블 복제(Replication) 분산은 마스터 노드의 데이터를 여러 지사 노드에 물리적으로 복사해 두어, 각 지사에서 원격 조인 없이 로컬 조인만으로 빠른 조회가 가능하도록 하는 아키텍처입니다."
  },
  {
    "qNum": 48,
    "text": "■ 문제 48. 다음 중 옵티마이저가 인덱스를 사용할 수 없는(Full Table Scan 유발) 조건절이 아닌 것은? [46~50회 통합]",
    "options": [
      "WHERE 컬럼명 LIKE '%SQLD'",
      "WHERE TO_CHAR(숫자컬럼) = '100'",
      "WHERE 컬럼명 IS NOT NULL",
      "WHERE 컬럼명 BETWEEN 100 AND 200"
    ],
    "correctIdx": 3,
    "explanation": "BETWEEN 연산자는 연속된 범위 검색이므로 인덱스 레인지 스캔(Range Scan)을 정상적으로 탈 수 있습니다. (전방 와일드카드(%), 좌변 컬럼 가공, IS NOT NULL 등은 인덱스 사용을 심각하게 제한합니다.)"
  },
  {
    "qNum": 49,
    "text": "■ 문제 49. SQL 실행 계획(Execution Plan)에서 테이블 조인 순서(Driving)와 관련하여 가장 적절한 성능 튜닝 가이드는? [46~50회 통합]",
    "options": [
      "옵티마이저는 데이터가 가장 많은 덩치 큰 테이블을 항상 선행(Driving) 테이블로 삼는다.",
      "Nested Loop Join 에서는 조인 결과 행의 수가 가장 적게 도출되는 작은 테이블을 선행(Driving) 테이블로 두는 것이 유리하다.",
      "Hash Join 에서는 해시맵 메모리 부족을 방지하기 위해 가장 덩치가 큰 테이블을 선행 테이블로 선택해야 한다.",
      "옵티마이저는 사용자가 기술한 FROM 절의 테이블 순서대로 무조건 조인 순서를 결정한다."
    ],
    "correctIdx": 1,
    "explanation": "NL 조인의 경우 선행 테이블에서 읽은 건수만큼 후행 테이블을 반복 접근(랜덤 I/O)하므로, 필터링 결과가 가장 적은 테이블이 선행 테이블(Driving)이 되어야 성능이 향상됩니다. (해시 조인도 해시 영역에 담기 위해 가장 작은 테이블을 선행으로 둡니다.)"
  },
  {
    "qNum": 50,
    "text": "■ 문제 50. 다음 중 문자열의 맨 처음부터 한 문자씩 값을 비교해나가며, 길이가 다를 경우 짧은 쪽의 끝에 공백(SPACE) 문자를 채워 길이를 맞춘 후 비교하는 데이터 타입은? [46~50회 통합]",
    "options": [
      "CHAR",
      "VARCHAR2",
      "CLOB",
      "NVARCHAR"
    ],
    "correctIdx": 0,
    "explanation": "고정 길이 문자열 타입인 CHAR 타입은 내부적으로 부족한 길이를 공백으로 채워(Padding) 고정된 크기를 유지하며 비교 시에도 공백을 채운 논리로 동작합니다. (반면 VARCHAR2는 가변길이로 공백도 독립된 문자로 인식합니다.)"
  }
]

import os

app_js_path = '/Users/kichan/tech_edu/PerformanceDiagnostics/app.js'

questions_json_str = json.dumps(questions, ensure_ascii=False, indent=6)

new_subject = f"""
  sqld_recent: {{
    title: "SQLD 46~50회 최신 기출 모의고사",
    desc: "가장 최근 치러진 SQLD 46~50회 최신 기출문제 트렌드를 50문항으로 총망라한 모의고사입니다. 실전과 동일한 환경에서 합격 컷을 넘겨보세요!",
    limitSeconds: 3000,
    questions: {questions_json_str}
  }},
"""

with open(app_js_path, 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r'(const cbtSubjects = \{)'
# We replace the first occurrence of the pattern with the pattern + new_subject
new_content = re.sub(pattern, r'\1' + new_subject.replace('\\', '\\\\'), content, count=1)

with open(app_js_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Updated app.js with sqld_recent CBT questions.")
