SET LINESIZE 220 PAGESIZE 100
COLUMN top_wait FORMAT A28
COLUMN event FORMAT A28
COLUMN sql_label FORMAT A24
COLUMN module FORMAT A14

PROMPT === Observe: normal / overload / recovery phase means ===
SELECT phase, ROUND(AVG(aas),1) aas, ROUND(AVG(db_cpu_aas),1) cpu_aas,
 ROUND(AVG(wait_aas),1) wait_aas, ROUND(AVG(host_cpu_pct),0) host_cpu_pct,
 ROUND(AVG(hard_parses_s),1) hard_parse_s, ROUND(AVG(physical_reads_blocks_s)) reads_s,
 ROUND(AVG(temp_gb_h),1) temp_gb_h, ROUND(AVG(user_commits_s)) commits_s,
 ROUND(AVG(log_file_sync_ms),1) sync_ms
FROM lab_metrics_1m GROUP BY phase ORDER BY DECODE(phase,'B0',1,'T1',2,'T2',3,'T3',4,'T4',5,'R1',6);

PROMPT === Narrow: AWR-like top events ===
SELECT phase,event,ROUND(aas,2) aas,pct_db_time,waits,avg_wait_ms
FROM lab_awr_events ORDER BY DECODE(phase,'B0',1,'T1',2,'T2',3,'T3',4,'T4',5,'R1',6), time_s DESC;

PROMPT === Narrow: SQL_ID fragmentation vs force-matched family ===
SELECT phase, force_matching_signature, COUNT(DISTINCT sql_id) sql_ids,
 ROUND(SUM(db_time_s),1) db_time_s, ROUND(SUM(db_time_pct),1) db_time_pct,
 SUM(parse_calls) parse_calls, SUM(disk_reads) disk_reads
FROM lab_top_sql
GROUP BY phase, force_matching_signature
ORDER BY DECODE(phase,'B0',1,'T1',2,'T2',3,'T3',4,'T4',5,'R1',6), db_time_s DESC;

PROMPT === ASH-like responsibility attribution in overload ===
SELECT module, action, session_state, event, SUM(sample_count) samples
FROM lab_ash_1m WHERE phase IN ('T1','T2','T3','T4')
GROUP BY module,action,session_state,event ORDER BY samples DESC;

PROMPT === Reconciliation checks (all rows should be OK) ===
SELECT sample_time, CASE WHEN ABS(aas-db_cpu_aas-wait_aas)<=0.03 THEN 'OK' ELSE 'FAIL' END aas_check,
 CASE WHEN merge_dbtime_pct+literal_group_dbtime_pct+other_dbtime_pct=100 THEN 'OK' ELSE 'FAIL' END pct_check
FROM lab_metrics_1m WHERE ABS(aas-db_cpu_aas-wait_aas)>0.03
 OR merge_dbtime_pct+literal_group_dbtime_pct+other_dbtime_pct<>100;
