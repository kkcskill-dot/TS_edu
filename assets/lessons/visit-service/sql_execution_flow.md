# 오라클 아키텍처 순서도 (SQL 실행 경로)

데이터베이스에서 **SELECT, INSERT, UPDATE, DELETE** 문이 실행될 때 오라클 아키텍처의 각 컴포넌트(User Process, Server Process, SGA, 백그라운드 프로세스 등)를 거치는 전체적인 흐름을 한눈에 파악할 수 있는 순서도입니다.

---

## 1. SELECT 실행 흐름
데이터를 조회할 때는 파싱 후 버퍼 캐시에서 데이터를 찾으며, 미적재 시 디스크에서 읽어옵니다. 단, 조회 시점에 다른 세션이 데이터를 변경 중이거나 변경한 내역이 있다면, **읽기 일관성(Read Consistency)**을 보장하기 위해 **Undo 영역**의 과거 데이터를 참조(CR Read)하여 데이터를 읽습니다.

```mermaid
flowchart TD
    %% 노드 정의
    UP([User Process])
    L[Listener]
    SP([Server Process])
    PGA[PGA]
    SPool[(Shared Pool)]
    BC[(Buffer Cache)]
    Undo[(Undo Block)]
    DF[(Data File)]

    %% 흐름 연결
    UP -->|1. 접속 및 SQL 요청| L
    L -->|2. 세션 할당| SP
    UP -.->|3. 직접 통신| SP
    
    SP -->|4. 구문/의미 분석| PGA
    SP -->|5. Soft / Hard Parse| SPool
    SP -->|6. 데이터 블록 탐색| BC
    BC -->|7. Miss 시 Physical Read| DF
    DF -->|8. 블록 적재| BC
    BC -->|9. 변경 발견 시 CR 카피 생성| Undo
    Undo -.->|10. 읽기 일관성 확보| SP
    BC -->|11. Logical Read| SP
    SP -->|12. Fetch 및 결과 반환| UP

    %% 스타일 설정
    classDef process fill:#f8fafc,stroke:#0ea5e9,stroke-width:2px,color:#0f172a;
    classDef mem fill:#f0fdf4,stroke:#10b981,stroke-width:2px,color:#0f172a;
    classDef disk fill:#fef2f2,stroke:#ef4444,stroke-width:2px,color:#0f172a;
    class UP,SP,L process;
    class PGA,SPool,BC,Undo mem;
    class DF disk;
```

---

## 2. INSERT 실행 흐름
새로운 데이터를 삽입할 때는 빈 블록을 찾고, 롤백에 대비하여 **Undo 영역**에 삽입된 행의 식별자(RowID)를 저장합니다. 이후 트랜잭션 복구를 위한 Redo 데이터를 생성(Undo+Data)한 뒤 실제 데이터 블록을 수정(Dirty)합니다.

```mermaid
flowchart TD
    UP([User Process])
    SP([Server Process])
    SPool[(Shared Pool)]
    BC[(Buffer Cache)]
    Undo[(Undo Block)]
    Redo[(Redo Log Buffer)]
    LGWR[LGWR Process]
    RLF[(Redo Log File)]
    DBWn[DBWn Process]
    DF[(Data File)]

    UP -->|"1. INSERT 요청"| SP
    SP -->|"2. 파싱"| SPool
    SP -->|"3. 여유 블록 확보<br/>6. 블록 수정 - Dirty"| BC
    SP -->|"4. 롤백용 RowID 저장"| Undo
    SP -->|"5. Redo 데이터 생성 - Data, Undo"| Redo
    UP -->|"7. COMMIT"| SP
    SP -->|8. 기록 요청| LGWR
    LGWR -->|9. 동기식 기록| RLF
    BC -.->|10. 백그라운드 기록 - Checkpoint| DBWn
    DBWn -.->|11. 물리적 저장| DF

    classDef process fill:#f8fafc,stroke:#0ea5e9,stroke-width:2px,color:#0f172a;
    classDef mem fill:#f0fdf4,stroke:#10b981,stroke-width:2px,color:#0f172a;
    classDef disk fill:#fef2f2,stroke:#ef4444,stroke-width:2px,color:#0f172a;
    class UP,SP,LGWR,DBWn process;
    class SPool,BC,Undo,Redo mem;
    class RLF,DF disk;
```

---

## 3. UPDATE 실행 흐름
데이터를 수정할 때는 **읽기 일관성**과 **롤백**을 위해 변경 전 데이터를 Undo에 먼저 저장한 후, 원본 블록을 수정합니다. Redo에는 Undo 변경 내역과 원본 블록 변경 내역이 모두 기록됩니다.

```mermaid
flowchart TD
    UP([User Process])
    SP([Server Process])
    BC[(Buffer Cache)]
    Undo[(Undo Block)]
    Redo[(Redo Log Buffer)]
    DF[(Data, Undo File)]

    UP -->|"1. UPDATE 요청"| SP
    SP -->|"2. 대상 블록 찾기<br/>6. 블록 수정 - Dirty"| BC
    BC -->|"3. Physical Read - 필요시"| DF
    SP -->|"4. 변경 전 데이터 저장"| Undo
    SP -->|"5. Redo 데이터 생성 - Data, Undo"| Redo
    UP -->|"7. COMMIT"| SP

    classDef process fill:#f8fafc,stroke:#0ea5e9,stroke-width:2px,color:#0f172a;
    classDef mem fill:#f0fdf4,stroke:#10b981,stroke-width:2px,color:#0f172a;
    classDef disk fill:#fef2f2,stroke:#ef4444,stroke-width:2px,color:#0f172a;
    class UP,SP process;
    class BC,Undo,Redo mem;
    class DF disk;
```

---

## 4. DELETE 실행 흐름
UPDATE와 유사하게 흐름이 진행됩니다. 차이점은 데이터 자체를 지우는 것이 아니라 **로우 단위 삭제 마킹**을 수행하며, 롤백을 위해 지워진 전체 로우 데이터가 Undo에 저장된다는 점입니다.

```mermaid
flowchart TD
    UP([User Process])
    SP([Server Process])
    BC[(Buffer Cache)]
    Undo[(Undo Block)]
    Redo[(Redo Log Buffer)]
    LGWR[LGWR Process]
    RLF[(Redo Log File)]

    UP -->|"1. DELETE 요청"| SP
    SP -->|"2. 삭제 대상 식별<br/>5. 행 삭제 마킹 - Dirty"| BC
    SP -->|"3. 삭제할 로우 전체 저장"| Undo
    SP -->|"4. Redo 데이터 생성"| Redo
    UP -->|"6. COMMIT"| SP
    SP -->|7. 동기화 요청| LGWR
    LGWR -->|8. 디스크 기록| RLF

    classDef process fill:#f8fafc,stroke:#0ea5e9,stroke-width:2px,color:#0f172a;
    classDef mem fill:#f0fdf4,stroke:#10b981,stroke-width:2px,color:#0f172a;
    classDef disk fill:#fef2f2,stroke:#ef4444,stroke-width:2px,color:#0f172a;
    class UP,SP,LGWR process;
    class BC,Undo,Redo mem;
    class RLF disk;
```
