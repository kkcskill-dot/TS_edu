# 3장: 성능 모니터링과 장애 분석 (PI 활용)

오라클 환경에서는 성능 문제를 진단하기 위해 AWR(Automatic Workload Repository) 보고서를 추출하거나, 실시간 세션 대기 이벤트를 파악하기 위해 ASH(Active Session History)를 조회하는 것이 일상적인 업무입니다.

Amazon Aurora 환경에서는 AWS가 제공하는 **Performance Insights (PI)** 도구가 AWR과 ASH의 역할을 대체하며, 더 직관적인 시각적 분석 환경을 제공합니다.

## 1. Performance Insights (PI) 개요

PI는 데이터베이스의 성능 부하를 데이터베이스 부하(AAS: Average Active Sessions)라는 지표를 기준으로 측정하고 시각화하는 도구입니다.

- **AAS (Average Active Sessions)**: 오라클 ASH에서도 사용하는 개념으로, 특정 시간 동안 동시에 실행 중이거나 대기 중인 활성 세션의 평균 수치입니다.
- **Max vCPU Line**: PI 대시보드에는 vCPU 개수를 나타내는 점선이 있습니다. AAS 그래프가 이 선을 지속적으로 넘는다면, CPU 병목이 발생하고 있음을 직관적으로 알 수 있습니다.

## 2. 오라클 대기 이벤트 vs Aurora (MySQL) 대기 이벤트

성능 병목을 파악할 때 대기 이벤트(Wait Event)의 이름과 의미가 오라클과는 다릅니다.

| 현상 / 병목 | 오라클 (Oracle) 이벤트 | Aurora MySQL 이벤트 |
| :--- | :--- | :--- |
| **CPU 부족 / 쿼리 연산 중** | `ON CPU` | `CPU` |
| **데이터 블록 I/O 대기** | `db file sequential read`<br>`db file scattered read` | `io/aurora_respond_to_client`<br>`io/table/sql/handler` |
| **로그 쓰기 대기 (커밋 시)** | `log file sync` | `wait/io/aurora_redo_log_flush` |
| **행 수준 잠금 (Row Lock)** | `enq: TX - row lock contention` | `wait/synch/cond/innodb/row_lock_wait` |
| **버퍼 캐시 경합** | `buffer busy waits`<br>`latch: cache buffers chains` | `wait/synch/rwlock/innodb/dict_operation_lock` |

## 3. PI를 활용한 병목 분석 워크플로우

성능 지연 이슈가 접수되었을 때 DBA는 다음과 같은 흐름으로 PI를 분석합니다.

1. **부하 지표 확인**: AAS 차트가 vCPU 라인을 초과하는 스파이크 구간을 드래그하여 확대합니다.
2. **Slice by (분류 기준) 설정**: 병목의 성격을 파악하기 위해 차트를 '대기 이벤트(Waits)'별로 분류합니다. (예: Row Lock 비율이 높은지, CPU 사용량이 높은지)
3. **Top SQL 식별**: 해당 시간대 하단 테이블에서 부하를 가장 많이 유발한 쿼리 목록을 확인합니다.
4. **실행 계획 확인**: 문제가 되는 SQL의 실행 계획(EXPLAIN)을 확인하고, 오라클의 `DBMS_XPLAN` 대신 MySQL의 `EXPLAIN FORMAT=TREE` 또는 `EXPLAIN ANALYZE`를 통해 테이블 풀 스캔(Table Full Scan) 여부를 점검합니다.

> [!TIP]
> **CloudWatch와의 연계**
> PI는 SQL 수준의 상세 성능 분석에 유리하며, CloudWatch는 인스턴스 전반의 시스템 지표(CPU 사용률, 메모리, 스토리지 용량, 네트워크 트래픽 등)의 임계치 알람(Alarm)을 설정하는 데 사용됩니다. 두 도구를 상호 보완적으로 활용해야 합니다.

## 4. 백업과 복원 패러다임

- **자동 백업 (Automated Backups)**: Aurora는 스토리지 노드에서 S3로 지속적이고 비동기적인 스트리밍 백업을 수행합니다. 따라서 DB 인스턴스의 성능에 전혀 영향을 주지 않습니다.
- **특정 시점 복원 (PITR)**: 백업 보존 기간(최대 35일) 내의 원하는 초(Second) 단위 시점으로 새로운 DB 클러스터를 복원할 수 있습니다.
- **백트랙 (Backtrack)**: 복원 작업 없이, 실수로 DROP TABLE이나 잘못된 UPDATE를 수행하기 이전 시점으로 클러스터 자체를 신속하게 되돌리는(Rewind) Aurora만의 고유 기능입니다.

---

> 🎉 **수고하셨습니다!**
> 이로써 오라클 DBA를 위한 클라우드 DB(Aurora MySQL) 전환 기초 과정을 마쳤습니다. 아키텍처의 패러다임 변화를 이해하고 클라우드 네이티브 환경의 장점을 적극 활용해 보시기 바랍니다.
