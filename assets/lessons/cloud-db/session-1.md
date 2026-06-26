# 1장: 오라클 vs Aurora MySQL 아키텍처 비교

온프레미스 환경에서 오라클(Oracle)을 주로 운영하던 DBA가 클라우드 환경의 **Amazon Aurora MySQL**로 전환할 때 가장 먼저 이해해야 할 것은 **아키텍처의 차이**입니다.

## 1. 아키텍처 패러다임의 변화

오라클의 전통적인 Shared-Nothing 또는 Shared-Disk(RAC) 아키텍처와 달리, Aurora는 **스토리지와 컴퓨팅을 완전히 분리**한 클라우드 네이티브 아키텍처를 채택하고 있습니다.

### 컴퓨팅 노드 (DB 인스턴스)
- SQL 파싱, 트랜잭션 처리, 캐싱(Buffer Pool) 등을 전담합니다.
- 오라클의 인스턴스(SGA/PGA + 백그라운드 프로세스)와 유사한 역할을 하지만, 데이터 파일 쓰기를 직접 하지 않습니다.

### 스토리지 노드 (클러스터 볼륨)
- 여러 가용 영역(AZ, Availability Zone)에 분산된 6개의 데이터 복제본을 유지합니다.
- 데이터 블록 쓰기, 백업, 복구 작업을 스토리지 계층으로 오프로드(Offload)하여 컴퓨팅 노드의 부하를 크게 줄입니다.

## 2. 주요 개념 매핑 가이드

오라클 DBA가 익숙한 개념을 Aurora MySQL과 매칭해보면 다음과 같습니다.

| 온프레미스 오라클 (Oracle) | Amazon Aurora MySQL | 차이점 및 특징 |
| :--- | :--- | :--- |
| **SGA (Buffer Cache)** | **InnoDB Buffer Pool** | Aurora는 버퍼 풀이 재시작 시에도 유지되는 기능(Survivable Buffer Cache)을 지원합니다. |
| **Redo Log** | **Redo Log (스토리지 레벨)** | Aurora는 컴퓨팅 노드에서 스토리지 노드로 Redo Log 레코드만 전송하며, 데이터 블록 쓰기(Data Page Write)를 하지 않아 I/O 병목이 획기적으로 줄어듭니다. |
| **Datafile (.dbf)** | **Cluster Volume** | 최소 10GB에서 최대 128TB까지 자동 확장되는 단일 가상 볼륨입니다. DBA가 테이블스페이스 용량을 관리할 필요가 없습니다. |
| **Data Guard / RAC** | **Aurora Replicas** | 읽기 분산 및 고가용성(HA)을 제공합니다. 마스터 노드 장애 시 수십 초 내에 Replica가 마스터로 승격(Failover)됩니다. |
| **AWR / ASH** | **Performance Insights** | 클라우드 환경에서 SQL 성능과 대기 이벤트(Wait Events)를 시각적으로 분석하는 도구입니다. |

> [!TIP]
> **핵심 차이점 요약**
> 오라클에서는 I/O 튜닝이 매우 중요한 역할이었습니다. 하지만 Aurora에서는 로그 쓰기만으로 I/O를 최적화하므로, DBA의 역할이 **물리적 I/O 관리**에서 **논리적 쿼리 튜닝과 인덱스 최적화, 아키텍처 설계**로 이동하게 됩니다.

## 3. 마이그레이션 전략 (SCT & DMS)

오라클에서 Aurora MySQL로의 이기종(Heterogeneous) 마이그레이션은 보통 다음 도구를 활용합니다.

1. **AWS SCT (Schema Conversion Tool)**
   - 오라클의 테이블, 인덱스, 뷰는 물론 PL/SQL(프로시저, 함수) 코드를 MySQL 문법으로 자동 변환해 줍니다.
   - 변환 불가능한 코드는 수동 조치 리포트를 제공합니다.

2. **AWS DMS (Database Migration Service)**
   - 초기 데이터(Full Load)를 적재하고, 오라클의 로그(Redo/Archive)를 캡처하여 변경분(CDC)을 지속적으로 복제합니다.
   - 최소한의 다운타임으로 이관을 가능하게 합니다.

---

> 다음 장(2장)에서는 Aurora의 핵심 기술인 **스토리지와 컴퓨팅 분리 메커니즘**과 오라클의 Redo/Undo 동작 방식과의 차이점을 심도 있게 다룹니다.
