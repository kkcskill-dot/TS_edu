#!/usr/bin/env bash
#
# visit_stats.sh — TS class 접속자 집계 스크립트
#
# 토큰 입력 성공 시 프론트엔드가 호출하는 /tsclass/__visit 요청이 기록된
# Nginx 전용 로그(tsclass_visits.log)를 읽어 접속 통계를 한 번에 출력합니다.
#
# ▶ 모든 시각은 KST(한국 표준시, UTC+9)로 변환해 표시합니다.
#   (Nginx 로그는 보통 UTC로 기록되므로, 로그의 타임존 오프셋을 읽어 KST로 보정합니다.)
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

# ---- KST 정규화 -----------------------------------------------------------
# 로그 각 줄을 KST 기준으로 변환해 다음 필드로 정규화한다:
#   <IP> <KST날짜(dd/Mon/yyyy)> <KST시(HH)> <KST타임스탬프(dd/Mon/yyyy:HH:MM:SS)>
NORM="$(mktemp)"
trap 'rm -f "$NORM"' EXIT

awk '
function is_leap(y) { return ((y % 4 == 0) && (y % 100 != 0)) || (y % 400 == 0) }
function dim(y, m,   D) {
  split("31 28 31 30 31 30 31 31 30 31 30 31", D, " ")
  if (m == 2 && is_leap(y)) return 29
  return D[m]
}
function mon_num(s,   p) {
  p = index("JanFebMarAprMayJunJulAugSepOctNovDec", s)
  if (p == 0) return 0
  return (p - 1) / 3 + 1
}
BEGIN { split("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec", MN, " ") }
{
  ts = $4; sub(/^\[/, "", ts)            # 02/Jun/2026:08:25:04
  off = $5; sub(/\]$/, "", off)          # +0000
  if (ts == "" || off == "") next

  split(ts, t, ":")                      # t[1]=날짜 t[2]=시 t[3]=분 t[4]=초
  split(t[1], dmy, "/")                  # dmy[1]=일 dmy[2]=월(영문) dmy[3]=연
  d = dmy[1] + 0; mon = mon_num(dmy[2]); y = dmy[3] + 0
  if (mon == 0) next
  hh = t[2] + 0; mm = t[3] + 0; ss = t[4]

  # 로그 타임존 오프셋(분) → KST(+540분)로 보정할 분(shift) 계산
  sign = substr(off, 1, 1)
  oh = substr(off, 2, 2) + 0
  om = substr(off, 4, 2) + 0
  offmin = (oh * 60 + om) * ((sign == "-") ? -1 : 1)
  shift = 540 - offmin                   # KST = local + (540 - offset)

  total = hh * 60 + mm + shift
  daycarry = 0
  while (total < 0)     { total += 1440; daycarry-- }
  while (total >= 1440) { total -= 1440; daycarry++ }
  nh = int(total / 60); nm = total - nh * 60

  d += daycarry
  while (d < 1)          { mon--; if (mon < 1)  { mon = 12; y-- } d += dim(y, mon) }
  while (d > dim(y, mon)) { d -= dim(y, mon); mon++; if (mon > 12) { mon = 1; y++ } }

  kdate  = sprintf("%02d/%s/%04d", d, MN[mon], y)
  khh    = sprintf("%02d", nh)
  kstamp = sprintf("%s:%02d:%02d:%s", kdate, nh, nm, ss)
  print $1, kdate, khh, kstamp
}
' "$LOG" > "$NORM"

TOTAL=$(wc -l < "$NORM" | tr -d ' ')

echo
echo "${B}${C}╔════════════════════════════════════════════════════════════╗${R}"
echo "${B}${C}║              TS class 접속자 집계 리포트                     ║${R}"
echo "${B}${C}╚════════════════════════════════════════════════════════════╝${R}"
echo "${D}로그 파일 : $LOG${R}"
echo "${D}생성 시각 : $(TZ='Asia/Seoul' date '+%Y-%m-%d %H:%M:%S') KST${R}"
echo "${D}시간 표기 : 모든 시각은 KST(UTC+9) 기준${R}"
echo

if [[ "$TOTAL" -eq 0 ]]; then
  echo "기록이 비어 있습니다. (접속자 0)"
  exit 0
fi

# ---- 요약 ----------------------------------------------------------------
UNIQ_IP=$(awk '{print $1}' "$NORM" | sort -u | wc -l | tr -d ' ')
TODAY=$(TZ='Asia/Seoul' date '+%d/%b/%Y')
TODAY_CNT=$(awk -v d="$TODAY" '$2 == d {c++} END{print c+0}' "$NORM")
FIRST=$(head -n1 "$NORM" | awk '{print $4}')
LAST=$(tail -n1  "$NORM" | awk '{print $4}')

echo "${B}■ 요약${R}"
hr
printf "  총 접속(토큰 입력) 횟수 : ${B}${G}%s${R} 건\n" "$TOTAL"
printf "  고유 IP 수 (≈ 접속 인원): ${B}${G}%s${R} 명\n" "$UNIQ_IP"
printf "  오늘(%s) 접속      : ${B}${G}%s${R} 건\n" "$TODAY" "$TODAY_CNT"
printf "  최초 기록 : %s (KST)\n" "$FIRST"
printf "  최근 기록 : %s (KST)\n" "$LAST"
echo

# ---- 일자별 추이 ----------------------------------------------------------
echo "${B}■ 일자별 접속 추이 (KST)${R}"
hr
awk '{
  cnt[$2]++
  if (!($2 in seen)) { seen[$2] = 1; order[++n] = $2 }
}
END {
  max = 0
  for (k in cnt) if (cnt[k] > max) max = cnt[k]
  for (i = 1; i <= n; i++) {
    k = order[i]
    bars = (max > 0) ? int(cnt[k] / max * 30) : 0
    bar = ""
    for (j = 0; j < bars; j++) bar = bar "█"
    printf "  %-12s %4d  %s\n", k, cnt[k], bar
  }
}' "$NORM"
echo

# ---- 상위 IP --------------------------------------------------------------
echo "${B}■ 상위 IP (접속 횟수 Top ${TOP_N})${R}"
hr
awk '{print $1}' "$NORM" | sort | uniq -c | sort -rn | head -n "$TOP_N" \
  | awk '{printf "  %4d 건  %s\n", $1, $2}'
echo

# ---- 오늘 시간대별 (KST) --------------------------------------------------
if [[ "$TODAY_CNT" -gt 0 ]]; then
  echo "${B}■ 오늘(${TODAY}) 시간대별 접속 (KST)${R}"
  hr
  awk -v d="$TODAY" '$2 == d { hour[$3]++ }
  END {
    for (h = 0; h < 24; h++) {
      hh = sprintf("%02d", h)
      c = (hh in hour) ? hour[hh] : 0
      if (c == 0) continue
      bar = ""
      for (j = 0; j < c && j < 40; j++) bar = bar "▪"
      printf "  %s시  %3d  %s\n", hh, c, bar
    }
  }' "$NORM"
  echo
fi

echo "${D}※ 같은 탭 세션의 새로고침은 집계되지 않습니다(세션 유지). '고유 IP 수'가 실제 인원에 가장 가깝습니다.${R}"
echo
