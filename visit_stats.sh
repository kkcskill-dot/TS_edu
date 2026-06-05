#!/usr/bin/env bash
#
# visit_stats.sh — TS class 접속자 집계 스크립트
#
# 토큰 입력 성공 시 프론트엔드가 호출하는 /tsclass/__visit 요청이 기록된
# Nginx 전용 로그(tsclass_visits.log)를 읽어 접속 통계를 출력합니다.
#
# ▶ 모든 시각은 KST(한국 표준시, UTC+9)로 변환해 표시합니다.
# ▶ logrotate 로 분리된 과거 로그(.1, .2.gz …)까지 자동으로 합산합니다.
#   (현재 정책: daily / rotate 10 → 최근 약 10일치 보관)
#
# 사용법:
#   ./visit_stats.sh                  # 기본: 보관된 전체(≈10일) 요약
#   ./visit_stats.sh 2026-06-02       # 해당 일자의 상세 내역
#   ./visit_stats.sh -d               # 오늘의 상세 내역
#   ./visit_stats.sh -d 2026-06-01    # 특정 일자의 상세 내역
#   ./visit_stats.sh -d yesterday     # 'date -d' 가 해석 가능한 표현도 허용
#   ./visit_stats.sh -n 20            # 요약 시 상위 IP 20개 (기본 10)
#   ./visit_stats.sh --log /path/log  # 로그 경로 직접 지정 (VISIT_LOG 환경변수도 가능)
#
# 로그가 /var/log/nginx 에 있어 보통 sudo 가 필요합니다:  sudo ./visit_stats.sh
#
set -euo pipefail

# ---- 기본값 --------------------------------------------------------------
LOG="${VISIT_LOG:-/var/log/nginx/tsclass_visits.log}"
TOP_N=10
MODE="summary"        # summary | detail
DATE_ARG=""           # 상세 모드 대상 일자(미지정 시 오늘)

is_iso() { [[ "$1" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; }

# ---- 인자 파싱 ------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    -n|--top)
      TOP_N="${2:-10}"; shift 2 ;;
    -d|--date|--detail)
      MODE="detail"
      if [[ -n "${2:-}" && "${2:-}" != -* ]]; then DATE_ARG="$2"; shift 2; else shift; fi ;;
    --log)
      LOG="${2:?--log 뒤에 경로가 필요합니다}"; shift 2 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)
      if is_iso "$1"; then MODE="detail"; DATE_ARG="$1";
      else LOG="$1"; fi
      shift ;;
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

# ---- 로그 소스 수집 (현재 + 로테이션/압축 파일) ---------------------------
# logrotate 명명 방식이 두 가지라 모두 대응한다:
#   숫자형 :  tsclass_visits.log / .log.1 / .log.2.gz
#   날짜형 :  tsclass_visits.log / .log-20260604.gz / .log-20260605   (dateext)
# 따라서 "<LOG>*" 글롭으로 현재 파일과 모든 로테이션 파일을 한 번에 수집한다.
shopt -s nullglob
SOURCES=()
for f in "$LOG"*; do
  [[ -f "$f" ]] && SOURCES+=("$f")
done
shopt -u nullglob

if [[ ${#SOURCES[@]} -eq 0 ]]; then
  echo "❌ 로그 파일이 없습니다: $LOG (.1/.gz 포함 검색)" >&2
  echo "   아직 접속 기록이 없거나, Nginx location 설정이 누락됐을 수 있습니다." >&2
  exit 1
fi
for f in "${SOURCES[@]}"; do
  if [[ ! -r "$f" ]]; then
    echo "❌ 로그 파일을 읽을 수 없습니다: $f" >&2
    echo "   sudo 로 다시 실행하세요:  sudo $0 $*" >&2
    exit 1
  fi
done

gather() {
  local f
  for f in "${SOURCES[@]}"; do
    case "$f" in
      *.gz) gzip -dc -- "$f" 2>/dev/null ;;
      *)    cat -- "$f" ;;
    esac
  done
}

# ---- KST 정규화 -----------------------------------------------------------
# 모든 소스를 합쳐 KST 기준으로 변환·정렬한 뒤 다음 필드로 정규화한다:
#   <정렬키 YYYYMMDDHHMMSS> <IP> <ISO일자 YYYY-MM-DD> <시 HH> <시각 HH:MM:SS> <UA...>
NORM="$(mktemp)"
trap 'rm -f "$NORM"' EXIT

gather | awk '
function is_leap(y) { return ((y % 4 == 0) && (y % 100 != 0)) || (y % 400 == 0) }
function dim(y, m,   Dm) {
  split("31 28 31 30 31 30 31 31 30 31 30 31", Dm, " ")
  if (m == 2 && is_leap(y)) return 29
  return Dm[m]
}
function mon_num(s,   p) {
  p = index("JanFebMarAprMayJunJulAugSepOctNovDec", s)
  if (p == 0) return 0
  return (p - 1) / 3 + 1
}
{
  ts = $4; sub(/^\[/, "", ts)            # 02/Jun/2026:08:25:04
  off = $5; sub(/\]$/, "", off)          # +0000
  if (ts == "" || off == "") next

  split(ts, t, ":")                      # t[1]=날짜 t[2]=시 t[3]=분 t[4]=초
  split(t[1], dmy, "/")                  # dmy[1]=일 dmy[2]=월(영문) dmy[3]=연
  d = dmy[1] + 0; mon = mon_num(dmy[2]); y = dmy[3] + 0
  if (mon == 0) next
  hh = t[2] + 0; mm = t[3] + 0; ss = t[4] + 0

  # 로그 타임존 오프셋(분) → KST(+540분) 보정
  sign = substr(off, 1, 1)
  oh = substr(off, 2, 2) + 0
  om = substr(off, 4, 2) + 0
  offmin = (oh * 60 + om) * ((sign == "-") ? -1 : 1)
  shift = 540 - offmin

  total = hh * 60 + mm + shift
  daycarry = 0
  while (total < 0)     { total += 1440; daycarry-- }
  while (total >= 1440) { total -= 1440; daycarry++ }
  nh = int(total / 60); nm = total - nh * 60

  d += daycarry
  while (d < 1)           { mon--; if (mon < 1)  { mon = 12; y-- } d += dim(y, mon) }
  while (d > dim(y, mon)) { d -= dim(y, mon); mon++; if (mon > 12) { mon = 1; y++ } }

  # User-Agent 추출 (combined 포맷: 마지막 따옴표 쌍)
  qn = split($0, q, "\"")
  ua = (qn >= 6) ? q[6] : "-"

  sortkey = sprintf("%04d%02d%02d%02d%02d%02d", y, mon, d, nh, nm, ss)
  iso     = sprintf("%04d-%02d-%02d", y, mon, d)
  khh     = sprintf("%02d", nh)
  ktime   = sprintf("%02d:%02d:%02d", nh, nm, ss)
  print sortkey, $1, iso, khh, ktime, ua
}
' | sort -k1,1 > "$NORM"

TOTAL=$(wc -l < "$NORM" | tr -d ' ')
TODAY=$(TZ='Asia/Seoul' date '+%F')
NOW="$(TZ='Asia/Seoul' date '+%Y-%m-%d %H:%M:%S')"

print_header() {
  echo
  echo "${B}${C}══════════════════════════════════════════════════════════════${R}"
  echo "${B}${C}  $1${R}"
  echo "${B}${C}══════════════════════════════════════════════════════════════${R}"
  echo "${D}로그 소스 : ${#SOURCES[@]}개 파일 (현재+로테이션, .gz 포함)${R}"
  echo "${D}생성 시각 : ${NOW} KST   ·   모든 시각 KST(UTC+9) 기준${R}"
  echo
}

# =====================================================================
#  상세 모드
# =====================================================================
if [[ "$MODE" == "detail" ]]; then
  if [[ -z "$DATE_ARG" ]]; then
    TARGET="$TODAY"
  elif is_iso "$DATE_ARG"; then
    TARGET="$DATE_ARG"
  else
    # 'yesterday', 'Jun 1 2026' 등 date 명령이 해석 가능한 표현 허용
    if ! TARGET="$(TZ='Asia/Seoul' date -d "$DATE_ARG" '+%F' 2>/dev/null)"; then
      echo "❌ 날짜를 해석할 수 없습니다: '$DATE_ARG' (예: 2026-06-02, yesterday)" >&2
      exit 1
    fi
  fi

  print_header "TS class 접속 상세 — ${TARGET} (KST)"

  DAY_CNT=$(awk -v d="$TARGET" '$3 == d {c++} END{print c+0}' "$NORM")
  if [[ "$DAY_CNT" -eq 0 ]]; then
    echo "  해당 일자(${TARGET}) 기록이 없습니다."
    echo
    echo "${D}  보관 중인 일자:${R}"
    awk '{print $3}' "$NORM" | sort -u | sed 's/^/    /'
    echo
    exit 0
  fi

  DAY_UNIQ=$(awk -v d="$TARGET" '$3 == d {print $2}' "$NORM" | sort -u | wc -l | tr -d ' ')
  printf "  접속 건수 : ${B}${G}%s${R} 건   ·   고유 IP : ${B}${G}%s${R} 명\n" "$DAY_CNT" "$DAY_UNIQ"
  echo

  echo "${B}■ 시간대별 (KST)${R}"
  hr
  awk -v d="$TARGET" '$3 == d { h[$4]++ }
  END {
    for (i = 0; i < 24; i++) {
      hh = sprintf("%02d", i)
      c = (hh in h) ? h[hh] : 0
      if (c == 0) continue
      bar = ""
      for (j = 0; j < c && j < 40; j++) bar = bar "▪"
      printf "  %s시  %3d  %s\n", hh, c, bar
    }
  }' "$NORM"
  echo

  echo "${B}■ 접속 상세 목록 (KST)${R}"
  hr
  printf "  ${D}%-8s  %-15s  %s${R}\n" "시각" "IP" "User-Agent"
  awk -v d="$TARGET" '$3 == d {
    ua = ""
    for (i = 6; i <= NF; i++) ua = ua (i > 6 ? " " : "") $i
    if (length(ua) > 60) ua = substr(ua, 1, 57) "..."
    printf "  %-8s  %-15s  %s\n", $5, $2, ua
  }' "$NORM"
  echo
  exit 0
fi

# =====================================================================
#  요약 모드 (기본)
# =====================================================================
print_header "TS class 접속자 집계 리포트"

if [[ "$TOTAL" -eq 0 ]]; then
  echo "기록이 비어 있습니다. (접속자 0)"
  exit 0
fi

UNIQ_IP=$(awk '{print $2}' "$NORM" | sort -u | wc -l | tr -d ' ')
TODAY_CNT=$(awk -v d="$TODAY" '$3 == d {c++} END{print c+0}' "$NORM")
FIRST=$(head -n1 "$NORM" | awk '{print $3" "$5}')
LAST=$(tail -n1  "$NORM" | awk '{print $3" "$5}')
DAYS=$(awk '{print $3}' "$NORM" | sort -u | wc -l | tr -d ' ')

echo "${B}■ 요약${R}"
hr
printf "  총 접속(토큰 입력) 횟수 : ${B}${G}%s${R} 건\n" "$TOTAL"
printf "  고유 IP 수 (≈ 접속 인원): ${B}${G}%s${R} 명\n" "$UNIQ_IP"
printf "  오늘(%s) 접속    : ${B}${G}%s${R} 건\n" "$TODAY" "$TODAY_CNT"
printf "  보관 일수 : ${B}%s${R} 일   (%s ~ %s)\n" "$DAYS" "${FIRST%% *}" "${LAST%% *}"
printf "  최초 기록 : %s KST\n" "$FIRST"
printf "  최근 기록 : %s KST\n" "$LAST"
echo

echo "${B}■ 일자별 접속 추이 (KST)${R}"
hr
awk '{
  cnt[$3]++
  if (!($3 in seen)) { seen[$3] = 1; order[++n] = $3 }
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

echo "${B}■ 상위 IP (접속 횟수 Top ${TOP_N})${R}"
hr
awk '{print $2}' "$NORM" | sort | uniq -c | sort -rn | head -n "$TOP_N" \
  | awk '{printf "  %4d 건  %s\n", $1, $2}'
echo

if [[ "$TODAY_CNT" -gt 0 ]]; then
  echo "${B}■ 오늘(${TODAY}) 시간대별 접속 (KST)${R}"
  hr
  awk -v d="$TODAY" '$3 == d { hour[$4]++ }
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

echo "${D}※ 특정 일자 상세는:  ./visit_stats.sh 2026-06-02   (또는 -d 로 오늘)${R}"
echo "${D}※ 같은 탭 세션의 새로고침은 집계되지 않습니다(세션 유지). '고유 IP 수'가 실제 인원에 가장 가깝습니다.${R}"
echo
