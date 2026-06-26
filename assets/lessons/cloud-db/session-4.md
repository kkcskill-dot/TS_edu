# 4장: Oracle vs MySQL 운영 및 관리 차이점

오라클(Oracle)에 익숙한 DBA가 MySQL(및 Aurora MySQL) 환경을 운영할 때 겪게 되는 가장 큰 진입 장벽은 구조와 동작 방식의 근본적인 차이입니다. 성공적인 운영을 위해 반드시 알아야 할 주요 차이점들을 정리했습니다.

## 1. 아키텍처 및 계층 구조의 차이

오라클은 하나의 인스턴스에 하나의 데이터베이스가 매핑되는 구조(물론 멀티테넌트 제외)인 반면, MySQL은 하나의 인스턴스 내에 여러 개의 데이터베이스(스키마)가 존재합니다.

- **Oracle**: `Instance` -> `Database` -> `Schema` (유저와 1:1 매핑) -> `Tables`
- **MySQL**: `Instance` -> `Database (Schema와 동의어)` -> `Tables`

MySQL에서는 사용자(User)와 스키마(Schema)가 분리되어 있습니다. 특정 사용자가 여러 데이터베이스에 대한 권한을 가질 수 있으며, `USE db_name;` 명령으로 컨텍스트를 전환합니다.

## 2. 트랜잭션 및 동시성 제어 (MVCC)

두 시스템 모두 MVCC(Multi-Version Concurrency Control)를 사용하지만, 구현 방식에 큰 차이가 있습니다.

### Oracle의 Undo
- 오라클은 트랜잭션의 이전 이미지를 **Undo Segment**에 저장합니다.
- 긴 트랜잭션이나 무거운 쿼리가 실행 중일 때 Undo 공간이 덮어써지면 `ORA-01555: snapshot too old` 에러가 발생합니다.

### MySQL (InnoDB)의 Undo Log
- MySQL은 이전 버전을 **Undo Log** 영역에 저장하며, 레코드의 포인터를 통해 체인(History List) 형태로 추적합니다.
- MySQL에서는 `snapshot too old` 에러가 발생하지 않지만, 긴 트랜잭션(Long-running Transaction)이 커밋되지 않고 남아있으면 **Undo Log 영역이 무한정 커지고(History List Length 증가) 전체 데이터베이스 성능이 심각하게 저하**될 수 있습니다.

> [!WARNING]
> MySQL 환경에서는 장기 실행 트랜잭션 관리가 매우 중요합니다. 세션이 `BEGIN` 상태로 유휴(Idle) 상태에 빠지지 않도록 애플리케이션의 타임아웃 설정을 꼼꼼히 관리해야 합니다.

## 3. 인덱스 구조의 차이점

인덱스의 물리적 구조 차이는 쿼리 튜닝 방식에 직접적인 영향을 미칩니다.

### Oracle (Heap Table + B-Tree)
- 테이블 데이터는 무작위(Heap)로 저장되며, 인덱스는 데이터 블록의 물리적 주소(ROWID)를 가집니다.
- 프라이머리 키(PK) 인덱스와 일반 세컨더리(Secondary) 인덱스의 구조적 차이가 크지 않습니다.

### MySQL (Clustered Index + B-Tree)
- InnoDB 엔진의 테이블은 항상 **Clustered Index (PK 구조)** 형태로 저장됩니다. 즉, PK 인덱스의 리프 노드에 실제 데이터가 모두 들어 있습니다.
- PK가 아닌 보조 인덱스(Secondary Index)는 리프 노드에 물리적 주소 대신 **PK 값**을 가집니다.
- 따라서 보조 인덱스를 통해 데이터를 조회하면, 보조 인덱스 탐색 후 다시 PK 인덱스를 탐색하는 **두 번의 B-Tree 탐색(Index Look-up)**이 발생합니다.

> [!TIP]
> MySQL에서는 PK의 설계가 성능에 치명적인 영향을 미칩니다. 가급적 짧고 순차적으로 증가하는 값(Auto Increment)을 PK로 사용하는 것이 인덱스 파편화와 보조 인덱스 크기 증가를 막는 핵심 운영 원칙입니다.

## 4. 백업과 복구 방식

- **Oracle**: RMAN(Recovery Manager)을 통해 블록 단위의 증분 백업, 아카이브 로그 관리, 데이터 파일 복구 등을 정교하게 수행합니다.
- **MySQL**: 
  - 물리적 백업: `Percona XtraBackup`이나 `MySQL Enterprise Backup` 등을 사용해 데이터 디렉토리를 통째로 복사합니다.
  - 논리적 백업: `mysqldump`, `mydumper` 등을 통해 SQL 텍스트 형태로 덤프합니다. 
- **Aurora MySQL**: 백업과 복구가 스토리지 레이어에서 자동으로 이루어지므로, DBA가 별도의 백업 스크립트를 작성하거나 관리할 필요가 없습니다.

---

> 다음 장(5장)에서는 AWS 클라우드 환경의 네트워크, 보안, 그리고 데이터베이스 고가용성을 구성하는 핵심 인프라 개념에 대해 학습합니다.
