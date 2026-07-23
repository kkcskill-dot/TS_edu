#!/usr/bin/env python3
"""Deterministic Oracle 19c diagnostic snapshot generator (stdlib only)."""
from __future__ import annotations

import argparse
import csv
import hashlib
import math
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "generated"
START = datetime(2026, 7, 15, 9, 0)

PHASES = [
    ("B0", 30, dict(aas=2.1, cpu=1.3, host=28, runq=1.1, reads=1800, single=4, temp_lat=6,
                    pga=97, one=2, multi=0, temp=0.2, hit=98.7, logical=42000, hard=1.2,
                    soft=99.7, redo=3, commits=90, sync=2.1, parallel=1.6, rows=1900,
                    merge=12, literal=4, top_wait="db file sequential read")),
    ("T1", 5, dict(aas=5.2, cpu=3.4, host=58, runq=3.2, reads=4300, single=5, temp_lat=7,
                   pga=92, one=35, multi=1, temp=2.5, hit=97.2, logical=92000, hard=165,
                   soft=71, redo=9, commits=310, sync=3.1, parallel=2.0, rows=3600,
                   merge=34, literal=31, top_wait="library cache: mutex X")),
    ("T2", 8, dict(aas=11, cpu=6.7, host=92, runq=10.5, reads=9000, single=8, temp_lat=12,
                   pga=84, one=180, multi=8, temp=12, hit=95.4, logical=190000, hard=148,
                   soft=74, redo=20, commits=760, sync=6.2, parallel=3.4, rows=5200,
                   merge=45, literal=27, top_wait="library cache: mutex X")),
    ("T3", 12, dict(aas=16, cpu=6.2, host=89, runq=12.8, reads=24000, single=17, temp_lat=31,
                    pga=68, one=920, multi=95, temp=46, hit=91.5, logical=310000, hard=112,
                    soft=79, redo=37, commits=1450, sync=11, parallel=8.5, rows=5500,
                    merge=58, literal=16, top_wait="direct path read temp")),
    ("T4", 16, dict(aas=19, cpu=6.7, host=92, runq=15.2, reads=22000, single=16, temp_lat=28,
                    pga=70, one=870, multi=82, temp=43, hit=92.1, logical=295000, hard=105,
                    soft=81, redo=54, commits=2400, sync=18, parallel=13, rows=5100,
                    merge=58, literal=16, top_wait="log file sync")),
    ("R1", 10, dict(aas=7, cpu=4.2, host=61, runq=4.0, reads=7200, single=7, temp_lat=10,
                    pga=91, one=110, multi=2, temp=5.5, hit=97.1, logical=105000, hard=18,
                    soft=96, redo=31, commits=290, sync=5, parallel=3.1, rows=6800,
                    merge=43, literal=8, top_wait="db file sequential read")),
]

METRIC_FIELDS = [
    "sample_time","phase","instance_id","pdb_name","service_name","cpu_cores","aas","db_cpu_aas",
    "wait_aas","host_cpu_pct","os_run_queue","top_wait","physical_reads_blocks_s","single_block_ms",
    "temp_io_ms","pga_cache_hit_pct","workarea_onepass_s","workarea_multipass_s","temp_gb_h",
    "buffer_hit_pct","logical_reads_blocks_s","hard_parses_s","soft_parse_pct","redo_mb_s",
    "user_commits_s","log_file_sync_ms","log_file_parallel_write_ms","batch_rows_s",
    "merge_dbtime_pct","literal_group_dbtime_pct","other_dbtime_pct"
]

SQLS = {
    "merge": ("9u1m3rg3a0b1x", "918273645001", "SETTLEMENT_MERGE", "SETTLEMENT", "MERGE_BATCH", "4289017712"),
    "lit1": ("1it3ra1000001", "771122330099", "LITERAL_LOOKUP_T01", "SETTLEMENT", "LOOKUP_LITERAL", "1765432109"),
    "lit2": ("1it3ra1000002", "771122330099", "LITERAL_LOOKUP_T02", "SETTLEMENT", "LOOKUP_LITERAL", "1765432109"),
    "lit3": ("1it3ra1000003", "771122330099", "LITERAL_LOOKUP_T03", "SETTLEMENT", "LOOKUP_LITERAL", "1765432109"),
    "other": ("0th3rn015e001", "555000111222", "NORMAL_ORDER_API", "ORDER_API", "NORMAL_TX", "990011223"),
}


def q(v, digits=2):
    return round(v, digits)


def write_csv(path, fields, rows):
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader(); w.writerows(rows)


def metric_rows():
    rows, minute = [], 0
    for phase, length, base in PHASES:
        for i in range(length):
            # Small deterministic variation avoids an unrealistically flat snapshot while preserving phase means.
            wave = math.sin((i + 1) * 1.7) * 0.025
            def vary(key, floor=0): return max(floor, base[key] * (1 + wave))
            aas, cpu = vary("aas"), vary("cpu")
            merge, literal = base["merge"], base["literal"]
            rows.append(dict(
                sample_time=(START + timedelta(minutes=minute)).isoformat(timespec="minutes"), phase=phase,
                instance_id=1, pdb_name="PERFLAB", service_name="PERFLAB_SVC", cpu_cores=8,
                aas=q(aas), db_cpu_aas=q(cpu), wait_aas=q(aas-cpu), host_cpu_pct=q(vary("host"),1),
                os_run_queue=q(vary("runq"),1), top_wait=base["top_wait"],
                physical_reads_blocks_s=round(vary("reads")), single_block_ms=q(vary("single"),1),
                temp_io_ms=q(vary("temp_lat"),1), pga_cache_hit_pct=q(base["pga"]-(wave*20),1),
                workarea_onepass_s=round(vary("one")), workarea_multipass_s=round(vary("multi")),
                temp_gb_h=q(vary("temp"),1), buffer_hit_pct=q(base["hit"]-(wave*10),1),
                logical_reads_blocks_s=round(vary("logical")), hard_parses_s=q(vary("hard"),1),
                soft_parse_pct=q(base["soft"]-(wave*12),1), redo_mb_s=q(vary("redo"),1),
                user_commits_s=round(vary("commits")), log_file_sync_ms=q(vary("sync"),1),
                log_file_parallel_write_ms=q(vary("parallel"),1), batch_rows_s=round(vary("rows")),
                merge_dbtime_pct=merge, literal_group_dbtime_pct=literal, other_dbtime_pct=100-merge-literal
            )); minute += 1
    return rows


def ash_rows(metrics):
    rows = []
    for m in metrics:
        total = round(float(m["aas"]) * 60)
        cpu = round(float(m["db_cpu_aas"]) * 60)
        waits = total - cpu
        phase = m["phase"]
        shares = [("merge", int(m["merge_dbtime_pct"])), ("lit1", int(m["literal_group_dbtime_pct"])*34/100),
                  ("lit2", int(m["literal_group_dbtime_pct"])*33/100), ("lit3", int(m["literal_group_dbtime_pct"])*33/100)]
        assigned = 0
        for idx, (key, pct) in enumerate(shares):
            count = round(total*pct/100); assigned += count
            sql = SQLS[key]
            oncpu = min(count, round(cpu * count / max(total, 1)))
            wait = count-oncpu
            if key.startswith("lit"):
                event = "library cache: mutex X" if phase in {"T1","T2","T3","T4"} else "db file sequential read"
            elif phase == "T3": event = "direct path read temp"
            elif phase == "T4": event = "log file sync"
            else: event = "db file sequential read"
            if oncpu:
                rows.append(ash_record(m, sql, "ON CPU", "ON CPU", oncpu))
            if wait:
                rows.append(ash_record(m, sql, "WAITING", event, wait))
        count = max(0, total-assigned); sql = SQLS["other"]
        oncpu = min(count, max(0, cpu-sum(r["sample_count"] for r in rows if r["sample_time"]==m["sample_time"] and r["session_state"]=="ON CPU")))
        if oncpu: rows.append(ash_record(m, sql, "ON CPU", "ON CPU", oncpu))
        if count-oncpu: rows.append(ash_record(m, sql, "WAITING", "db file sequential read", count-oncpu))
    return rows


def ash_record(m, sql, state, event, count):
    return dict(sample_time=m["sample_time"], phase=m["phase"], instance_id=1, pdb_name="PERFLAB",
                service_name="PERFLAB_SVC", sql_id=sql[0], force_matching_signature=sql[1],
                sql_label=sql[2], module=sql[3], action=sql[4], plan_hash_value=sql[5],
                session_state=state, event=event, wait_class="CPU" if state=="ON CPU" else wait_class(event),
                sample_count=count)


def wait_class(event):
    if "log file" in event: return "Commit"
    if "library cache" in event: return "Concurrency"
    if "temp" in event: return "User I/O"
    return "User I/O"


def phase_rollups(metrics):
    grouped=defaultdict(list)
    for m in metrics: grouped[m["phase"]].append(m)
    top, events=[] , []
    for phase, ms in grouped.items():
        dbtime=sum(float(x["aas"])*60 for x in ms)
        cpu=sum(float(x["db_cpu_aas"])*60 for x in ms)
        merge=float(ms[0]["merge_dbtime_pct"]); literal=float(ms[0]["literal_group_dbtime_pct"])
        allocations=[("merge",merge), ("lit1",literal*.34), ("lit2",literal*.33), ("lit3",literal*.33), ("other",100-merge-literal)]
        for key,pct in allocations:
            s=SQLS[key]; factor=pct/100
            top.append(dict(phase=phase,sql_id=s[0],force_matching_signature=s[1],sql_label=s[2],module=s[3],
                action=s[4],plan_hash_value=s[5],db_time_s=q(dbtime*factor,1),db_time_pct=q(pct,1),
                cpu_time_s=q(cpu*factor,1),executions=round((180 if key=="merge" else 1800)*len(ms)*factor),
                parse_calls=round((1800 if key.startswith("lit") and phase!="B0" else 20)*len(ms)*factor),
                buffer_gets=round(sum(int(x["logical_reads_blocks_s"])*60 for x in ms)*factor),
                disk_reads=round(sum(int(x["physical_reads_blocks_s"])*60 for x in ms)*factor),
                rows_processed=round(sum(int(x["batch_rows_s"])*60 for x in ms)*factor),
                temp_mb=q(sum(float(x["temp_gb_h"])*1024 for x in ms)*factor/60,1)))
        waits=max(0,dbtime-cpu)
        if phase=="T3": ev=[("direct path read temp",.55),("direct path write temp",.20),("db file sequential read",.15),("Other",.10)]
        elif phase=="T4": ev=[("log file sync",.56),("direct path read temp",.22),("db file sequential read",.12),("Other",.10)]
        elif phase in {"T1","T2"}: ev=[("library cache: mutex X",.48),("db file sequential read",.27),("Other",.25)]
        else: ev=[("db file sequential read",.55),("log file sync",.15),("Other",.30)]
        events.append(dict(phase=phase,event="DB CPU",wait_class="CPU",time_s=q(cpu,1),aas=q(cpu/(len(ms)*60)),pct_db_time=q(cpu/dbtime*100,1),waits="",avg_wait_ms=""))
        for event,share in ev:
            t=waits*share; avg=next((float(x["log_file_sync_ms"]) for x in ms),4) if event=="log file sync" else (31 if "temp" in event else 8)
            events.append(dict(phase=phase,event=event,wait_class=wait_class(event),time_s=q(t,1),aas=q(t/(len(ms)*60)),pct_db_time=q(t/dbtime*100,1),waits=round(t*1000/avg),avg_wait_ms=q(avg,1)))
    return top,events


def sql_literal(v):
    if v is None or v == "": return "NULL"
    if isinstance(v, (int,float)): return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def write_load_sql(datasets):
    table_map={"metrics_1m":"lab_metrics_1m","ash_1m":"lab_ash_1m","top_sql_by_phase":"lab_top_sql","awr_top_events":"lab_awr_events"}
    lines=["SET DEFINE OFF", "WHENEVER SQLERROR EXIT SQL.SQLCODE", "BEGIN"]
    for name,(_,rows) in datasets.items():
        table=table_map[name]
        for row in rows:
            cols=", ".join(row.keys()); vals=", ".join(sql_literal(v) for v in row.values())
            lines.append(f"  INSERT INTO {table} ({cols}) VALUES ({vals});")
    lines += ["  COMMIT;", "END;", "/", "PROMPT Session 4 snapshot data loaded."]
    (OUT/"load_data.sql").write_text("\n".join(lines)+"\n",encoding="utf-8")


def validate(metrics, ash, top):
    assert len(metrics)==81 and metrics[0]["phase"]=="B0" and metrics[-1]["phase"]=="R1"
    for m in metrics:
        assert abs(float(m["aas"])-float(m["db_cpu_aas"])-float(m["wait_aas"])) <= .03
        assert int(m["merge_dbtime_pct"])+int(m["literal_group_dbtime_pct"])+int(m["other_dbtime_pct"])==100
    t4=[m for m in metrics if m["phase"]=="T4"]
    mean=lambda key: sum(float(m[key]) for m in t4)/len(t4)
    assert 18.5 < mean("aas") < 19.5 and 2300 < mean("user_commits_s") < 2500
    for m in metrics:
        got=sum(r["sample_count"] for r in ash if r["sample_time"]==m["sample_time"])
        assert got==round(float(m["aas"])*60)
    assert len({r["sql_id"] for r in top if r["force_matching_signature"]=="771122330099"})==3


def manifest():
    files=sorted(p for p in OUT.iterdir() if p.is_file() and p.name!="SHA256SUMS")
    text="".join(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n" for p in files)
    (OUT/"SHA256SUMS").write_text(text,encoding="utf-8")


def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--check",action="store_true"); args=ap.parse_args()
    OUT.mkdir(parents=True,exist_ok=True)
    metrics=metric_rows(); ash=ash_rows(metrics); top,events=phase_rollups(metrics)
    validate(metrics,ash,top)
    if args.check:
        print("OK: 81 minutes, AAS reconciliation, ASH counts, T4 targets, SQL family checked"); return
    datasets={
      "metrics_1m":(METRIC_FIELDS,metrics),
      "ash_1m":(["sample_time","phase","instance_id","pdb_name","service_name","sql_id","force_matching_signature","sql_label","module","action","plan_hash_value","session_state","event","wait_class","sample_count"],ash),
      "top_sql_by_phase":(list(top[0].keys()),top),
      "awr_top_events":(list(events[0].keys()),events),
    }
    for name,(fields,rows) in datasets.items(): write_csv(OUT/(name+".csv"),fields,rows)
    write_load_sql(datasets); manifest()
    print(f"Generated {sum(len(x[1]) for x in datasets.values())} rows in {OUT}")

if __name__=="__main__": main()
