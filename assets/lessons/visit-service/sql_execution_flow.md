# 오라클 아키텍처 순서도 (SQL 실행 경로)

사용자가 실행한 SQL(SELECT, INSERT, UPDATE, DELETE)이 오라클 아키텍처 내부에서 어떤 흐름으로 처리되는지 시뮬레이션을 통해 직관적으로 확인할 수 있습니다. 

* **User Process** → **Listener** → **Server Process** → **PGA** → **SGA(Shared Pool, Buffer Cache)** 등 각 컴포넌트 간의 상호작용을 단계별로 시각화합니다.
* 아래 시뮬레이터에서 원하는 SQL 유형을 선택하고 재생 버튼을 눌러보세요!

<div style="width: 100%; height: 950px; margin-top: 20px; border-radius: 12px; overflow: hidden; border: 1px solid var(--border-light); box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
  <iframe src="oracle_19c_sql_execution_path.html" style="width: 100%; height: 100%; border: none; display: block; background: transparent;"></iframe>
</div>
