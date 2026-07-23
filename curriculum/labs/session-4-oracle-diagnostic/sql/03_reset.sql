WHENEVER SQLERROR EXIT SQL.SQLCODE
TRUNCATE TABLE lab_ash_1m;
TRUNCATE TABLE lab_top_sql;
TRUNCATE TABLE lab_awr_events;
TRUNCATE TABLE lab_metrics_1m;
TRUNCATE TABLE lab_run_control;
PROMPT Reset complete. Re-run generated/load_data.sql.
