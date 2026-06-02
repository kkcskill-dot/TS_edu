#!/usr/bin/env bash
#
# visit_stats.sh — TS class 접속자 집계 스크립트
#
# 토큰 입력 성공 시 프론트엔드가 호출하는 /tsclass/__visit 요청이 기록된
# Nginx 전용 로그(tsclass_visits.log)를 읽어 접속 통계를 한 번에 출력합니다.
#
# 사용법:
#   sudo ./visit_stats.sh                 # 기본 로그 경로 사용
#   sudo ./visit_stats.sh /path/to/log    # 로그 경로 직접 지정
#   sudo ./visit_stats.sh -n 20           # 상위 IP 20개까지 표시 (기본 10)
#
set -euo pipefail

# ---- 설정 ----------------------------------------------------------------
LOG="${VISIT_LOG:-/var/log/nginx/tsclass_visits.log}"
TOP_N=10

# ---- 인자 파싱 ------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    -n|--top)
      TOP_N="${2:-10}"; shift 2 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)
      LOG="$1"; shift ;;
  esac
done

# 월 이름(영문)을 nginx 로그와 동일하게 맞추기 위해 C 로케일 고정
export LC_ALL=C

# ---- 색상 (터미널일 때만) -------------------------------------------------
if [[ -t 1 ]]; then
  B=$'\033[1m'; C=$'\033[36m'; G=$'\033[32m'; Y=$'\033[33m'; D=$'\033[2m'; R=$'\033[0m'
else
  B=""; C=""; G=""; Y=""; D=""; R=""
fi

hr() { printf '%s\n' "------------------------------------------------------------"; }

# ---- 사전 점검 ------------------------------------------------------------
if [[ ! -e "$LOG" ]]; then
  echo "❌ 로그 파일이 없습니다: $LOG" >&2
  echo "   아직 접속(토큰 입력) 기록이 없거나, Nginx location 설정이 누락됐을 수 있습니다." >&2
  exit 1
fi
if [[ ! -r "$LOG" ]]; then
  echo "❌ 로그 파일을 읽을 수 없습니다: $LOG" >&2
  echo "   sudo 로 다시 실행하세요:  sudo $0 $*" >&2
  exit 1
fi

TOTAL=$(wc -l < "$LOG" | tr -d ' ')

echo
echo "${B}${C}╔════════════════════════════════════════════════════════════╗${R}"
echo "${B}${C}║              TS class 접속자 집계 리포트                     ║${R}"
echo "${B}${C}╚════════════════════════════════════════════════════════════╝${R}"
echo "${D}로그 파일 : $LOG${R}"
echo "${D}생성 시각 : $(date '+%Y-%m-%d %H:%M:%S')${R}"
echo

if [[ "$TOTAL" -eq 0 ]]; then
  echo "기록이 비어 있습니다. (접속자 0)"
  exit 0
fi

# ---- 요약 ----------------------------------------------------------------
UNIQ_IP=$(awk '{print $1}' "$LOG" | sort -u | wc -l | tr -d ' ')
TODAY=$(date '+%d/%b/%Y')
TODAY_CNT=$(awk -v d="[$TODAY" 'index($4, d) == 1 {c++} END{print c+0}' "$LOG")
FIRST=$(head -n1 "$LOG" | awk '{print $4}' | tr -d '[')
LAST=$(tail -n1  "$LOG" | awk '{print $4}' | tr -d '[')

echo "${B}■ 요약${R}"
hr
printf "  총 접속(토큰 입력) 횟수 : ${B}${G}%s${R} 건\n" "$TOTAL"
printf "  고유 IP 수 (≈ 접속 인원): ${B}${G}%s${R} 명\n" "$UNIQ_IP"
printf "  오늘(%s) 접속      : ${B}${G}%s${R} 건\n" "$TODAY" "$TODAY_CNT"
printf "  최초 기록 : %s\n" "$FIRST"
printf "  최근 기록 : %s\n" "$LAST"
echo

# ---- 일자별 추이 ----------------------------------------------------------
echo "${B}■ 일자별 접속 추이${R}"
hr
awk '{
  d = substr($4, 2)         # 앞의 [ 제거
  split(d, a, ":")          # 날짜와 시간 분리
  cnt[a[1]]++
  order[++n] = a[1]
}
END {
  max = 0
  for (k in cnt) if (cnt[k] > max) max = cnt[k]
  seen[""] = 0
  for (i = 1; i <= n; i++) {
    k = order[i]
    if (k in seen) continue
    seen[k] = 1
    bars = int(cnt[k] / max * 30)
    bar = ""
    for (j = 0; j < bars; j++) bar = bar "█"
    printf "  %-12s %4d  %s\n", k, cnt[k], bar
  }
}' "$LOG"
echo

# ---- 상위 IP --------------------------------------------------------------
echo "${B}■ 상위 IP (접속 횟수 Top ${TOP_N})${R}"
hr
awk '{print $1}' "$LOG" | sort | uniq -c | sort -rn | head -n "$TOP_N" \
  | awk '{printf "  %4d 건  %s\n", $1, $2}'
echo

# ---- 오늘 시간대별 --------------------------------------------------------
if [[ "$TODAY_CNT" -gt 0 ]]; then
  echo "${B}■ 오늘(${TODAY}) 시간대별 접속${R}"
  hr
  awk -v d="[$TODAY" 'index($4, d) == 1 {
    split($4, a, ":")
    hour[a[2]]++
  }
  END {
    for (h = 0; h < 24; h++) {
      hh = sprintf("%02d", h)
      c = (hh in hour) ? hour[hh] : 0
      if (c == 0) continue
      bar = ""
      for (j = 0; j < c && j < 40; j++) bar = bar "▪"
      printf "  %s시  %3d  %s\n", hh, c, bar
    }
  }' "$LOG"
  echo
fi

echo "${D}※ 같은 탭 세션의 새로고침은 집계되지 않습니다(세션 유지). '고유 IP 수'가 실제 인원에 가장 가깝습니다.${R}"
echo
