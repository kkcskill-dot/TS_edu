import json
import re

questions = [
  {
    "qNum": 1,
    "text": "■ 문제 1. 도메인의 특징으로 알맞지 않은 것은?",
    "options": [
      "엔터티 내에서 속성에 대한 데이터 타입과 크기를 지정한다",
      "엔터티 내에서 속성에 대한 NOT NULL 을 지정한다",
      "엔터티 내에서 속성에 대한 Check 조건을 지정한다",
      "테이블의 속성 간 FK 제약 조건을 지정한다"
    ],
    "correctIdx": 3,
    "explanation": "도메인은 각 속성이 가질 수 있는 값의 범위나 데이터 타입 등을 정의하는 것이며, 테이블 간의 제약 조건(FK)을 지정하는 것은 아닙니다."
  },
  {
    "qNum": 2,
    "text": "■ 문제 2. 다음 중 주식별자를 도출하기 위한 기준으로 적절하지 않은 것은?",
    "options": [
      "해당 업무에서 자주 이용되는 속성을 주식별자로 지정한다",
      "명칭, 내역 등과 같이 이름으로 기술되는 것들은 가능하면 주식별자로 지정하지 않는다",
      "복합으로 주식별자로 구성할 경우 너무 많은 속성이 포함되지 않도록 한다",
      "지정된 주식별자의 값은 변경될 수도 있다"
    ],
    "correctIdx": 3,
    "explanation": "주식별자의 중요한 특징 중 하나는 '불변성'입니다. 한 번 지정된 주식별자의 값은 변하지 않아야 합니다."
  },
  {
    "qNum": 3,
    "text": "■ 문제 3. 다음 중 아래 시나리오에서 엔터티로 가장 적절한 것은?<br><br>[시나리오]<br>S 병원은 여러 명의 환자가 존재하고 각 환자에 대한 이름, 주소 등을 관리해야 한다.",
    "options": [
      "병원",
      "환자",
      "이름",
      "주소"
    ],
    "correctIdx": 1,
    "explanation": "시나리오에서 데이터를 관리하고자 하는 대상(인스턴스들의 집합)은 '환자'입니다. 이름, 주소 등은 환자 엔터티의 '속성'입니다."
  },
  {
    "qNum": 4,
    "text": "■ 문제 4. 주식별자의 특징으로 가장 적절하지 않은 것은?",
    "options": [
      "유일성 : 주식별자에 의해 엔터티 내에서 모든 인스턴스들을 유일하게 구분함",
      "최소성 : 주식별자를 구성하는 속성의 수는 유일성을 만족하는 최소의 수가 되어야 함",
      "불변성 : 주식별자가 한 번 특정 엔터티에 지정되면 그 식별자의 값은 변하지 않아야 함",
      "존재성 : 주식별자가 지정되면 데이터 값이 존재하지 않을 수 있음 (NULL 허용)"
    ],
    "correctIdx": 3,
    "explanation": "주식별자의 존재성(NOT NULL)이란 주식별자로 지정된 속성은 반드시 값이 존재해야 한다는 것을 의미합니다. NULL을 허용하지 않습니다."
  },
  {
    "qNum": 5,
    "text": "■ 문제 5. 다음 중 컬럼에 대한 반정규화 기법으로 가장 적절하지 않은 것은?",
    "options": [
      "중복칼럼을 추가 - 조인감소를 위해 여러 테이블에 동일한 칼럼을 갖도록 한다.",
      "파생칼럼을 추가한다 - 조회 성능을 우수하게 하기 위해 미리 계산된 칼럼을 갖도록 한다.",
      "이력테이블에 기능 칼럼을 추가한다 - 최신값을 처리하는 이력의 특성을 고려하여 기능성 칼럼을 추가한다.",
      "FK에 대한 속성을 추가한다 - FK관계에 해당하는 속성을 추가하여 조인 성능을 높인다."
    ],
    "correctIdx": 3,
    "explanation": "FK는 관계형 데이터베이스에서 관계를 연결하는 기본 매커니즘일 뿐, 반정규화 기법으로 'FK 속성을 추가'한다는 개념은 부적절합니다."
  },
  {
    "qNum": 6,
    "text": "■ 문제 6. 속성의 특징으로 가장 올바른 것은?",
    "options": [
      "엔터티는 한 개의 속성만으로 구성될 수 있다",
      "엔터티를 설명하고 인스턴스의 구성요소가 된다",
      "하나의 속성에는 여러 개의 속성값을 가질 수 있다",
      "속성의 특성에 따른 분류에는 PK 속성, FK 속성, 일반 속성이 있다"
    ],
    "correctIdx": 1,
    "explanation": "엔터티는 2개 이상의 속성을 가져야 하며, 하나의 속성은 하나의 값만 가져야 합니다. 특성에 따른 분류는 기본속성, 파생속성, 설계속성입니다."
  },
  {
    "qNum": 7,
    "text": "■ 문제 7. TRUNCATE TABLE 명령어의 특징으로 가장 적절한 것은?",
    "options": [
      "테이블 자체를 삭제하는 명령어로 DROP TABLE 과 동일한 명령어이다",
      "특정 로우를 선택하여 지울 수 없다",
      "DELETE TABLE 과는 다르게 TRUNCATE TABLE 의 경우 정상적인 복구가 가능하다",
      "DELETE TABLE 보다 시스템 부하가 더 크다"
    ],
    "correctIdx": 1,
    "explanation": "TRUNCATE는 DDL이므로 조건(WHERE)을 지정하여 특정 로우만 지울 수 없습니다. 또한 Auto Commit되므로 롤백이 불가능하며 시스템 부하가 적습니다."
  },
  {
    "qNum": 8,
    "text": "■ 문제 8. PROCEDURE, TRIGGER 에 대한 설명 중 가장 잘못된 것은?",
    "options": [
      "PROCEDURE, TRIGGER 모두 EXECUTE 명령어로 수행된다",
      "PROCEDURE, TRIGGER 모두 CREATE 명령어로 생성한다",
      "PROCEDURE 는 COMMIT, ROLLBACK 명령어를 사용할 수 있다",
      "TRIGGER 는 COMMIT, ROLLBACK 명령어를 사용할 수 없다"
    ],
    "correctIdx": 0,
    "explanation": "프로시저는 EXECUTE 명령어로 명시적 실행이 가능하지만, 트리거(Trigger)는 DML 이벤트 발생 시 데이터베이스에 의해 자동으로 수행됩니다."
  },
  {
    "qNum": 9,
    "text": "■ 문제 9. PLAYER 테이블에서 선수명과 팀명은 오름차순, 연봉은 내림차순으로 조회하는 SQL 로 바른 것은?",
    "options": [
      "SELECT 선수명, 팀명, 연봉 FROM PLAYER ORDER BY 선수명 DESC, 팀명 DESC, 연봉 ASC",
      "SELECT 선수명, 팀명, 연봉 FROM PLAYER ORDER BY 선수명 ASC, 팀명 ASC , 연봉",
      "SELECT 선수명, 팀명, 연봉 FROM PLAYER ORDER BY 선수명 ASC, 팀명, 3 DESC",
      "SELECT 선수명, 팀명, 연봉 FROM PLAYER ORDER BY 선수명, 팀명, DESC 연봉"
    ],
    "correctIdx": 2,
    "explanation": "오름차순(ASC)은 생략 가능합니다. 또한 컬럼 순서인 숫자 '3'을 사용하여 ORDER BY 절을 구성할 수 있습니다."
  },
  {
    "qNum": 10,
    "text": "■ 문제 10. 아래의 SQL에서 NULL 을 반환하는 SQL은 어떤 것인가?",
    "options": [
      "SELECT COALESCE(NULL,'2') FROM DUAL",
      "SELECT NULLIF('A','A') FROM DUAL",
      "SELECT NVL(NULL,0) + 10 FROM DUAL",
      "SELECT NVL(NULL,'A') FROM DUAL"
    ],
    "correctIdx": 1,
    "explanation": "NULLIF(exp1, exp2)는 두 인자값이 같으면 NULL을 반환하고 다르면 첫 번째 인자값을 반환하는 함수입니다."
  },
  {
    "qNum": 11,
    "text": "■ 문제 11. 아래의 GROUP 함수에 대한 설명으로 가장 적절한 것은?",
    "options": [
      "CUBE는 결합 가능한 모든 값에 대하여 다차원 집계를 생성한다.",
      "ROLLUP 은 계층구조가 평등한 관계이므로 인수의 순서가 바뀌어도 결과는 같다.",
      "ROLLUP, CUBE, GROUPING SETS 은 특정 컬럼에 대한 정렬은 가능하나 계층간 정렬은 불가능하다.",
      "ROLLUP은 CUBE에 비해 시스템에 많은 부담을 주므로 사용에 주의해야 한다"
    ],
    "correctIdx": 0,
    "explanation": "CUBE 함수는 인수로 주어진 모든 컬럼들의 조합에 대한 집계를 다차원적으로 계산합니다. (반면 ROLLUP은 인수의 순서가 중요합니다)"
  },
  {
    "qNum": 12,
    "text": "■ 문제 12. 아래의 트랜잭션 특성에 대한 설명을 올바르게 연결한 것은?<br><br>(ㄱ) 트랜잭션에서 정의된 연산들은 모두 성공적으로 실행되던지 전혀 실행되지 않은 상태로 남아 있어야 한다.<br>(ㄴ) 트랜잭션이 실행되는 도중에 다른 트랜잭션의 영향을 받아 잘못된 결과를 만들어서는 안된다.<br>(ㄷ) 트랜잭션이 성공적으로 수행되면 갱신한 내용은 영구적으로 저장된다.<br>(ㄹ) 실행 전 데이터베이스가 정상이라면 트랜잭션 실행 이후에도 내용에 잘못이 있으면 안된다.",
    "options": [
      "일관성, 원자성, 지속성, 고립성",
      "원자성, 일관성, 지속성, 고립성",
      "원자성, 고립성, 지속성, 일관성",
      "고립성, 원자성, 일관성, 지속성"
    ],
    "correctIdx": 2,
    "explanation": "ㄱ:원자성(Atomicity), ㄴ:고립성(Isolation), ㄷ:지속성(Durability), ㄹ:일관성(Consistency) 입니다."
  },
  {
    "qNum": 13,
    "text": "■ 문제 13. 순번을 구하는 그룹함수가 아닌 것은?",
    "options": [
      "RANK",
      "ROW_NUMBER",
      "DENSE_RANK",
      "RATIO_TO_REPORT"
    ],
    "correctIdx": 3,
    "explanation": "RATIO_TO_REPORT는 전체 합계에 대한 해당 로우 값의 비율(0~1)을 구하는 윈도우 함수입니다."
  },
  {
    "qNum": 14,
    "text": "■ 문제 14. 반올림 함수로 알맞은 것은?",
    "options": [
      "ROUND",
      "CEIL",
      "TRUNC",
      "EXP"
    ],
    "correctIdx": 0,
    "explanation": "ROUND는 반올림, CEIL은 올림, TRUNC는 버림, EXP는 지수 함수입니다."
  },
  {
    "qNum": 15,
    "text": "■ 문제 15. ORDER BY 의 특징으로 가장 적절하지 않은 것은?",
    "options": [
      "ORDER BY 의 기본 정렬은 내림차순이다",
      "SELECT 구문에 사용되지 않은 컬럼도 ORDER BY 구문에서 사용할 수 있다",
      "ORDER BY 1, COL1 과 같이 숫자와 컬럼을 혼용하여 사용할 수 있다",
      "ORACLE 은 NULL 을 가장 큰 값으로 취급하여 ORDER BY ASC 시 맨 뒤로 정렬된다."
    ],
    "correctIdx": 0,
    "explanation": "ORDER BY의 기본 정렬 기준은 오름차순(ASC)입니다."
  },
  {
    "qNum": 16,
    "text": "■ 문제 16. SQL 집합 연산자 INTERSECT 에 대한 설명 중 올바른 것은?",
    "options": [
      "결과의 합집합으로 중복된 행을 모두 포함한다.",
      "결과의 합집합으로 중복된 행은 하나의 행으로 표시한다.",
      "결과의 교집합으로 중복된 행을 하나의 행으로 표시한다.",
      "결과의 교집합으로 중복된 행을 모두 포함한다."
    ],
    "correctIdx": 2,
    "explanation": "INTERSECT는 교집합을 반환하며, 중복된 결과는 제거되어 하나의 행으로만 표시됩니다."
  },
  {
    "qNum": 17,
    "text": "■ 문제 17. Window function 에 대한 설명 중 적절한 것은?",
    "options": [
      "Partition 과 Group By 구문은 의미적으로 완전히 다르다.",
      "Sum, Max, Min 등 집계 윈도우 함수 사용 시 Window 절과 함께 사용하면 집계 대상 레코드 범위를 지정할 수 있다.",
      "Window function 처리로 인해 결과 건수가 줄어들 수 있다.",
      "GROUP BY 구문과 Window function 은 병행하여 사용 할 수 있다."
    ],
    "correctIdx": 1,
    "explanation": "ROWS나 RANGE 등의 Window 절을 사용하면 누적합계나 이동평균 등 특정 윈도우 범위를 지정하여 연산할 수 있습니다. 윈도우 함수는 결과 건수에 영향을 주지 않습니다."
  },
  {
    "qNum": 18,
    "text": "■ 문제 18. DML, DCL, DDL 이 잘못 짝지워진 것은?",
    "options": [
      "DDL : CREATE",
      "DML : UPDATE",
      "DCL : ROLLBACK",
      "DCL : SELECT"
    ],
    "correctIdx": 3,
    "explanation": "SELECT는 DML(혹은 DQL)에 해당하며 권한을 제어하는 DCL이 아닙니다. (ROLLBACK은 TCL로 따로 분류하기도 합니다.)"
  },
  {
    "qNum": 19,
    "text": "■ 문제 19. 아래 설명에서 설명하는 스키마 구조로 가장 적절한 것은?<br><br>[설명]<br>모든 사용자 관점을 통합한 조직 전체 관점의 통합적 표현",
    "options": [
      "외부스키마",
      "개념스키마",
      "내부스키마",
      "논리스키마"
    ],
    "correctIdx": 1,
    "explanation": "조직 전체의 통합된 관점은 개념 스키마(Conceptual Schema)입니다."
  },
  {
    "qNum": 20,
    "text": "■ 문제 20. 다음 중 엔터티(Entity) 발생 시점에 따른 분류가 아닌 것은?",
    "options": [
      "기본엔터티 (Fundamental Entity)",
      "중심엔터티 (Main Entity)",
      "사건엔터티 (Event Entity)",
      "행위엔터티 (Active Entity)"
    ],
    "correctIdx": 2,
    "explanation": "발생 시점에 따른 분류는 기본(키), 중심, 행위 엔터티입니다. 사건 엔터티는 유형/무형에 따른 분류(개념, 사건, 유형)입니다."
  },
  {
    "qNum": 21,
    "text": "■ 문제 21. 다른 속성으로부터 계산이나 변형이 되어 생성되는 속성은 무엇인가?",
    "options": [
      "기본속성",
      "설계속성",
      "일반속성",
      "파생속성"
    ],
    "correctIdx": 3,
    "explanation": "총합, 평균 등 다른 속성들을 통해 동적으로 도출해낼 수 있는 속성을 파생속성이라고 합니다."
  },
  {
    "qNum": 22,
    "text": "■ 문제 22. 아래 SQL을 실행했을 때의 결과값은 무엇인가?<br><br><code>SELECT NVL(COUNT(*), 9999)<br>FROM TABLE<br>WHERE 1=2;</code>",
    "options": [
      "NULL",
      "1",
      "9999",
      "0"
    ],
    "correctIdx": 3,
    "explanation": "집계 함수 COUNT는 조건에 맞는 데이터가 한 건도 없을 경우 NULL이 아닌 0을 반환하므로 NVL 처리를 타지 않고 그대로 0을 반환합니다."
  },
  {
    "qNum": 23,
    "text": "■ 문제 23. 아래의 SQL의 실행 결과로 가장 적절한 것은?<br><br><code>SELECT Y.사원명, Y.연봉<br>  FROM (SELECT 부서ID, MAX(연봉) OVER(PARTITION BY 부서ID) AS 최고연봉 FROM 사원) X, 사원 Y<br> WHERE X.부서ID = Y.부서ID AND X.최고연봉 = Y.연봉;</code>",
    "options": [
      "가장 연봉이 높은 사원 1명의 정보만 출력된다.",
      "에러가 발생하여 출력되지 않는다.",
      "각 부서별로 가장 높은 연봉을 받는 사원들의 목록이 출력된다.",
      "부서별 평균 연봉보다 높은 사원들이 출력된다."
    ],
    "correctIdx": 2,
    "explanation": "인라인 뷰 X에서 부서별 최고 연봉을 구하고, 이를 본 테이블과 이너 조인하므로 부서별로 가장 연봉이 높은 사원이 여러 명 출력될 수 있습니다."
  },
  {
    "qNum": 24,
    "text": "■ 문제 24. 아래의 설명 중 반정규화 대상이 아닌 것은?",
    "options": [
      "자주 사용되는 테이블에 접근하는 프로세스의 수가 많고 항상 일정한 범위만을 조회하는 경우",
      "대량의 데이터 범위를 자주 처리하는 경우에 처리범위를 줄이지 않으면 성능을 보장할 수 없을 경우",
      "통계성 프로세스에 의해 통계 정보를 필요로 할 때 별도의 통계 테이블을 생성해야 하는 경우",
      "테이블에 지나치게 많은 조인과 Sorting, Order by 프로세스가 많은 경우"
    ],
    "correctIdx": 3,
    "explanation": "Sorting이나 Order by를 위한 프로세스 처리는 쿼리 튜닝이나 인덱스(Index) 설계로 해결할 문제이지, 데이터 모델 자체를 무너뜨리는 반정규화의 직접적인 대상이 아닙니다."
  },
  {
    "qNum": 25,
    "text": "■ 문제 25. 분산 데이터베이스의 특징 중 사용하려는 데이터의 저장 장소 명시가 불필요하다는 특징은 무엇인가?",
    "options": [
      "분할 투명성",
      "위치 투명성",
      "지역사상 투명성",
      "중복 투명성"
    ],
    "correctIdx": 1,
    "explanation": "물리적인 저장 위치를 몰라도 논리적인 테이블명만으로 데이터에 접근할 수 있게 해주는 것은 '위치 투명성'입니다."
  },
  {
    "qNum": 26,
    "text": "■ 문제 26. Row Migration과 Row Chaining 에 대한 설명 중 바른 것은?",
    "options": [
      "Row Chaining 과 Row Migration 이 많아지게 되더라도 성능 저하는 일어나지 않는다.",
      "로우 길이가 너무 길어서 여러 블록에 걸쳐 데이터가 저장되는 현상을 Row Chaining 이라고 한다.",
      "Row Migration 은 신규 데이터의 입력(INSERT)이 발생할 때 주로 발생되는 현상이다.",
      "디스크 I/O 가 많아지게 되어 성능이 향상될 수 있다."
    ],
    "correctIdx": 1,
    "explanation": "Row Chaining은 초기 INSERT 시점부터 로우 크기가 블록보다 커서 여러 블록에 나뉘어 저장되는 현상을 말하며, 이는 디스크 I/O를 증가시켜 성능 저하를 유발합니다."
  },
  {
    "qNum": 27,
    "text": "■ 문제 27. 아래의 트랜잭션 특성에 대한 설명을 올바르게 연결한 것은?<br>트랜잭션이 성공적으로 수행되면 그 트랜잭션이 갱신한 데이터베이스의 내용은 영구적으로 저장된다.",
    "options": [
      "일관성 (Consistency)",
      "원자성 (Atomicity)",
      "지속성 (Durability)",
      "고립성 (Isolation)"
    ],
    "correctIdx": 2,
    "explanation": "한 번 커밋(Commit)된 결과는 시스템 오류가 발생하더라도 데이터베이스에 영구적으로 반영되어야 한다는 특성은 '지속성(Durability)'입니다."
  },
  {
    "qNum": 28,
    "text": "■ 문제 28. SQL Set Operation 에서 중복 제거를 위해 정렬(Sort) 작업을 하지 않는 집합 연산자는?",
    "options": [
      "UNION",
      "UNION ALL",
      "INTERSECT",
      "MINUS"
    ],
    "correctIdx": 1,
    "explanation": "UNION ALL은 결과 집합을 단순히 위아래로 이어 붙이기만 하므로 중복 체크를 위한 내부 정렬 작업을 수행하지 않아 성능상 훨씬 유리합니다."
  },
  {
    "qNum": 29,
    "text": "■ 문제 29. 아래의 뷰(VIEW) 에 대한 설명 중 가장 올바르지 않은 것은?",
    "options": [
      "독립성: 테이블 구조가 변경되어도 뷰를 사용하는 응용 프로그램은 변경하지 않아도 된다.",
      "편리성: 복잡한 질의를 뷰로 생성함으로써 관련 질의를 단순하게 작성할 수 있다.",
      "물리성: 실제 데이터를 디스크에 가지고 있어서 물리적인 인덱스 관리가 가능하다.",
      "보안성: 숨기고 싶은 정보가 존재한다면 해당 칼럼을 빼고 생성하여 정보를 감출 수 있다."
    ],
    "correctIdx": 2,
    "explanation": "뷰(VIEW)는 쿼리 문장(SELECT)만을 저장하는 가상의 논리적 객체이므로 실제 데이터를 디스크에 저장하지 않습니다. (Materialized View는 예외)"
  },
  {
    "qNum": 30,
    "text": "■ 문제 30. 서브쿼리에 대한 설명 중 가장 올바르지 않은 것은?",
    "options": [
      "서브쿼리는 괄호로 감싸서 사용한다",
      "단일행 서브쿼리는 IN, ALL, ANY 등의 다중행 비교 연산자와 함께 사용할 수 없다.",
      "메인쿼리는 서브쿼리의 컬럼을 자유롭게 가져다 쓸 수 없다.",
      "서브쿼리는 SELECT 절, FROM 절, WHERE 절 등에서 모두 사용 가능하다"
    ],
    "correctIdx": 1,
    "explanation": "다중행 연산자(IN, ALL, ANY 등)의 우측에 단일행 서브쿼리를 사용하는 것은 문법적으로 오류가 아닙니다 (다만 논리적으로 비효율적일 뿐)."
  },
  {
    "qNum": 31,
    "text": "■ 문제 31. 다음 중 조인(JOIN) 기법에 대한 설명 중 가장 적절한 것은?",
    "options": [
      "Hash Join 은 정렬 작업이 없어 대량의 데이터 배치작업에 유리하다.",
      "대용량의 데이터를 가진 두 개 테이블을 조인할 때 Hash Join 보다 Nested Loop Join 이 더 유리하다.",
      "옵티마이저는 조인 컬럼에 인덱스가 존재하지 않으면 Nested Loop Join 을 우선적으로 선호한다.",
      "Nested Loop Join 기법은 대량 데이터의 배치작업에서 주로 선호하는 조인 기법이다."
    ],
    "correctIdx": 0,
    "explanation": "Hash Join은 Sort Merge Join이 가진 정렬(Sort)의 부담을 해결한 방식으로, 대량의 데이터를 동등(Equal) 조건으로 조인할 때 매우 뛰어난 성능을 보입니다."
  },
  {
    "qNum": 32,
    "text": "■ 문제 32. 프로그래밍에서 사용되는 중첩된 루프(FOR 문)와 가장 유사한 방식으로 조인을 수행하는 방식은?",
    "options": [
      "Nested Loop Join",
      "Sort Merge Join",
      "Hash Join",
      "Scalar SubQuery Join"
    ],
    "correctIdx": 0,
    "explanation": "Nested Loop Join은 바깥쪽(Driving) 테이블을 스캔하면서 추출된 각 행마다 안쪽(Inner) 테이블을 반복 스캔하며 조인하는 방식입니다."
  },
  {
    "qNum": 33,
    "text": "■ 문제 33. 아래의 조건일 때 사용되어야 하는 SQL Join Mechanism 으로 알맞은 것은?<br><br>조건 1: 두 테이블 간 동등(Equal) 조인을 수행한다.<br>조건 2: 두 테이블의 조인 컬럼에 모두 인덱스가 없다.<br>조건 3: 대량의 데이터 처리이며 정렬(Sort) 작업 부하를 피하고 싶다.",
    "options": [
      "Nested Loop Join",
      "Sort Merge Join",
      "Hash Join",
      "Cross Join"
    ],
    "correctIdx": 2,
    "explanation": "조인 컬럼에 인덱스가 없고 대량의 데이터를 처리할 때, 정렬 오버헤드 없이 한쪽 테이블을 해시 테이블로 만들어 조인하는 Hash Join이 최적의 선택입니다."
  },
  {
    "qNum": 34,
    "text": "■ 문제 34. 데이터 모델링에 대한 아래 설명 중 알맞은 것은?",
    "options": [
      "논리 모델링에서 도출된 외래키(FK)는 물리 모델에서 반드시 제약조건으로 생성되어야 한다.",
      "실제로 데이터베이스를 구축할 때 1:1로 참고되는 모델은 개념적 데이터 모델링이다.",
      "물리 모델링 -> 논리 모델링 -> 개념 모델링 단계로 갈수록 추상적이고 포괄적이 된다.",
      "데이터 모델링의 3가지 구성 요소는 Process, Attributes, Relationship 이다."
    ],
    "correctIdx": 2,
    "explanation": "모델링은 개념(추상적) -> 논리 -> 물리(구체적) 순서로 진행됩니다. 외래키 제약조건은 물리 모델에서 성능 등의 이유로 생략될 수 있습니다."
  },
  {
    "qNum": 35,
    "text": "■ 문제 35. 도메인의 특징에 대해서 설명한 것으로 알맞은 것은?",
    "options": [
      "테이블 간의 참조 무결성을 보장하는 규칙이다.",
      "엔터티 내에서 각 속성이 가질 수 있는 값의 범위, 데이터 타입, 크기 및 제약사항을 지정하는 것이다.",
      "데이터베이스의 물리적 파일 저장 위치를 결정하는 구조이다.",
      "엔터티 간의 관계(1:N, M:N)를 정의하는 논리적 선이다."
    ],
    "correctIdx": 1,
    "explanation": "도메인은 속성에 입력될 수 있는 값의 형식(타입, 길이)과 조건(Check 등)을 포괄하는 범위 단위입니다."
  },
  {
    "qNum": 36,
    "text": "■ 문제 36. 테이블 설계 시 데이터 무결성을 보장하기 위해 사용되는 제약조건(Constraint)이 아닌 것은?",
    "options": [
      "PRIMARY KEY",
      "FOREIGN KEY",
      "INDEX",
      "CHECK"
    ],
    "correctIdx": 2,
    "explanation": "INDEX는 검색 속도를 향상시키기 위한 물리적 구조물일 뿐, 데이터 무결성 자체를 강제하는 제약조건(Constraint)은 아닙니다. (Unique Index 제외)"
  },
  {
    "qNum": 37,
    "text": "■ 문제 37. SQL의 데이터 제어어(DCL) 명령어에 해당하는 것은?",
    "options": [
      "TRUNCATE",
      "UPDATE",
      "GRANT",
      "COMMIT"
    ],
    "correctIdx": 2,
    "explanation": "DCL(Data Control Language)은 사용자에게 권한을 부여(GRANT)하거나 회수(REVOKE)하는 명령어입니다."
  },
  {
    "qNum": 38,
    "text": "■ 문제 38. 다음과 같이 문자와 문자를 연결하는 함수에 대해서 작성하시오.<br><code>SELECT (____) (COL1, COL2) FROM EMP;</code>",
    "options": [
      "SUBSTR",
      "TRIM",
      "REPLACE",
      "CONCAT"
    ],
    "correctIdx": 3,
    "explanation": "CONCAT 함수(또는 || 연산자)는 두 문자열을 하나로 이어붙이는 역할을 수행합니다."
  },
  {
    "qNum": 39,
    "text": "■ 문제 39. 다중 행 비교 연산자 ANY (혹은 SOME) 에 대한 설명으로 올바른 것은?<br><code>WHERE SALARY > ANY (SELECT SALARY FROM ...)</code>",
    "options": [
      "서브쿼리의 결과 중 최대값보다 큰 경우에만 참이 된다.",
      "서브쿼리의 결과 중 어떤 값 하나라도 만족하면(최소값보다 크면) 참이 된다.",
      "서브쿼리의 모든 결과와 일치해야 참이 된다.",
      "서브쿼리의 결과가 존재하지 않을 때 참이 된다."
    ],
    "correctIdx": 1,
    "explanation": "> ANY는 서브쿼리의 결과 집합 중 '가장 작은 값'보다 크기만 하면 참이 되는 연산자입니다."
  },
  {
    "qNum": 40,
    "text": "■ 문제 40. 다중 행 비교 연산자 ALL 에 대한 설명으로 올바른 것은?<br><code>WHERE SALARY > ALL (SELECT SALARY FROM ...)</code>",
    "options": [
      "서브쿼리의 결과 중 최소값보다 큰 경우에 참이 된다.",
      "서브쿼리의 결과 중 최대값보다 큰 경우에 참이 된다.",
      "서브쿼리의 결과 집합 중 단 하나라도 일치하는 값이 있으면 참이 된다.",
      "서브쿼리의 모든 결과와 값이 똑같아야 참이 된다."
    ],
    "correctIdx": 1,
    "explanation": "> ALL은 서브쿼리가 반환하는 '모든' 값들보다 커야 하므로, 결과적으로 '최대값'보다 클 때 조건을 만족합니다."
  },
  {
    "qNum": 41,
    "text": "■ 문제 41. 다음 집계 함수 중 집합 내의 레코드 수(총 건수)를 계산할 때 NULL 값과 무관하게 전체 행의 수를 반환하는 것은?",
    "options": [
      "COUNT(컬럼명)",
      "COUNT(*)",
      "SUM(컬럼명)",
      "AVG(컬럼명)"
    ],
    "correctIdx": 1,
    "explanation": "COUNT(*)는 컬럼의 값(NULL 여부)과 관계없이 테이블의 전체 레코드 단위로 개수를 산출합니다."
  },
  {
    "qNum": 42,
    "text": "■ 문제 42. SELECT 문의 논리적 실행 순서를 올바르게 나열한 것은?",
    "options": [
      "FROM -> WHERE -> GROUP BY -> HAVING -> SELECT -> ORDER BY",
      "FROM -> WHERE -> GROUP BY -> HAVING -> ORDER BY -> SELECT",
      "SELECT -> FROM -> WHERE -> GROUP BY -> HAVING -> ORDER BY",
      "FROM -> GROUP BY -> HAVING -> WHERE -> SELECT -> ORDER BY"
    ],
    "correctIdx": 0,
    "explanation": "조회 대상을 가져오고(FROM) -> 필터링(WHERE) -> 그룹핑(GROUP BY) -> 그룹필터(HAVING) -> 컬럼추출(SELECT) -> 최종정렬(ORDER BY) 순입니다."
  },
  {
    "qNum": 43,
    "text": "■ 문제 43. 계층형 질의(Hierarchical Query)에서 루트(Root) 노드를 지정하기 위해 사용되는 키워드는?",
    "options": [
      "CONNECT BY",
      "ORDER SIBLINGS BY",
      "START WITH",
      "PRIOR"
    ],
    "correctIdx": 2,
    "explanation": "START WITH 절은 트리 탐색의 시작점이 되는 루트(Root) 데이터를 추출하는 조건을 지정합니다."
  },
  {
    "qNum": 44,
    "text": "■ 문제 44. 계층형 질의에서 부모 노드와 자식 노드 간의 관계(전개 방향)를 정의하는 키워드는?",
    "options": [
      "START WITH",
      "CONNECT BY PRIOR",
      "ORDER SIBLINGS BY",
      "LEVEL"
    ],
    "correctIdx": 1,
    "explanation": "CONNECT BY 절(보통 PRIOR 연산자와 함께 사용)은 자식 데이터를 어떻게 전개해 나갈지 부모-자식 조인 조건을 명시합니다."
  },
  {
    "qNum": 45,
    "text": "■ 문제 45. 테이블의 컬럼 이름이나 데이터 타입을 변경할 때 사용하는 DDL 명령어는?",
    "options": [
      "CREATE",
      "DROP",
      "ALTER",
      "TRUNCATE"
    ],
    "correctIdx": 2,
    "explanation": "이미 생성된 객체(테이블 등)의 구조를 수정할 때는 ALTER 명령어를 사용합니다. (예: ALTER TABLE EMP MODIFY ...)"
  },
  {
    "qNum": 46,
    "text": "■ 문제 46. 다음 중 트랜잭션의 커밋(COMMIT)과 롤백(ROLLBACK)에 대한 설명으로 틀린 것은?",
    "options": [
      "DML 작업은 COMMIT 되기 전까지는 디스크에 영구적으로 반영되지 않는다.",
      "COMMIT 이전에 다른 세션(사용자)은 내가 변경 중인 데이터를 미리 볼 수 없다.",
      "DDL 명령어는 오라클의 경우 실행 즉시 자동으로 COMMIT 처리된다.",
      "트랜잭션 도중 시스템 장애가 발생하면 부분적으로 완료된 데이터는 그대로 COMMIT 된다."
    ],
    "correctIdx": 3,
    "explanation": "트랜잭션 도중 장애가 발생하여 정상적으로 COMMIT 되지 않은 작업은 데이터 무결성을 위해 시스템에 의해 전체가 ROLLBACK(취소) 됩니다."
  },
  {
    "qNum": 47,
    "text": "■ 문제 47. 다음 중 문자열의 길이를 반환하는 함수는?",
    "options": [
      "SUBSTR",
      "LENGTH",
      "INSTR",
      "TRIM"
    ],
    "correctIdx": 1,
    "explanation": "LENGTH 함수는 파라미터로 입력된 문자열의 글자 수(길이)를 계산하여 반환합니다."
  },
  {
    "qNum": 48,
    "text": "■ 문제 48. 다음 중 Oracle에서 현재 시스템의 날짜와 시간을 반환하는 키워드는?",
    "options": [
      "GETDATE()",
      "NOW()",
      "CURRENT_DATE",
      "SYSDATE"
    ],
    "correctIdx": 3,
    "explanation": "Oracle에서는 SYSDATE를 사용하여 현재 서버의 날짜 및 시간을 조회합니다. (SQL Server는 GETDATE() 사용)"
  },
  {
    "qNum": 49,
    "text": "■ 문제 49. 조인 조건이 일치하는 데이터뿐만 아니라, 일치하지 않는 특정 테이블의 데이터까지 강제로 모두 출력하고 싶을 때 사용하는 조인 기법은?",
    "options": [
      "INNER JOIN",
      "OUTER JOIN",
      "CROSS JOIN",
      "NATURAL JOIN"
    ],
    "correctIdx": 1,
    "explanation": "OUTER JOIN(LEFT, RIGHT, FULL)은 조인 조건에 부합하지 않더라도 기준이 되는 한쪽 테이블의 레코드를 손실 없이 출력합니다."
  },
  {
    "qNum": 50,
    "text": "■ 문제 50. 다음 중 조건에 따라 서로 다른 값을 반환하기 위해 표준 SQL에서 사용하는 분기 처리 구문은?",
    "options": [
      "DECODE",
      "NVL",
      "CASE WHEN THEN END",
      "COALESCE"
    ],
    "correctIdx": 2,
    "explanation": "IF-THEN-ELSE 로직을 SQL 내에서 구현하는 ANSI 표준 문법은 CASE 표현식입니다. (DECODE는 Oracle 전용 함수입니다.)"
  }
]

import os

app_js_path = '/Users/kichan/tech_edu/PerformanceDiagnostics/app.js'

with open(app_js_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Generate the questions JSON array string
questions_json = json.dumps(questions, ensure_ascii=False, indent=6)

# We need to replace the questions array inside sqld_club
# sqld_club is defined as:
#   sqld_club: {
#     title: "SQLD 57회 실전 기출 모의고사",
#     desc: "SQLD 57회 기출문제를 바탕으로 구성된 실전 모의고사입니다. 데이터 모델링, SQL 기본 및 활용 영역의 핵심 기출 유형을 풀어보며 실전 감각을 끌어올려 보세요.",
#     limitSeconds: 600,
#     questions: [ ... ]
#   },

pattern = r'(sqld_club:\s*\{.*?questions:\s*)\[.*?\](\s*\}\s*,\s*week3:)'

# Read the new content
new_content = re.sub(pattern, r'\1' + questions_json.replace('\\', '\\\\') + r'\2', content, flags=re.DOTALL)

with open(app_js_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Updated app.js with 50 questions.")

