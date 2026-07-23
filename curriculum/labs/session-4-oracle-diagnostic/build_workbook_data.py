#!/usr/bin/env python3
"""4회차 통합 진단 워크북 데이터 빌더.

generated/ 및 evidence/ 의 CSV(단일 원천, SoT)를 읽어 브라우저 워크북이
file:// 환경에서도 바로 로드할 수 있는 workbook-data.js 를 만든다.

- 원본 데이터 팩은 단일 인스턴스(instance_id=1)이다. 4회차 "노드별 비교" 학습을
  위해 결정론적 변형으로 2번 노드(RAC 2-node 가정)를 파생 생성한다.
  이는 합성 학습 자료이며, 노드 편중(스큐)이 있는 RAC 상황을 표현한다.
- 채점 정답키(answer key)는 시나리오 설계 문서의 결론을 코드화한 것이다.

실행: python3 build_workbook_data.py
"""
import csv
import json
import os

BASE = os.path.dirname(os.path.abspath(__file__))
GEN = os.path.join(BASE, "generated")
EVID = os.path.join(BASE, "evidence")
OUT = os.path.join(BASE, "workbook-data.js")
# 사이트 내 신규 패널(종합진단 리포트 실습)용 경량 요약 데이터.
# workbook-data.js(≈856KB, 162행)를 phase×node 평균으로 접어 수 KB로 만든다.
SITE_OUT = os.path.abspath(
    os.path.join(BASE, "..", "..", "..", "assets", "js", "courses", "perf-s4-summary.js")
)

# 패널 10대 지표 비교표에 쓰이는 metrics 컬럼(평균 대상). 회장님 보고서 10대 지표 매핑.
SUMMARY_METRIC_COLS = (
    "aas", "db_cpu_aas", "wait_aas", "host_cpu_pct", "os_run_queue",
    "buffer_hit_pct", "logical_reads_blocks_s", "physical_reads_blocks_s",
    "single_block_ms", "temp_io_ms",
    "pga_cache_hit_pct", "workarea_onepass_s", "workarea_multipass_s", "temp_gb_h",
    "hard_parses_s", "soft_parse_pct",
    "redo_mb_s", "user_commits_s", "log_file_sync_ms", "log_file_parallel_write_ms",
    "merge_dbtime_pct", "literal_group_dbtime_pct", "other_dbtime_pct",
)

NUMERIC_HINT = (
    "instance_id",
    "cpu_cores", "aas", "db_cpu_aas", "wait_aas", "host_cpu_pct", "os_run_queue",
    "physical_reads_blocks_s", "single_block_ms", "temp_io_ms", "pga_cache_hit_pct",
    "workarea_onepass_s", "workarea_multipass_s", "temp_gb_h", "buffer_hit_pct",
    "logical_reads_blocks_s", "hard_parses_s", "soft_parse_pct", "redo_mb_s",
    "user_commits_s", "log_file_sync_ms", "log_file_parallel_write_ms", "batch_rows_s",
    "merge_dbtime_pct", "literal_group_dbtime_pct", "other_dbtime_pct",
    "db_time_s", "db_time_pct", "cpu_time_s", "executions", "parse_calls",
    "buffer_gets", "disk_reads", "rows_processed", "temp_mb", "sample_count",
    "time_s", "pct_db_time", "waits", "avg_wait_ms",
    "run_queue", "storage_single_ms", "storage_temp_ms", "batch_concurrency", "commit_batch",
)


def to_num(k, v):
    if v is None or v == "":
        return None
    if k in NUMERIC_HINT:
        try:
            f = float(v)
            return int(f) if f.is_integer() else round(f, 4)
        except ValueError:
            return v
    return v


def read_csv(path):
    with open(path, newline="", encoding="utf-8") as fh:
        return [
            {k: to_num(k, v) for k, v in row.items()}
            for row in csv.DictReader(fh)
        ]


def derive_node2(metrics_rows):
    """node1 기준으로 결정론적 node2(RAC 2번 노드)를 파생한다.

    설계 의도: 정산 배치(리터럴 SQL·MERGE·commit)가 서비스 라우팅상 1번 노드에
    쏠려 있다. 따라서 node2 는 대체로 정상 기준선 근처로 유지되지만,
    log file sync 는 RAC 상호 gc/commit 전파로 T4 구간에 함께 상승한다.
    이렇게 하면 "노드별 편중" 판단 포인트가 생긴다.
    """
    node2 = []
    for r in metrics_rows:
        n = dict(r)
        n["instance_id"] = 2
        phase = r["phase"]
        # node2 부하 배율: 정상 근처 유지, 부하 구간에서도 완만
        load = {"B0": 1.0, "T1": 1.05, "T2": 1.1, "T3": 1.12, "T4": 1.15, "R1": 1.05}.get(phase, 1.0)

        def scale(key, factor):
            if r.get(key) is not None:
                v = r[key] * factor
                n[key] = int(v) if float(v).is_integer() else round(v, 4)

        # 활동/자원: node2 는 기준선 대비 소폭만 증가
        for key in ("aas", "db_cpu_aas", "wait_aas", "logical_reads_blocks_s",
                    "physical_reads_blocks_s", "redo_mb_s", "user_commits_s",
                    "batch_rows_s"):
            base = {"B0": r.get(key)}.get("B0")
        # node2 = 정상 기준선 값 + 완만한 부하 반영(전 구간 B0값에 load 배율)
        b0 = metrics_rows[0]  # 09:00 B0 (node1)
        for key in ("aas", "db_cpu_aas", "wait_aas"):
            if b0.get(key) is not None:
                v = b0[key] * load
                n[key] = round(v, 3)
        for key in ("host_cpu_pct",):
            n[key] = round(min(b0[key] * load, 65), 1)
        for key in ("os_run_queue",):
            n[key] = round(b0[key] * load, 2)
        for key in ("logical_reads_blocks_s", "physical_reads_blocks_s"):
            n[key] = int(b0[key] * load)
        for key in ("hard_parses_s",):
            n[key] = round(b0[key] * load, 2)
        for key in ("soft_parse_pct", "buffer_hit_pct", "pga_cache_hit_pct"):
            n[key] = b0[key]
        for key in ("redo_mb_s",):
            n[key] = round(b0[key] * load, 2)
        for key in ("user_commits_s",):
            n[key] = round(b0[key] * load, 2)
        for key in ("batch_rows_s",):
            n[key] = int(b0[key] * load)
        for key in ("single_block_ms", "temp_io_ms", "temp_gb_h",
                    "workarea_onepass_s", "workarea_multipass_s"):
            n[key] = b0[key]
        for key in ("merge_dbtime_pct", "literal_group_dbtime_pct", "other_dbtime_pct"):
            n[key] = b0[key]
        # log file sync: RAC 커밋 전파로 T4에 동반 상승(단, node1 보다 낮음)
        lfs2 = {"B0": 2.1, "T1": 2.3, "T2": 2.6, "T3": 3.0, "T4": 9.5, "R1": 4.0}.get(phase, 2.2)
        n["log_file_sync_ms"] = lfs2
        n["log_file_parallel_write_ms"] = round(min(r["log_file_parallel_write_ms"], 2.0), 2)
        n["top_wait"] = "db file sequential read" if phase != "T4" else "log file sync"
        node2.append(n)
    return node2


def round_val(v):
    if isinstance(v, float):
        return int(v) if v.is_integer() else round(v, 3)
    return v


def write_summary(payload):
    """사이트 패널(종합진단 리포트 실습)용 경량 요약 파일을 생성한다.

    metrics 162행(phase×node×분)을 phase×node 평균 1건으로 접어 payload 크기를
    수 KB 수준으로 줄인다. awr/topSql/sysctx/answerKey/meta 는 이미 phase 단위라
    그대로 복사한다.
    """
    metrics = payload["metrics"]
    phases = [p["id"] for p in payload["meta"]["phases"]]
    nodes = payload["meta"]["nodes"]

    summary_metrics = []
    for node in nodes:
        for phase in phases:
            rows = [r for r in metrics
                    if r["phase"] == phase and r.get("instance_id") == node]
            if not rows:
                continue
            agg = {"phase": phase, "instance_id": node, "samples": len(rows)}
            for col in SUMMARY_METRIC_COLS:
                vals = [r[col] for r in rows if isinstance(r.get(col), (int, float))]
                agg[col] = round_val(sum(vals) / len(vals)) if vals else None
            summary_metrics.append(agg)

    # ASH: phase 단위 module/event/state rollup 만 유지(전체 810행 → 소수 집계행)
    ash_roll = {}
    for r in payload["ash"]:
        key = (r.get("phase"), r.get("module"), r.get("action"),
               r.get("session_state"), r.get("event"))
        ash_roll[key] = ash_roll.get(key, 0) + (r.get("sample_count") or 0)
    ash_summary = [
        {"phase": k[0], "module": k[1], "action": k[2],
         "session_state": k[3], "event": k[4], "samples": v}
        for k, v in ash_roll.items()
    ]
    ash_summary.sort(key=lambda x: (-x["samples"]))

    site_payload = {
        "meta": payload["meta"],
        "metrics": summary_metrics,
        "topSql": payload["topSql"],
        "awr": payload["awr"],
        "ash": ash_summary,
        "sysctx": payload["sysctx"],
        "answerKey": payload["answerKey"],
    }

    js = (
        "/* 자동 생성 파일 — 직접 수정 금지.\n"
        "   원천 CSV(generated/, evidence/)에서 build_workbook_data.py 로 생성한다.\n"
        "   사이트 패널(종합진단 리포트 실습)용 phase×node 평균 요약본이다. */\n"
        "window.PERFLAB_S4_SUMMARY = "
        + json.dumps(site_payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )
    os.makedirs(os.path.dirname(SITE_OUT), exist_ok=True)
    with open(SITE_OUT, "w", encoding="utf-8") as fh:
        fh.write(js)
    print(f"wrote {SITE_OUT} ({len(js):,} bytes)")
    print(f"summary metric rows: {len(summary_metrics)} (phase×node), ash rows: {len(ash_summary)}")


def main():
    metrics = read_csv(os.path.join(GEN, "metrics_1m.csv"))
    top_sql = read_csv(os.path.join(GEN, "top_sql_by_phase.csv"))
    ash = read_csv(os.path.join(GEN, "ash_1m.csv"))
    awr = read_csv(os.path.join(GEN, "awr_top_events.csv"))
    sysctx = read_csv(os.path.join(EVID, "system-context.csv"))

    metrics_all = metrics + derive_node2(metrics)

    # top_sql / ash 는 원본을 node1로 태그(노드별 화면은 metrics 중심으로 비교)
    for r in top_sql:
        r.setdefault("instance_id", 1)

    # 채점 정답키 — 시나리오 설계 문서의 결론을 코드화
    answer_key = {
        "root_cause": "parse_and_cardinality_and_commit",
        "bottleneck_node": 1,
        "phase_onset": "T1",
        # 근거로 반드시 포함해야 하는 지표(핵심)와 가점 지표
        "required_evidence": ["hard_parses_s", "temp_gb_h", "log_file_sync_ms"],
        "supporting_evidence": [
            "workarea_multipass_s", "logical_reads_blocks_s", "user_commits_s",
            "merge_dbtime_pct", "literal_group_dbtime_pct", "wait_aas",
        ],
        # 함정: 단일 지표만으로 원인 확정하면 안 되는 지표
        "trap_evidence": ["aas", "buffer_hit_pct", "host_cpu_pct", "pga_cache_hit_pct"],
        "top_sql_culprits": ["9u1m3rg3a0b1x", "1it3ra1000001", "1it3ra1000002", "1it3ra1000003"],
        # 개선 우선순위(즉시조치 → 근본조치). 채점은 앞쪽 2개 정합성을 본다.
        "priority_order": [
            "bind_literal_sql",     # 리터럴 → 바인드 변수(CURSOR_SHARING/모듈 수정): Hard Parse 제거
            "batch_commit",         # commit batch 100→5000: log file sync 완화
            "fix_stats_cardinality",  # 통계 재수집/카디널리티 교정: TEMP spill 축소
            "increase_pga",         # PGA 상향: multipass 완화(근본조치 보완)
            "throttle_concurrency",  # 동시도 조절: 즉시 완화
        ],
        "rationale": (
            "09:31(T1)에 Hard Parse가 선행 상승하고 library cache: mutex X 경합이 커진 뒤 "
            "CPU(T2)→TEMP spill/I-O(T3)→log file sync(T4)로 병목이 전파된다. AAS>코어, "
            "Hit Ratio 저하, Host CPU 92%는 결과 지표이므로 단독 근거로 원인을 확정하지 않는다. "
            "부하는 1번 노드에 편중되어 있고 2번 노드는 T4 커밋 전파 외에는 기준선 근처를 유지한다."
        ),
    }

    payload = {
        "meta": {
            "window": "2026-07-15 09:00~10:20 (1분 버킷)",
            "pdb": "PERFLAB",
            "service": "PERFLAB_SVC",
            "nodes": [1, 2],
            "cpu_cores": 8,
            "phases": [
                {"id": "B0", "label": "정상 기준선", "range": "09:00~09:29"},
                {"id": "T1", "label": "파싱 이상", "range": "09:30~09:34"},
                {"id": "T2", "label": "CPU 과부하", "range": "09:35~09:42"},
                {"id": "T3", "label": "PGA/TEMP·I/O", "range": "09:43~09:54"},
                {"id": "T4", "label": "Redo/commit 병목", "range": "09:55~10:10"},
                {"id": "R1", "label": "완화·회복", "range": "10:11~10:20"},
            ],
            "note": "node2는 학습용으로 파생한 합성 노드다(정산 배치가 node1에 편중된 RAC 가정).",
        },
        "metrics": metrics_all,
        "topSql": top_sql,
        "ash": ash,
        "awr": awr,
        "sysctx": sysctx,
        "answerKey": answer_key,
    }

    js = (
        "/* 자동 생성 파일 — 직접 수정 금지.\n"
        "   원천 CSV(generated/, evidence/)에서 build_workbook_data.py 로 생성한다. */\n"
        "window.PERFLAB_S4 = "
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(js)
    print(f"wrote {OUT} ({len(js):,} bytes)")
    print(f"metrics rows: {len(metrics_all)} (node1+node2)")

    write_summary(payload)


if __name__ == "__main__":
    main()
