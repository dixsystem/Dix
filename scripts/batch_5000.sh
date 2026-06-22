#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  Dix — batch_5000.sh  v2.0                                                   ║
# ║  500 perfiles reales — 20 parámetros del kernel — sysbench + fio             ║
# ║  Datos verificables. Sin simulaciones. Sin inventos.                         ║
# ║                                                                              ║
# ║  REQUIERE: root (sudo)  |  sysbench  |  fio                                 ║
# ║                                                                              ║
# ║  USO:                                                                        ║
# ║    sudo ./batch_5000.sh                         # 500 perfiles completos     ║
# ║    sudo ./batch_5000.sh --perfiles 50           # subconjunto                ║
# ║    sudo ./batch_5000.sh --rapido                # 20 perfiles, 5s bench      ║
# ║    sudo ./batch_5000.sh --bench-tiempo 15       # bench más largo y estable  ║
# ║    sudo ./batch_5000.sh --sin-disco             # solo CPU + RAM             ║
# ║    sudo ./batch_5000.sh --disco-test /ruta      # ruta para fio              ║
# ║    sudo ./batch_5000.sh --salida /dir           # directorio de resultados   ║
# ║                                                                              ║
# ║  20 PARÁMETROS POR PERFIL:                                                   ║
# ║   cpu_governor · swappiness · dirty_ratio · dirty_background_ratio           ║
# ║   transparent_hugepages · disk_scheduler · queue_depth · numa_balancing      ║
# ║   irqbalance · tcp_congestion · vfs_cache_pressure · dirty_expire_cs         ║
# ║   dirty_writeback_cs · sched_autogroup · tcp_fastopen · min_free_kbytes      ║
# ║   zone_reclaim_mode · readahead_kb · compaction_proactiveness · netdev_backlog║
# ╚══════════════════════════════════════════════════════════════════════════════╝

set -euo pipefail

# ── Colores ───────────────────────────────────────────────────────────────────
R='\033[0;31m' G='\033[0;32m' Y='\033[0;33m' B='\033[0;34m'
C='\033[0;36m' W='\033[1;37m' DIM='\033[2m'  NC='\033[0m'

# ── Defaults ──────────────────────────────────────────────────────────────────
BENCH_TIEMPO=10
DISCO_TEST_PATH=""
SIN_DISCO=false
SOLO_N=0
SALIDA_DIR="$(dirname "${BASH_SOURCE[0]}")/bench_results"
MODO_RAPIDO=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --perfiles)      SOLO_N="$2";          shift 2 ;;
        --bench-tiempo)  BENCH_TIEMPO="$2";    shift 2 ;;
        --disco-test)    DISCO_TEST_PATH="$2"; shift 2 ;;
        --sin-disco)     SIN_DISCO=true;       shift   ;;
        --rapido)        MODO_RAPIDO=true;     shift   ;;
        --salida)        SALIDA_DIR="$2";      shift 2 ;;
        *) shift ;;
    esac
done

$MODO_RAPIDO && { BENCH_TIEMPO=5; SOLO_N=20; }

TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
RUN_DIR="$SALIDA_DIR/run_$TIMESTAMP"
CSV="$RUN_DIR/resultados.csv"
LOG="$RUN_DIR/log.txt"
REPORT="$RUN_DIR/informe.txt"

# ── Logging ───────────────────────────────────────────────────────────────────
log()  { echo -e "$@" | tee -a "$LOG"; }
info() { log "${C}[INFO]${NC} $*"; }
warn() { log "${Y}[WARN]${NC} $*"; }
ok()   { log "${G}[ OK ]${NC} $*"; }
err()  { log "${R}[ERR ]${NC} $*"; }

# ── Root check ────────────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && { echo -e "${R}Requiere root: sudo $0 $*${NC}"; exit 1; }

mkdir -p "$RUN_DIR"

log ""
log "${W}╔══════════════════════════════════════════════════════════════════╗${NC}"
log "${W}║  Dix batch_5000 v2.0 — Benchmarks Reales — $(date '+%Y-%m-%d %H:%M')  ║${NC}"
log "${W}╚══════════════════════════════════════════════════════════════════╝${NC}"
log ""

# ── Dependencias ──────────────────────────────────────────────────────────────
info "Verificando dependencias..."
command -v sysbench &>/dev/null || { warn "Instalando sysbench..."; apt-get install -y sysbench >> "$LOG" 2>&1; }
ok "sysbench OK"
if ! $SIN_DISCO; then
    command -v fio &>/dev/null || { warn "Instalando fio..."; apt-get install -y fio >> "$LOG" 2>&1 || { warn "fio no disponible — disco desactivado"; SIN_DISCO=true; }; }
    $SIN_DISCO || ok "fio OK"
fi

# ── Hardware ──────────────────────────────────────────────────────────────────
info "Detectando hardware..."
CPU_MODEL=$(grep "model name" /proc/cpuinfo | head -1 | cut -d: -f2 | xargs)
CPU_CORES=$(nproc)
CPU_THREADS=$(grep -c "^processor" /proc/cpuinfo)
RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
RAM_GB=$(( RAM_KB / 1024 / 1024 ))
DISCO_PRIMARIO=$(lsblk -d -o NAME,ROTA,TYPE --noheadings 2>/dev/null | awk '$3=="disk"' | \
    awk 'BEGIN{best=""} $2=="0" && /nvme/{print "/dev/"$1; exit} $2=="0"{best="/dev/"$1} END{if(best) print best}')
[[ -z "$DISCO_PRIMARIO" ]] && DISCO_PRIMARIO=$(lsblk -d -o NAME,TYPE --noheadings | awk '$2=="disk"{print "/dev/"$1; exit}')
DISCO_NOMBRE=$(basename "$DISCO_PRIMARIO")
DISCO_ROTACIONAL=$(cat /sys/block/"$DISCO_NOMBRE"/queue/rotational 2>/dev/null || echo "0")

if [[ -z "$DISCO_TEST_PATH" ]]; then
    DISCO_TEST_PATH="/var/tmp/dix_bench_$TIMESTAMP.tmp"
    DEV_VARTEMP=$(df /var/tmp 2>/dev/null | tail -1 | awk '{print $1}')
    [[ "$DEV_VARTEMP" == "tmpfs" ]] && DISCO_TEST_PATH="/root/dix_bench_$TIMESTAMP.tmp"
fi

ok "CPU:   $CPU_MODEL  ($CPU_CORES cores / $CPU_THREADS threads)"
ok "RAM:   ${RAM_GB}GB"
ok "Disco: $DISCO_PRIMARIO  (rotacional=$DISCO_ROTACIONAL)"
ok "fio path: $DISCO_TEST_PATH"

# ── Snapshot completo del estado actual del kernel (20 parámetros) ────────────
info "Capturando baseline del kernel..."
S_GOV=$(cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null || echo "performance")
S_SWAP=$(cat /proc/sys/vm/swappiness)
S_DR=$(cat /proc/sys/vm/dirty_ratio)
S_DRB=$(cat /proc/sys/vm/dirty_background_ratio)
S_HUGE=$(cat /sys/kernel/mm/transparent_hugepage/enabled 2>/dev/null | grep -o '\[.*\]' | tr -d '[]' || echo "madvise")
S_SCHED=$(cat /sys/block/"$DISCO_NOMBRE"/queue/scheduler 2>/dev/null | grep -o '\[.*\]' | tr -d '[]' || echo "mq-deadline")
S_QD=$(cat /sys/block/"$DISCO_NOMBRE"/queue/nr_requests 2>/dev/null || echo "512")
S_NUMA=$(cat /proc/sys/kernel/numa_balancing 2>/dev/null || echo "1")
S_IRQ=$(systemctl is-active irqbalance 2>/dev/null || echo "inactive")
S_TCP=$(cat /proc/sys/net/ipv4/tcp_congestion_control 2>/dev/null || echo "cubic")
S_VFS=$(cat /proc/sys/vm/vfs_cache_pressure)
S_DEXP=$(cat /proc/sys/vm/dirty_expire_centisecs)
S_DWB=$(cat /proc/sys/vm/dirty_writeback_centisecs)
S_SAUTO=$(cat /proc/sys/kernel/sched_autogroup_enabled 2>/dev/null || echo "1")
S_TCPFO=$(cat /proc/sys/net/ipv4/tcp_fastopen 2>/dev/null || echo "1")
S_MINFREE=$(cat /proc/sys/vm/min_free_kbytes)
S_ZONE=$(cat /proc/sys/vm/zone_reclaim_mode 2>/dev/null || echo "0")
S_READAHEAD=$(cat /sys/block/"$DISCO_NOMBRE"/queue/read_ahead_kb 2>/dev/null || echo "512")
S_COMPACT=$(cat /proc/sys/vm/compaction_proactiveness 2>/dev/null || echo "20")
S_NETDEV=$(cat /proc/sys/net/core/netdev_max_backlog 2>/dev/null || echo "1000")

ok "Baseline: gov=$S_GOV swap=$S_SWAP dirty=$S_DR/$S_DRB huge=$S_HUGE sched=$S_SCHED vfs=$S_VFS"

# ── Restaurar baseline (trap EXIT) ────────────────────────────────────────────
restore_baseline() {
    for cpu in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do echo "$S_GOV" > "$cpu" 2>/dev/null || true; done
    sysctl -w vm.swappiness="$S_SWAP"                           >/dev/null 2>&1 || true
    sysctl -w vm.dirty_ratio="$S_DR"                            >/dev/null 2>&1 || true
    sysctl -w vm.dirty_background_ratio="$S_DRB"                >/dev/null 2>&1 || true
    sysctl -w kernel.numa_balancing="$S_NUMA"                   >/dev/null 2>&1 || true
    sysctl -w vm.vfs_cache_pressure="$S_VFS"                    >/dev/null 2>&1 || true
    sysctl -w vm.dirty_expire_centisecs="$S_DEXP"               >/dev/null 2>&1 || true
    sysctl -w vm.dirty_writeback_centisecs="$S_DWB"             >/dev/null 2>&1 || true
    sysctl -w kernel.sched_autogroup_enabled="$S_SAUTO"         >/dev/null 2>&1 || true
    sysctl -w net.ipv4.tcp_fastopen="$S_TCPFO"                  >/dev/null 2>&1 || true
    sysctl -w vm.min_free_kbytes="$S_MINFREE"                   >/dev/null 2>&1 || true
    sysctl -w vm.zone_reclaim_mode="$S_ZONE"                    >/dev/null 2>&1 || true
    sysctl -w net.core.netdev_max_backlog="$S_NETDEV"           >/dev/null 2>&1 || true
    sysctl -w net.ipv4.tcp_congestion_control="$S_TCP"          >/dev/null 2>&1 || true
    echo "$S_HUGE" > /sys/kernel/mm/transparent_hugepage/enabled 2>/dev/null || true
    for dev in /sys/block/nvme* /sys/block/sd*; do
        [ -f "$dev/queue/scheduler"    ] && echo "$S_SCHED"     > "$dev/queue/scheduler"     2>/dev/null || true
        [ -f "$dev/queue/nr_requests"  ] && echo "$S_QD"        > "$dev/queue/nr_requests"   2>/dev/null || true
        [ -f "$dev/queue/read_ahead_kb"] && echo "$S_READAHEAD" > "$dev/queue/read_ahead_kb" 2>/dev/null || true
    done
    sysctl -w vm.compaction_proactiveness="$S_COMPACT"          >/dev/null 2>&1 || true
    [[ "$S_IRQ" == "active" ]] && systemctl start irqbalance >/dev/null 2>&1 || true
    rm -f "$DISCO_TEST_PATH" 2>/dev/null || true
}
trap restore_baseline EXIT

# ── Validar política (mirror de policy.rs) ────────────────────────────────────
validate_policy() {
    # $1=dirty_ratio $2=hugepages $3=numa
    local st="OK"
    [[ $1 -gt 15 ]]           && st="POLICY_BLOCKED:DIRTY_RATIO>15"
    [[ "$2" == "never" ]]     && st="POLICY_BLOCKED:HUGEPAGES_NEVER"
    [[ "$3" == "0" ]]         && st="POLICY_BLOCKED:NUMA_BALANCING=0"
    echo "$st"
}

# ── Aplicar perfil (20 parámetros) ────────────────────────────────────────────
apply_profile() {
    # Args: gov swap dr drb huge sched qd numa irq tcp vfs dexp dwb sauto tcpfo minfree zone readahead compact netdev
    local gov=$1 swap=$2 dr=$3 drb=$4 huge=$5 sched=$6 qd=$7 numa=$8
    local irq=$9 tcp=${10} vfs=${11} dexp=${12} dwb=${13} sauto=${14}
    local tcpfo=${15} minfree=${16} zone=${17} readahead=${18} compact=${19} netdev=${20}

    for cpu in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do echo "$gov" > "$cpu" 2>/dev/null || true; done
    sysctl -w vm.swappiness="$swap"                             >/dev/null 2>&1 || true
    sysctl -w vm.dirty_ratio="$dr"                              >/dev/null 2>&1 || true
    sysctl -w vm.dirty_background_ratio="$drb"                  >/dev/null 2>&1 || true
    sysctl -w kernel.numa_balancing="$numa"                     >/dev/null 2>&1 || true
    sysctl -w vm.vfs_cache_pressure="$vfs"                      >/dev/null 2>&1 || true
    sysctl -w vm.dirty_expire_centisecs="$dexp"                 >/dev/null 2>&1 || true
    sysctl -w vm.dirty_writeback_centisecs="$dwb"               >/dev/null 2>&1 || true
    sysctl -w kernel.sched_autogroup_enabled="$sauto"           >/dev/null 2>&1 || true
    sysctl -w net.ipv4.tcp_fastopen="$tcpfo"                    >/dev/null 2>&1 || true
    sysctl -w vm.min_free_kbytes="$minfree"                     >/dev/null 2>&1 || true
    sysctl -w vm.zone_reclaim_mode="$zone"                      >/dev/null 2>&1 || true
    sysctl -w net.core.netdev_max_backlog="$netdev"             >/dev/null 2>&1 || true
    sysctl -w net.ipv4.tcp_congestion_control="$tcp"            >/dev/null 2>&1 || true
    echo "$huge" > /sys/kernel/mm/transparent_hugepage/enabled   2>/dev/null || true
    for dev in /sys/block/nvme* /sys/block/sd*; do
        [ -f "$dev/queue/scheduler"    ] && echo "$sched"       > "$dev/queue/scheduler"     2>/dev/null || true
        [ -f "$dev/queue/nr_requests"  ] && echo "$qd"          > "$dev/queue/nr_requests"   2>/dev/null || true
        [ -f "$dev/queue/read_ahead_kb"] && echo "$readahead"   > "$dev/queue/read_ahead_kb" 2>/dev/null || true
    done
    sysctl -w vm.compaction_proactiveness="$compact"            >/dev/null 2>&1 || true
    [[ "$irq" == "on"  ]] && systemctl start irqbalance >/dev/null 2>&1 || true
    [[ "$irq" == "off" ]] && systemctl stop  irqbalance >/dev/null 2>&1 || true
    sleep 2
}

# ── Benchmark CPU ─────────────────────────────────────────────────────────────
bench_cpu() {
    local out
    out=$(sysbench cpu --cpu-max-prime=20000 --threads="$CPU_CORES" --time="$BENCH_TIEMPO" run 2>/dev/null)
    local eps lat p95
    eps=$(echo "$out" | awk '/events per second/{print $NF}')
    lat=$(echo "$out" | awk '/avg:/{print $NF}')
    p95=$(echo "$out" | awk '/95th percentile:/{print $NF}')
    echo "${eps:-0}|${lat:-0}|${p95:-0}"
}

# ── Benchmark memoria ─────────────────────────────────────────────────────────
bench_mem() {
    local out
    out=$(sysbench memory --memory-block-size=1M --memory-total-size=8G --threads="$CPU_CORES" --time=5 run 2>/dev/null)
    local mib lat
    mib=$(echo "$out" | awk '/MiB\/sec/{gsub(/[()]/,"",$NF); print $NF}' | head -1)
    lat=$(echo "$out" | awk '/avg:/{print $NF}')
    echo "${mib:-0}|${lat:-0}"
}

# ── Benchmark disco ───────────────────────────────────────────────────────────
bench_disk() {
    $SIN_DISCO && { echo "N/A|N/A|N/A|N/A|N/A|N/A|N/A"; return; }
    local sz="512m" rt=$BENCH_TIEMPO

    local rr_out rr_iops rr_lat rr_p95 rr_p99
    rr_out=$(fio --name=dix_rr --ioengine=libaio --iodepth=32 --rw=randread --bs=4k \
        --direct=1 --size="$sz" --numjobs=1 --time_based --runtime="$rt" \
        --filename="$DISCO_TEST_PATH" --output-format=json --group_reporting 2>/dev/null)
    rr_iops=$(echo "$rr_out" | python3 -c "import sys,json;d=json.load(sys.stdin);print(round(d['jobs'][0]['read']['iops']))" 2>/dev/null || echo "0")
    rr_lat=$(echo  "$rr_out" | python3 -c "import sys,json;d=json.load(sys.stdin);print(round(d['jobs'][0]['read']['lat_ns']['mean']/1000))" 2>/dev/null || echo "0")
    rr_p95=$(echo  "$rr_out" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['jobs'][0]['read']['lat_ns']['percentile']['95.000000']//1000)" 2>/dev/null || echo "0")
    rr_p99=$(echo  "$rr_out" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['jobs'][0]['read']['lat_ns']['percentile']['99.000000']//1000)" 2>/dev/null || echo "0")

    local rw_out rw_iops rw_lat
    rw_out=$(fio --name=dix_rw --ioengine=libaio --iodepth=32 --rw=randwrite --bs=4k \
        --direct=1 --size="$sz" --numjobs=1 --time_based --runtime="$rt" \
        --filename="$DISCO_TEST_PATH" --output-format=json --group_reporting 2>/dev/null)
    rw_iops=$(echo "$rw_out" | python3 -c "import sys,json;d=json.load(sys.stdin);print(round(d['jobs'][0]['write']['iops']))" 2>/dev/null || echo "0")
    rw_lat=$(echo  "$rw_out" | python3 -c "import sys,json;d=json.load(sys.stdin);print(round(d['jobs'][0]['write']['lat_ns']['mean']/1000))" 2>/dev/null || echo "0")

    local seq_out seq_bw
    seq_out=$(fio --name=dix_seq --ioengine=libaio --iodepth=8 --rw=read --bs=128k \
        --direct=1 --size="$sz" --numjobs=1 --time_based --runtime="$rt" \
        --filename="$DISCO_TEST_PATH" --output-format=json --group_reporting 2>/dev/null)
    seq_bw=$(echo "$seq_out" | python3 -c "import sys,json;d=json.load(sys.stdin);print(round(d['jobs'][0]['read']['bw_bytes']/1024/1024,1))" 2>/dev/null || echo "0")

    echo "${rr_iops}|${rr_lat}|${rr_p95}|${rr_p99}|${rw_iops}|${rw_lat}|${seq_bw}"
}

# ── CSV header ────────────────────────────────────────────────────────────────
write_csv_header() {
    echo "id,grupo,nombre,politica,\
governor,swappiness,dirty_ratio,dirty_bg,hugepages,scheduler,queue_depth,\
numa,irqbalance,tcp_cong,vfs_cache_pressure,dirty_expire_cs,dirty_writeback_cs,\
sched_autogroup,tcp_fastopen,min_free_kbytes,zone_reclaim,readahead_kb,compaction,netdev_backlog,\
cpu_events_per_sec,cpu_lat_avg_ms,cpu_lat_p95_ms,\
mem_mib_per_sec,mem_lat_avg_ms,\
disk_rr_iops,disk_rr_lat_avg_us,disk_rr_lat_p95_us,disk_rr_lat_p99_us,\
disk_rw_iops,disk_rw_lat_avg_us,disk_seq_bw_mbs,\
hw_cpu,hw_ram_gb,hw_disk,timestamp" > "$CSV"
}

# ── Escribir fila CSV ─────────────────────────────────────────────────────────
write_row() {
    local id=$1 grupo=$2 nombre=$3 politica=$4
    local g=$5 sw=$6 dr=$7 drb=$8 hu=$9 sc=${10} qd=${11} nu=${12} ir=${13} tc=${14}
    local vf=${15} de=${16} dw=${17} sa=${18} tf=${19} mf=${20} zo=${21} ra=${22} co=${23} nd=${24}
    local cpu_b=$25 mem_b=$26 dsk_b=$27

    local eps cl cp; IFS='|' read -r eps cl cp <<< "$cpu_b"
    local mm ml;     IFS='|' read -r mm ml     <<< "$mem_b"
    local ri rl rp rq wi wl sb; IFS='|' read -r ri rl rp rq wi wl sb <<< "$dsk_b"

    echo "${id},${grupo},\"${nombre}\",${politica},${g},${sw},${dr},${drb},${hu},${sc},${qd},${nu},${ir},${tc},${vf},${de},${dw},${sa},${tf},${mf},${zo},${ra},${co},${nd},${eps},${cl},${cp},${mm},${ml},${ri},${rl},${rp},${rq},${wi},${wl},${sb},\"${CPU_MODEL}\",${RAM_GB},\"${DISCO_NOMBRE}\",$(date '+%Y-%m-%dT%H:%M:%S')" >> "$CSV"
}

# ══════════════════════════════════════════════════════════════════════════════
# GENERADOR DE 500 PERFILES
# Formato por línea (20 params + ID + GRUPO + NOMBRE):
# ID|GRUPO|NOMBRE|GOV|SWAP|DR|DRB|HUGE|SCHED|QD|NUMA|IRQ|TCP|VFS|DEXP|DWB|SAUTO|TCPFO|MINFREE|ZONE|READAHEAD|COMPACT|NETDEV
# ══════════════════════════════════════════════════════════════════════════════
generate_profiles() {
local id=0

# ─────────────────────────────────────────────────────────────────────────────
# GRUPO A — Governor × Swappiness (50 perfiles)
# Aisla el impacto del governor sobre distintos niveles de presión de swap
# ─────────────────────────────────────────────────────────────────────────────
for gov in performance schedutil ondemand conservative powersave; do
  for swap in 1 5 10 20 30 40 60 80 100; do
    printf "%03d|A|A_GOV_%s_SWAP_%03d|%s|%d|10|3|madvise|mq-deadline|512|1|on|cubic|100|3000|500|1|1|131072|1|512|20|16384\n" \
      $id "$(echo $gov|tr a-z A-Z)" $swap "$gov" $swap; id=$((id+1))
  done
  printf "%03d|A|A_GOV_%s_FULL_OPT|%s|10|10|3|madvise|kyber|1024|1|on|bbr|100|3000|500|1|3|131072|1|512|20|16384\n" \
    $id "$(echo $gov|tr a-z A-Z)" "$gov"; id=$((id+1))
done
# Total A: 50

# ─────────────────────────────────────────────────────────────────────────────
# GRUPO B — Dirty ratio × Dirty background (50 perfiles)
# Mapea el espacio completo de parámetros de escritura sucia
# ─────────────────────────────────────────────────────────────────────────────
for dr in 5 8 10 12 15 18 20 25 30 40; do
  for drb in 3 5 8 10 15; do
    [[ $drb -ge $dr ]] && continue
    printf "%03d|B|B_DIRTY_%02d_BG_%02d|performance|10|%d|%d|madvise|mq-deadline|512|1|on|cubic|100|3000|500|1|1|131072|1|512|20|16384\n" \
      $id $dr $drb $dr $drb; id=$((id+1))
    [[ $id -ge 100 ]] && break 2
  done
done
# Rellenar hasta 100 con variantes de dirty_expire
for dexp in 500 1000 1500 2000 3000 5000 7500 10000 15000; do
  [[ $id -ge 100 ]] && break
  printf "%03d|B|B_DEXP_%05d|performance|10|10|3|madvise|mq-deadline|512|1|on|cubic|100|%d|500|1|1|131072|1|512|20|16384\n" \
    $id $dexp $dexp; id=$((id+1))
done
# Total B hasta id=100: 50

# ─────────────────────────────────────────────────────────────────────────────
# GRUPO C — dirty_writeback × dirty_expire combinados (20 perfiles)
# El par writeback+expire determina la agresividad de flush al disco
# ─────────────────────────────────────────────────────────────────────────────
for dexp in 500 1500 3000 5000 10000; do
  for dwb in 100 250 500 1000; do
    [[ $id -ge 120 ]] && break 2
    printf "%03d|C|C_DEXP_%05d_DWB_%04d|performance|10|10|3|madvise|kyber|1024|1|on|bbr|100|%d|%d|1|3|131072|1|512|20|16384\n" \
      $id $dexp $dwb $dexp $dwb; id=$((id+1))
  done
done

# ─────────────────────────────────────────────────────────────────────────────
# GRUPO D — Scheduler × Queue depth (40 perfiles)
# Mapea el espacio scheduler/QD para NVMe y rotacional
# ─────────────────────────────────────────────────────────────────────────────
for sched in none kyber mq-deadline bfq deadline; do
  for qd in 32 64 128 256 512 1024 2048 4096; do
    [[ $id -ge 160 ]] && break 2
    printf "%03d|D|D_SCHED_%s_QD_%04d|performance|10|10|3|madvise|%s|%d|1|on|bbr|100|3000|500|1|3|131072|1|512|20|16384\n" \
      $id "$sched" $qd "$sched" $qd; id=$((id+1))
  done
done

# ─────────────────────────────────────────────────────────────────────────────
# GRUPO E — vfs_cache_pressure (30 perfiles)
# Controla la agresividad de reclamación de inodo/dentry cache
# 50=conservador, 100=default, 200=agresivo, 300=muy agresivo
# ─────────────────────────────────────────────────────────────────────────────
for vfs in 10 25 50 75 100 150 200 300 500 1000; do
  for gov in performance schedutil powersave; do
    [[ $id -ge 190 ]] && break 2
    printf "%03d|E|E_VFS_%04d_GOV_%s|%s|10|10|3|madvise|kyber|1024|1|on|bbr|%d|3000|500|1|3|131072|1|512|20|16384\n" \
      $id $vfs "$gov" "$gov" $vfs; id=$((id+1))
  done
done

# ─────────────────────────────────────────────────────────────────────────────
# GRUPO F — min_free_kbytes (20 perfiles)
# Reserva mínima de RAM libre para el kernel — crítico bajo presión de memoria
# ─────────────────────────────────────────────────────────────────────────────
for mfk in 65536 98304 131072 196608 262144 393216 524288 786432 1048576; do
  for gov in performance powersave; do
    [[ $id -ge 210 ]] && break 2
    printf "%03d|F|F_MINFREE_%07d_%s|%s|10|10|3|madvise|kyber|1024|1|on|bbr|100|3000|500|1|3|%d|1|512|20|16384\n" \
      $id $mfk "$gov" "$gov" $mfk; id=$((id+1))
  done
done

# ─────────────────────────────────────────────────────────────────────────────
# GRUPO G — readahead × compaction_proactiveness (25 perfiles)
# readahead alto = mejor lectura secuencial, peor random
# compaction alto = menos fragmentación, mayor carga CPU
# ─────────────────────────────────────────────────────────────────────────────
for ra in 0 64 128 256 512 1024 2048 4096 8192; do
  for co in 0 10 20; do
    [[ $id -ge 235 ]] && break 2
    printf "%03d|G|G_RA_%04d_COMPACT_%02d|performance|10|10|3|madvise|kyber|1024|1|on|bbr|100|3000|500|1|3|131072|1|%d|%d|16384\n" \
      $id $ra $co $ra $co; id=$((id+1))
  done
done

# ─────────────────────────────────────────────────────────────────────────────
# GRUPO H — zone_reclaim × NUMA × IRQ (20 perfiles)
# zone_reclaim_mode: 0=reclamar de cualquier zona (mejor latencia)
#                    1=reclamar primero de zona local (mejor NUMA locality)
#                    4=writeback antes de reclamar
# ─────────────────────────────────────────────────────────────────────────────
for zone in 0 1 4 5; do
  for numa in 0 1; do
    for irq in on off; do
      [[ $id -ge 255 ]] && break 3
      printf "%03d|H|H_ZONE_%d_NUMA_%d_IRQ_%s|performance|10|10|3|madvise|kyber|1024|%d|%s|bbr|100|3000|500|1|3|131072|%d|512|20|16384\n" \
        $id $zone $numa "$irq" $numa "$irq" $zone; id=$((id+1))
    done
  done
done

# ─────────────────────────────────────────────────────────────────────────────
# GRUPO I — TCP congestion × fastopen × netdev_backlog (25 perfiles)
# ─────────────────────────────────────────────────────────────────────────────
for tcp in bbr cubic reno; do
  for tcpfo in 0 1 3; do
    for netdev in 1000 4096 16384 32768; do
      [[ $id -ge 280 ]] && break 3
      printf "%03d|I|I_TCP_%s_FO_%d_NETDEV_%05d|performance|10|10|3|madvise|kyber|1024|1|on|%s|100|3000|500|1|%d|131072|1|512|20|%d\n" \
        $id "$tcp" $tcpfo $netdev "$tcp" $tcpfo $netdev; id=$((id+1))
    done
  done
done

# ─────────────────────────────────────────────────────────────────────────────
# GRUPO J — sched_autogroup × hugepages × governor (20 perfiles)
# sched_autogroup agrupa procesos de la misma terminal → mejor responsividad
# ─────────────────────────────────────────────────────────────────────────────
for sauto in 0 1; do
  for huge in always madvise never; do
    for gov in performance schedutil powersave; do
      [[ $id -ge 300 ]] && break 3
      printf "%03d|J|J_AUTO_%d_HUGE_%s_GOV_%s|%s|10|10|3|%s|kyber|1024|1|on|bbr|100|3000|500|%d|3|131072|1|512|20|16384\n" \
        $id $sauto "$huge" "$gov" "$gov" "$huge" $sauto; id=$((id+1))
    done
  done
done

# ─────────────────────────────────────────────────────────────────────────────
# GRUPO K — Perfiles GAMING (25 perfiles)
# Variantes reales para distintos tipos de juego y hardware de gaming
# ─────────────────────────────────────────────────────────────────────────────
echo "300|K|K_GAMING_COMPETITIVO|performance|5|8|3|madvise|kyber|2048|1|on|bbr|50|1500|100|1|3|65536|0|256|0|32768"
echo "301|K|K_GAMING_OPEN_WORLD|performance|10|10|5|always|kyber|2048|1|on|bbr|50|3000|500|0|3|131072|0|512|0|32768"
echo "302|K|K_GAMING_STREAMING|schedutil|10|10|3|madvise|kyber|1024|1|on|bbr|100|3000|500|0|3|131072|0|512|20|32768"
echo "303|K|K_GAMING_VR|performance|1|5|3|madvise|kyber|4096|1|on|bbr|25|1000|100|1|3|65536|0|128|0|65536"
echo "304|K|K_GAMING_4K_HIGH_RAM|performance|10|10|5|always|kyber|2048|1|on|bbr|25|3000|250|0|3|196608|0|1024|0|32768"
echo "305|K|K_GAMING_BATTERY_SAVER|schedutil|30|15|8|madvise|mq-deadline|256|1|on|cubic|150|3000|500|1|1|131072|1|512|20|16384"
echo "306|K|K_GAMING_LOW_RAM_8GB|performance|5|5|3|madvise|bfq|256|1|on|cubic|75|2000|250|1|3|65536|0|512|0|16384"
echo "307|K|K_GAMING_RTSLATENCY|performance|1|5|2|never|kyber|4096|1|on|bbr|25|500|50|1|3|65536|0|64|0|65536"
echo "308|K|K_GAMING_MOBA|performance|5|8|3|madvise|kyber|1024|1|on|bbr|75|2000|200|1|3|131072|0|256|0|32768"
echo "309|K|K_GAMING_FPS_ULTRA|performance|1|5|2|madvise|kyber|4096|1|on|bbr|25|1000|100|1|3|65536|0|128|0|65536"
echo "310|K|K_GAMING_INDIE|schedutil|15|10|5|madvise|mq-deadline|512|1|on|cubic|100|3000|500|1|1|131072|1|512|20|16384"
echo "311|K|K_GAMING_MMO|performance|10|10|5|always|kyber|1024|1|on|bbr|75|3000|300|0|3|131072|0|512|0|32768"
echo "312|K|K_GAMING_EMULACION|performance|5|8|3|madvise|kyber|512|1|on|bbr|50|2000|250|1|3|131072|0|256|0|16384"
echo "313|K|K_GAMING_DECK_HANDHELD|schedutil|20|10|5|madvise|mq-deadline|256|1|off|cubic|100|3000|500|1|1|65536|1|512|20|8192"
echo "314|K|K_GAMING_WINE_PROTON|performance|5|10|3|madvise|kyber|1024|1|on|bbr|75|2000|200|0|3|131072|0|512|10|32768"
echo "315|K|K_GAMING_RAYTRACING|performance|8|10|3|always|kyber|2048|1|on|bbr|50|2000|250|0|3|131072|0|512|0|32768"
echo "316|K|K_GAMING_INDIE_HDD|ondemand|20|10|5|madvise|bfq|128|1|on|cubic|100|3000|500|1|1|131072|1|2048|20|8192"
echo "317|K|K_GAMING_SPLIT_SCREEN|performance|10|10|5|always|kyber|1024|1|on|bbr|50|2000|200|0|3|196608|0|512|0|32768"
echo "318|K|K_GAMING_RECORDING|schedutil|10|15|5|madvise|kyber|2048|1|on|bbr|100|3000|500|0|3|196608|0|512|20|32768"
echo "319|K|K_GAMING_MINIMAL_LATENCY|performance|1|5|2|madvise|none|4096|1|on|bbr|25|500|50|1|3|65536|0|64|0|65536"
echo "320|K|K_GAMING_4KMONITOR_60HZ|performance|8|10|3|madvise|kyber|1024|1|on|bbr|75|2500|400|1|3|131072|0|512|10|16384"
echo "321|K|K_GAMING_RETROGAMING|ondemand|30|15|8|always|mq-deadline|64|1|off|cubic|150|5000|1000|1|1|65536|1|2048|30|8192"
echo "322|K|K_GAMING_SERVIDOR_PARTIDAS|performance|5|8|3|madvise|kyber|2048|1|on|bbr|75|1500|150|1|3|131072|0|256|0|65536"
echo "323|K|K_GAMING_ULTRAWIDE|performance|10|10|3|madvise|kyber|1024|1|on|bbr|75|3000|500|1|3|131072|0|512|0|32768"
echo "324|K|K_GAMING_TWITCH_2160P|schedutil|8|12|5|madvise|kyber|2048|1|on|bbr|100|2000|200|0|3|262144|0|1024|20|65536"
id=325

# ─────────────────────────────────────────────────────────────────────────────
# GRUPO L — Perfiles SERVER / PRODUCCIÓN (25 perfiles)
# ─────────────────────────────────────────────────────────────────────────────
echo "325|L|L_SERVER_WEB_NGINX|performance|5|8|3|madvise|kyber|2048|1|on|bbr|200|1500|150|1|3|262144|1|512|20|65536"
echo "326|L|L_SERVER_APACHE_PHP|performance|10|10|5|madvise|kyber|1024|1|on|bbr|150|3000|300|0|3|196608|1|512|20|32768"
echo "327|L|L_SERVER_NODEJS|performance|5|10|3|madvise|kyber|2048|1|on|bbr|200|2000|200|0|3|196608|0|512|0|65536"
echo "328|L|L_SERVER_DOCKER_HOST|performance|10|10|5|madvise|kyber|2048|1|on|bbr|100|3000|500|0|3|262144|0|512|20|65536"
echo "329|L|L_SERVER_K8S_NODE|schedutil|10|10|5|madvise|kyber|2048|1|on|bbr|100|2000|200|0|3|262144|0|512|20|65536"
echo "330|L|L_SERVER_FILESERVER_NFS|performance|5|15|8|madvise|kyber|1024|1|on|bbr|200|3000|300|1|3|131072|1|8192|20|32768"
echo "331|L|L_SERVER_MAIL_POSTFIX|performance|10|10|5|madvise|kyber|512|1|on|bbr|150|5000|500|1|3|131072|1|512|20|16384"
echo "332|L|L_SERVER_DNS_BIND|performance|5|5|3|madvise|kyber|1024|1|on|bbr|300|1000|100|1|3|131072|0|256|0|65536"
echo "333|L|L_SERVER_CACHE_REDIS|performance|5|10|3|always|kyber|2048|1|on|bbr|100|2000|200|0|3|524288|0|512|0|65536"
echo "334|L|L_SERVER_MONITOR_PROMETHEUS|schedutil|15|10|5|madvise|kyber|512|1|on|bbr|200|5000|500|1|3|131072|1|512|20|32768"
echo "335|L|L_SERVER_BACKUP_RSYNC|ondemand|30|15|8|madvise|bfq|256|1|on|cubic|200|10000|1000|1|1|131072|1|8192|20|16384"
echo "336|L|L_SERVER_BUILD_CI|performance|5|10|3|madvise|kyber|2048|1|on|bbr|150|2000|200|0|3|262144|0|512|20|65536"
echo "337|L|L_SERVER_MEDIA_PLEX|performance|10|10|5|always|kyber|1024|1|on|bbr|100|3000|300|0|3|196608|0|2048|0|32768"
echo "338|L|L_SERVER_VPN_WIREGUARD|performance|5|8|3|madvise|kyber|512|1|on|bbr|150|1500|150|1|3|131072|0|512|0|65536"
echo "339|L|L_SERVER_LOADBALANCER_HAPROXY|performance|5|8|3|madvise|kyber|2048|1|on|bbr|300|1000|100|1|3|262144|0|256|0|131072"
echo "340|L|L_SERVER_KAFKA|performance|5|10|3|madvise|kyber|4096|1|on|bbr|150|2000|200|0|3|524288|0|512|0|65536"
echo "341|L|L_SERVER_ELASTICSEARCH|performance|5|10|5|always|kyber|2048|1|on|bbr|100|3000|300|0|3|524288|1|512|20|32768"
echo "342|L|L_SERVER_JENKINS|schedutil|15|10|5|madvise|kyber|1024|1|on|bbr|150|3000|500|0|3|262144|0|512|20|32768"
echo "343|L|L_SERVER_GITLAB_RUNNER|performance|5|10|3|madvise|kyber|2048|1|on|bbr|150|2000|200|0|3|262144|0|512|10|65536"
echo "344|L|L_SERVER_BAJO_CARGA|schedutil|20|15|8|madvise|mq-deadline|256|1|on|cubic|100|5000|1000|1|1|131072|1|512|20|16384"
echo "345|L|L_SERVER_PICO_ALTO|performance|5|8|3|madvise|kyber|4096|1|on|bbr|200|1500|100|0|3|262144|0|256|0|131072"
echo "346|L|L_SERVER_LEGACY_HDD|ondemand|20|10|5|madvise|bfq|128|1|on|cubic|150|5000|1000|1|1|131072|1|4096|20|16384"
echo "347|L|L_SERVER_NVME_RAID|performance|5|8|3|madvise|kyber|4096|1|on|bbr|100|1000|100|0|3|524288|0|512|0|65536"
echo "348|L|L_SERVER_GRAFANA|schedutil|15|10|5|madvise|kyber|512|1|on|bbr|150|3000|300|1|3|196608|1|512|20|32768"
echo "349|L|L_SERVER_MINECRAFT_JAVA|performance|10|10|5|always|kyber|1024|1|on|bbr|75|2000|200|0|3|196608|0|512|0|32768"
id=350

# ─────────────────────────────────────────────────────────────────────────────
# GRUPO M — Perfiles DATABASE (25 perfiles)
# ─────────────────────────────────────────────────────────────────────────────
echo "350|M|M_DB_POSTGRESQL_OLTP|performance|5|10|3|always|kyber|4096|1|on|bbr|50|2000|200|0|3|524288|0|512|0|65536"
echo "351|M|M_DB_MYSQL_INNODB|performance|5|10|3|always|kyber|2048|1|on|bbr|75|2000|200|0|3|524288|0|512|0|65536"
echo "352|M|M_DB_MARIADB_REPLICAS|performance|5|10|3|always|kyber|2048|1|on|bbr|75|2000|200|0|3|393216|0|512|0|65536"
echo "353|M|M_DB_MONGODB_WRITE|performance|10|10|5|always|kyber|4096|1|on|bbr|100|2000|200|0|3|524288|0|512|0|65536"
echo "354|M|M_DB_REDIS_CACHE|performance|5|8|3|always|kyber|2048|1|on|bbr|50|1000|100|0|3|524288|0|256|0|65536"
echo "355|M|M_DB_CASSANDRA|performance|5|10|3|always|kyber|4096|1|on|bbr|100|2000|200|0|3|524288|1|512|0|65536"
echo "356|M|M_DB_CLICKHOUSE_ANALYTICS|performance|5|15|5|always|kyber|4096|1|on|bbr|50|3000|300|0|3|786432|0|8192|0|65536"
echo "357|M|M_DB_SQLITE_WRITE|performance|10|15|8|madvise|kyber|512|1|on|bbr|100|2000|200|1|3|131072|0|512|20|16384"
echo "358|M|M_DB_POSTGRES_OLAP|performance|5|15|5|always|kyber|4096|1|on|bbr|50|5000|500|0|3|786432|0|8192|10|65536"
echo "359|M|M_DB_TIMESCALEDB|performance|5|10|3|always|kyber|4096|1|on|bbr|75|2000|200|0|3|524288|0|512|0|65536"
echo "360|M|M_DB_INFLUXDB|performance|5|10|3|always|kyber|2048|1|on|bbr|100|1500|150|0|3|393216|0|512|0|32768"
echo "361|M|M_DB_NEO4J_GRAFO|performance|5|10|3|always|kyber|2048|1|on|bbr|75|3000|300|0|3|524288|0|512|0|32768"
echo "362|M|M_DB_MINIO_OBJECT|performance|5|10|3|madvise|kyber|4096|1|on|bbr|150|2000|200|0|3|393216|0|4096|0|65536"
echo "363|M|M_DB_MYSQL_READONLY|schedutil|15|5|3|madvise|kyber|1024|1|on|bbr|200|1000|100|1|3|262144|0|2048|0|32768"
echo "364|M|M_DB_PG_CONEXIONES_ALTAS|performance|5|8|3|always|kyber|4096|1|on|bbr|50|1000|100|0|3|524288|0|512|0|131072"
echo "365|M|M_DB_MYSQL_DUMP|ondemand|10|15|8|madvise|bfq|256|1|on|cubic|200|10000|1000|1|1|131072|1|8192|20|16384"
echo "366|M|M_DB_ORACLE_COMPAT|performance|5|10|3|always|kyber|2048|1|on|bbr|50|2000|200|0|3|524288|1|512|0|65536"
echo "367|M|M_DB_MEMCACHED|performance|5|5|3|madvise|kyber|1024|1|on|bbr|200|1000|100|0|3|786432|0|256|0|65536"
echo "368|M|M_DB_DRAGONFLY|performance|5|8|3|always|kyber|2048|1|on|bbr|50|1000|100|0|3|786432|0|512|0|65536"
echo "369|M|M_DB_ETCD_CLUSTER|performance|5|5|3|madvise|kyber|1024|1|on|bbr|300|500|50|1|3|131072|0|512|0|65536"
echo "370|M|M_DB_POSTGRES_ARCHIVE|schedutil|10|15|8|madvise|kyber|512|1|on|bbr|150|10000|1000|1|3|196608|1|4096|20|16384"
echo "371|M|M_DB_CITUS_DISTRIBUTED|performance|5|10|3|always|kyber|4096|1|on|bbr|75|2000|200|0|3|524288|1|512|0|65536"
echo "372|M|M_DB_VITESS|performance|5|8|3|madvise|kyber|2048|1|on|bbr|150|1500|150|0|3|393216|0|512|0|65536"
echo "373|M|M_DB_YUGABYTEDB|performance|5|10|3|always|kyber|4096|1|on|bbr|75|2000|200|0|3|524288|1|512|0|65536"
echo "374|M|M_DB_HDD_LEGACY_MYSQL|ondemand|20|10|5|madvise|bfq|128|1|on|cubic|150|5000|500|1|1|131072|1|4096|20|16384"
id=375

# ─────────────────────────────────────────────────────────────────────────────
# GRUPO N — Perfiles ML/AI/HPC (25 perfiles)
# ─────────────────────────────────────────────────────────────────────────────
echo "375|N|N_ML_TRAINING_CPU|performance|5|10|3|always|kyber|4096|1|on|bbr|50|2000|200|0|3|786432|0|2048|0|65536"
echo "376|N|N_ML_TRAINING_GPU_HOST|performance|5|10|3|always|kyber|4096|1|on|bbr|50|2000|200|0|3|786432|0|2048|0|65536"
echo "377|N|N_ML_INFERENCE_BATCH|performance|10|10|5|always|kyber|2048|1|on|bbr|75|3000|300|0|3|524288|0|1024|0|32768"
echo "378|N|N_ML_INFERENCE_RT|performance|1|5|2|madvise|kyber|4096|1|on|bbr|25|1000|100|1|3|524288|0|512|0|65536"
echo "379|N|N_ML_JUPYTER_LAB|schedutil|10|10|5|madvise|kyber|1024|1|on|bbr|100|3000|300|1|3|262144|0|512|20|32768"
echo "380|N|N_ML_PYTORCH_DATALOADER|performance|5|10|3|madvise|kyber|4096|1|on|bbr|100|2000|200|0|3|524288|0|4096|0|65536"
echo "381|N|N_ML_TENSORFLOW_XLA|performance|5|10|3|always|kyber|4096|1|on|bbr|50|2000|200|0|3|786432|0|2048|0|65536"
echo "382|N|N_ML_LLM_OLLAMA|performance|5|10|3|always|kyber|4096|1|on|bbr|50|2000|200|0|3|786432|0|4096|0|65536"
echo "383|N|N_ML_LLAMA_CPP|performance|5|8|3|always|kyber|2048|1|on|bbr|50|2000|200|0|3|786432|0|2048|0|32768"
echo "384|N|N_ML_SPARK_HADOOP|performance|5|10|5|always|kyber|4096|1|on|bbr|75|3000|300|0|3|786432|1|4096|0|65536"
echo "385|N|N_ML_DASK_PARALLEL|performance|5|10|3|always|kyber|4096|1|on|bbr|100|2000|200|0|3|524288|0|2048|0|65536"
echo "386|N|N_ML_OPENMP_HPC|performance|1|8|3|madvise|kyber|4096|1|on|bbr|50|1000|100|0|3|524288|0|512|0|65536"
echo "387|N|N_ML_MPI_CLUSTER_NODE|performance|5|10|3|madvise|kyber|4096|1|on|bbr|100|2000|200|0|3|393216|0|512|0|131072"
echo "388|N|N_ML_FFMPEG_ENCODE|performance|5|10|3|madvise|kyber|2048|1|on|bbr|150|2000|200|0|3|262144|0|1024|0|32768"
echo "389|N|N_ML_BLENDER_RENDER|performance|5|10|3|always|kyber|2048|1|on|bbr|75|3000|300|0|3|524288|0|2048|0|32768"
echo "390|N|N_ML_SKLEARN_HYPERPARAM|performance|5|10|3|madvise|kyber|2048|1|on|bbr|100|3000|300|0|3|393216|0|1024|0|32768"
echo "391|N|N_ML_RAY_DISTRIBUTED|performance|5|10|3|madvise|kyber|4096|1|on|bbr|100|2000|200|0|3|524288|0|1024|0|65536"
echo "392|N|N_ML_QUANTIZATION_INT8|performance|5|8|3|madvise|kyber|2048|1|on|bbr|75|2000|200|1|3|393216|0|512|0|32768"
echo "393|N|N_ML_VECTOR_DB|performance|5|10|3|always|kyber|4096|1|on|bbr|50|2000|200|0|3|786432|0|1024|0|65536"
echo "394|N|N_ML_TRANSCRIPCION_WHISPER|performance|5|10|3|always|kyber|2048|1|on|bbr|75|2000|200|0|3|524288|0|2048|0|32768"
echo "395|N|N_ML_DATA_PIPELINE|performance|5|15|5|madvise|kyber|4096|1|on|bbr|150|3000|300|0|3|393216|0|4096|0|65536"
echo "396|N|N_ML_MODELADO_3D|performance|5|10|3|always|kyber|2048|1|on|bbr|75|3000|300|0|3|524288|0|1024|0|32768"
echo "397|N|N_ML_NLP_BATCH|performance|5|10|5|always|kyber|4096|1|on|bbr|75|3000|300|0|3|786432|0|2048|0|65536"
echo "398|N|N_ML_AUDIO_PROCESAMIENTO|performance|1|8|3|madvise|kyber|2048|1|on|bbr|75|1000|100|1|3|262144|0|512|0|32768"
echo "399|N|N_ML_COMPUTER_VISION_RT|performance|1|5|2|madvise|kyber|4096|1|on|bbr|25|500|50|1|3|524288|0|512|0|65536"
id=400

# ─────────────────────────────────────────────────────────────────────────────
# GRUPO O — Perfiles DESKTOP / CREATIVO (25 perfiles)
# ─────────────────────────────────────────────────────────────────────────────
echo "400|O|O_DESKTOP_GNOME_DIARIO|schedutil|15|10|5|madvise|kyber|512|1|on|bbr|100|3000|500|1|1|131072|1|512|20|16384"
echo "401|O|O_DESKTOP_KDE_PLASMA|schedutil|15|10|5|madvise|kyber|512|1|on|bbr|100|3000|500|1|1|131072|1|512|20|16384"
echo "402|O|O_DESKTOP_XFCE_ANTIGUO|ondemand|30|15|8|madvise|mq-deadline|128|1|off|cubic|150|5000|1000|1|1|65536|1|1024|30|8192"
echo "403|O|O_DESKTOP_PROGRAMADOR_JAVA|performance|10|10|5|madvise|kyber|1024|1|on|bbr|100|3000|500|1|3|196608|0|512|20|32768"
echo "404|O|O_DESKTOP_IDE_VSCODE|schedutil|10|10|5|madvise|kyber|512|1|on|bbr|100|3000|500|1|1|196608|0|512|20|32768"
echo "405|O|O_DESKTOP_NAVEGADOR_PESADO|schedutil|10|10|5|madvise|kyber|512|1|on|bbr|150|3000|500|1|1|131072|0|512|20|32768"
echo "406|O|O_DESKTOP_DAVINCI_RESOLVE|performance|5|10|3|always|kyber|2048|1|on|bbr|50|2000|200|0|3|524288|0|4096|0|32768"
echo "407|O|O_DESKTOP_KDENLIVE|performance|5|10|3|always|kyber|1024|1|on|bbr|75|3000|300|0|3|393216|0|2048|0|32768"
echo "408|O|O_DESKTOP_INKSCAPE_GIMP|schedutil|10|10|5|madvise|kyber|512|1|on|bbr|100|3000|300|1|1|262144|0|1024|20|16384"
echo "409|O|O_DESKTOP_AUDIO_DAW|performance|1|8|3|madvise|kyber|4096|1|on|bbr|50|1000|100|1|3|196608|0|256|0|32768"
echo "410|O|O_DESKTOP_OBS_STREAMING|performance|5|10|3|madvise|kyber|1024|1|on|bbr|100|2000|200|0|3|262144|0|1024|0|32768"
echo "411|O|O_DESKTOP_COMPILAR_KERNEL|performance|5|10|3|madvise|kyber|2048|1|on|bbr|150|2000|200|0|3|262144|0|512|20|32768"
echo "412|O|O_DESKTOP_VIRTUALBOX_HOST|performance|10|10|5|madvise|kyber|2048|1|on|bbr|100|3000|300|0|3|393216|0|1024|0|32768"
echo "413|O|O_DESKTOP_VAGRANT_DEV|schedutil|10|10|5|madvise|kyber|1024|1|on|bbr|100|3000|500|0|3|262144|0|512|20|32768"
echo "414|O|O_DESKTOP_ANSIBLE_DEVOPS|schedutil|10|10|5|madvise|kyber|512|1|on|bbr|100|3000|500|1|3|196608|0|512|20|32768"
echo "415|O|O_DESKTOP_MINECRAFT_JUGAR|performance|8|10|3|always|kyber|512|1|on|bbr|75|2000|200|0|3|196608|0|512|0|32768"
echo "416|O|O_DESKTOP_ZOOM_VIDEOLLAMADA|schedutil|10|10|5|madvise|kyber|512|1|on|bbr|100|3000|500|1|1|131072|0|512|0|32768"
echo "417|O|O_DESKTOP_TERMINAL_TRABAJO|performance|5|10|3|madvise|kyber|512|1|on|bbr|150|3000|500|1|3|131072|0|512|20|16384"
echo "418|O|O_DESKTOP_STEAM_LINUX|performance|8|10|3|madvise|kyber|1024|1|on|bbr|75|2000|200|0|3|196608|0|512|0|32768"
echo "419|O|O_DESKTOP_LAPTOP_4GB|performance|5|5|3|madvise|bfq|128|1|on|cubic|100|2000|200|1|1|65536|0|512|20|8192"
echo "420|O|O_DESKTOP_LAPTOP_8GB_BAT|schedutil|20|10|5|madvise|mq-deadline|256|1|on|cubic|100|3000|500|1|1|65536|1|512|20|8192"
echo "421|O|O_DESKTOP_WORKSTATION_64GB|performance|5|10|3|always|kyber|4096|1|on|bbr|50|2000|200|0|3|786432|0|1024|0|65536"
echo "422|O|O_DESKTOP_RASPI4_ARM64|schedutil|30|15|8|madvise|bfq|64|1|on|bbr|100|5000|500|1|1|32768|0|512|30|8192"
echo "423|O|O_DESKTOP_CHROMEBOOK_LINUX|schedutil|20|10|5|madvise|mq-deadline|128|1|off|cubic|150|3000|500|1|1|65536|1|512|20|8192"
echo "424|O|O_DESKTOP_EMBEDDED_IOT|ondemand|40|15|8|madvise|bfq|32|0|off|cubic|200|5000|1000|1|1|32768|1|1024|50|4096"
id=425

# ─────────────────────────────────────────────────────────────────────────────
# GRUPO P — Distros de referencia (25 perfiles)
# Estado real por defecto de las distribuciones más usadas
# ─────────────────────────────────────────────────────────────────────────────
echo "425|P|P_UBUNTU_2004_LTS|powersave|60|20|10|madvise|mq-deadline|64|1|off|cubic|100|3000|500|1|1|131072|0|512|30|1000"
echo "426|P|P_UBUNTU_2204_LTS|powersave|60|20|10|madvise|mq-deadline|64|1|off|cubic|100|3000|500|1|1|131072|0|512|30|1000"
echo "427|P|P_UBUNTU_2404_NOBLE|powersave|60|20|10|madvise|mq-deadline|64|1|off|cubic|100|3000|500|1|1|131072|0|512|30|1000"
echo "428|P|P_FEDORA_39|schedutil|60|20|10|madvise|mq-deadline|64|1|on|cubic|100|3000|500|1|1|131072|0|512|20|1000"
echo "429|P|P_FEDORA_40|schedutil|60|20|10|madvise|mq-deadline|64|1|on|cubic|100|3000|500|1|1|131072|0|512|20|1000"
echo "430|P|P_ARCH_LINUX_STOCK|ondemand|60|20|10|madvise|mq-deadline|64|1|off|cubic|100|3000|500|1|1|131072|0|512|20|1000"
echo "431|P|P_MANJARO_GNOME|schedutil|60|20|10|madvise|mq-deadline|64|1|on|cubic|100|3000|500|1|1|131072|0|512|20|1000"
echo "432|P|P_DEBIAN_12_BOOKWORM|powersave|60|20|10|madvise|mq-deadline|64|1|off|cubic|100|3000|500|1|1|131072|0|512|30|1000"
echo "433|P|P_OPENSUSE_LEAP_154|ondemand|60|20|10|madvise|mq-deadline|64|1|on|cubic|100|3000|500|1|1|131072|0|512|20|1000"
echo "434|P|P_OPENSUSE_TUMBLEWEED|schedutil|60|20|10|madvise|kyber|64|1|on|cubic|100|3000|500|1|1|131072|0|512|20|1000"
echo "435|P|P_RHEL_9|performance|60|20|10|madvise|mq-deadline|64|1|on|cubic|100|3000|500|1|1|131072|0|512|20|1000"
echo "436|P|P_CENTOS_STREAM_9|performance|60|20|10|madvise|mq-deadline|64|1|on|cubic|100|3000|500|1|1|131072|0|512|20|1000"
echo "437|P|P_ALMALINUX_9|performance|60|20|10|madvise|mq-deadline|64|1|on|cubic|100|3000|500|1|1|131072|0|512|20|1000"
echo "438|P|P_ROCKY_LINUX_9|performance|60|20|10|madvise|mq-deadline|64|1|on|cubic|100|3000|500|1|1|131072|0|512|20|1000"
echo "439|P|P_POPOS_2204|performance|60|20|10|madvise|mq-deadline|64|1|on|cubic|100|3000|500|1|1|131072|0|512|20|1000"
echo "440|P|P_MINT_21_VANESSA|powersave|60|20|10|madvise|mq-deadline|64|1|off|cubic|100|3000|500|1|1|131072|0|512|30|1000"
echo "441|P|P_ZORIN_OS_17|powersave|60|20|10|madvise|mq-deadline|64|1|off|cubic|100|3000|500|1|1|131072|0|512|30|1000"
echo "442|P|P_ENDEAVOUROS|ondemand|60|20|10|madvise|mq-deadline|64|1|off|cubic|100|3000|500|1|1|131072|0|512|20|1000"
echo "443|P|P_NIXOS_23|performance|60|20|10|madvise|mq-deadline|64|1|on|cubic|100|3000|500|1|1|131072|0|512|20|1000"
echo "444|P|P_GENTOO_HARDENED|performance|10|10|5|madvise|kyber|256|1|on|bbr|100|3000|500|1|3|131072|0|512|20|16384"
echo "445|P|P_VOID_LINUX|ondemand|60|20|10|madvise|mq-deadline|64|1|off|cubic|100|3000|500|1|1|131072|0|512|20|1000"
echo "446|P|P_ALPINE_SERVER|performance|0|20|10|madvise|mq-deadline|64|1|off|cubic|200|3000|500|0|1|32768|0|512|20|1000"
echo "447|P|P_KALI_LIVE|powersave|60|20|10|madvise|mq-deadline|64|1|off|cubic|100|3000|500|1|1|131072|0|512|30|1000"
echo "448|P|P_RASPBIAN_BULLSEYE|schedutil|60|15|8|madvise|bfq|32|0|off|cubic|100|3000|500|1|1|32768|0|1024|30|1000"
echo "449|P|P_UBUNTU_SERVER_2404|performance|60|20|10|madvise|mq-deadline|64|1|on|cubic|100|3000|500|1|1|131072|1|512|20|1000"
id=450

# ─────────────────────────────────────────────────────────────────────────────
# GRUPO Q — Tests de frontera de política (25 perfiles)
# Mide justo en los límites que policy.rs acepta o rechaza
# ─────────────────────────────────────────────────────────────────────────────
echo "450|Q|Q_DIRTY_LIMITE_13|performance|10|13|5|madvise|kyber|1024|1|on|bbr|100|3000|500|1|3|131072|1|512|20|16384"
echo "451|Q|Q_DIRTY_LIMITE_14|performance|10|14|6|madvise|kyber|1024|1|on|bbr|100|3000|500|1|3|131072|1|512|20|16384"
echo "452|Q|Q_DIRTY_LIMITE_15_OK|performance|10|15|7|madvise|kyber|1024|1|on|bbr|100|3000|500|1|3|131072|1|512|20|16384"
echo "453|Q|Q_DIRTY_LIMITE_16_BLOQ|performance|10|16|8|madvise|kyber|1024|1|on|bbr|100|3000|500|1|3|131072|1|512|20|16384"
echo "454|Q|Q_DIRTY_LIMITE_17_BLOQ|performance|10|17|8|madvise|kyber|1024|1|on|bbr|100|3000|500|1|3|131072|1|512|20|16384"
echo "455|Q|Q_HUGE_ALWAYS_LIMOK|performance|10|10|3|always|kyber|1024|1|on|bbr|100|3000|500|1|3|131072|1|512|20|16384"
echo "456|Q|Q_HUGE_MADVISE_OK|performance|10|10|3|madvise|kyber|1024|1|on|bbr|100|3000|500|1|3|131072|1|512|20|16384"
echo "457|Q|Q_HUGE_NEVER_BLOQ|performance|10|10|3|never|kyber|1024|1|on|bbr|100|3000|500|1|3|131072|1|512|20|16384"
echo "458|Q|Q_NUMA_0_BLOQ|performance|10|10|3|madvise|kyber|1024|0|on|bbr|100|3000|500|1|3|131072|1|512|20|16384"
echo "459|Q|Q_NUMA_1_OK|performance|10|10|3|madvise|kyber|1024|1|on|bbr|100|3000|500|1|3|131072|1|512|20|16384"
echo "460|Q|Q_SWAP_0_EXTREMO|performance|0|10|3|madvise|kyber|1024|1|on|bbr|100|3000|500|1|3|131072|1|512|20|16384"
echo "461|Q|Q_SWAP_100_EXTREMO|powersave|100|20|10|never|mq-deadline|32|0|off|reno|300|10000|2000|0|0|32768|1|512|50|1000"
echo "462|Q|Q_VFS_MINIMO_10|performance|10|10|3|madvise|kyber|1024|1|on|bbr|10|3000|500|1|3|131072|1|512|20|16384"
echo "463|Q|Q_VFS_MAXIMO_1000|performance|10|10|3|madvise|kyber|1024|1|on|bbr|1000|3000|500|1|3|131072|1|512|20|16384"
echo "464|Q|Q_DEXP_MINIMO_100|performance|10|10|3|madvise|kyber|1024|1|on|bbr|100|100|50|1|3|131072|1|512|20|16384"
echo "465|Q|Q_DEXP_MAXIMO_30000|performance|10|10|3|madvise|kyber|1024|1|on|bbr|100|30000|1000|1|3|131072|1|512|20|16384"
echo "466|Q|Q_MINFREE_MUY_BAJO_32MB|performance|10|10|3|madvise|kyber|1024|1|on|bbr|100|3000|500|1|3|32768|1|512|20|16384"
echo "467|Q|Q_MINFREE_MUY_ALTO_1GB|performance|10|10|3|madvise|kyber|1024|1|on|bbr|100|3000|500|1|3|1048576|1|512|20|16384"
echo "468|Q|Q_RA_CERO_DISABLE|performance|10|10|3|madvise|kyber|1024|1|on|bbr|100|3000|500|1|3|131072|1|0|20|16384"
echo "469|Q|Q_RA_MAXIMO_16MB|performance|10|10|3|madvise|kyber|1024|1|on|bbr|100|3000|500|1|3|131072|1|16384|20|16384"
echo "470|Q|Q_COMPACTION_CERO|performance|10|10|3|madvise|kyber|1024|1|on|bbr|100|3000|500|1|3|131072|1|512|0|16384"
echo "471|Q|Q_COMPACTION_100|performance|10|10|3|madvise|kyber|1024|1|on|bbr|100|3000|500|1|3|131072|1|512|100|16384"
echo "472|Q|Q_ZONA_RECLAIM_0|performance|10|10|3|madvise|kyber|1024|1|on|bbr|100|3000|500|1|3|131072|0|512|20|16384"
echo "473|Q|Q_ZONA_RECLAIM_4_WB|performance|10|10|3|madvise|kyber|1024|1|on|bbr|100|3000|500|1|3|131072|4|512|20|16384"
echo "474|Q|Q_FULL_POLICY_VIOLATIONS|powersave|100|40|20|never|deadline|32|0|off|reno|500|30000|5000|0|0|32768|4|16384|100|1000"
id=475

# ─────────────────────────────────────────────────────────────────────────────
# GRUPO R — Ruta de optimización progresiva (15 perfiles)
# Ubuntu 22.04 por defecto → cada paso aplica una optimización de Dix
# Muestra el impacto INCREMENTAL de cada parámetro
# ─────────────────────────────────────────────────────────────────────────────
echo "475|R|R_PASO_00_UBUNTU_DEFAULT|powersave|60|20|10|madvise|mq-deadline|64|1|off|cubic|100|3000|500|1|1|131072|0|512|30|1000"
echo "476|R|R_PASO_01_GOVERNOR|performance|60|20|10|madvise|mq-deadline|64|1|off|cubic|100|3000|500|1|1|131072|0|512|30|1000"
echo "477|R|R_PASO_02_SWAPPINESS|performance|10|20|10|madvise|mq-deadline|64|1|off|cubic|100|3000|500|1|1|131072|0|512|30|1000"
echo "478|R|R_PASO_03_DIRTY|performance|10|10|3|madvise|mq-deadline|64|1|off|cubic|100|3000|500|1|1|131072|0|512|30|1000"
echo "479|R|R_PASO_04_HUGEPAGES|performance|10|10|3|madvise|mq-deadline|64|1|off|cubic|100|3000|500|1|1|131072|0|512|30|1000"
echo "480|R|R_PASO_05_SCHEDULER|performance|10|10|3|madvise|kyber|64|1|off|cubic|100|3000|500|1|1|131072|0|512|30|1000"
echo "481|R|R_PASO_06_QUEUE_DEPTH|performance|10|10|3|madvise|kyber|1024|1|off|cubic|100|3000|500|1|1|131072|0|512|30|1000"
echo "482|R|R_PASO_07_IRQ|performance|10|10|3|madvise|kyber|1024|1|on|cubic|100|3000|500|1|1|131072|0|512|30|1000"
echo "483|R|R_PASO_08_TCP_BBR|performance|10|10|3|madvise|kyber|1024|1|on|bbr|100|3000|500|1|1|131072|0|512|30|1000"
echo "484|R|R_PASO_09_TCP_FASTOPEN|performance|10|10|3|madvise|kyber|1024|1|on|bbr|100|3000|500|1|3|131072|0|512|30|1000"
echo "485|R|R_PASO_10_VFS_CACHE|performance|10|10|3|madvise|kyber|1024|1|on|bbr|50|3000|500|1|3|131072|0|512|30|1000"
echo "486|R|R_PASO_11_DIRTY_EXPIRE|performance|10|10|3|madvise|kyber|1024|1|on|bbr|50|1500|250|1|3|131072|0|512|30|1000"
echo "487|R|R_PASO_12_READAHEAD|performance|10|10|3|madvise|kyber|1024|1|on|bbr|50|1500|250|1|3|131072|0|256|30|1000"
echo "488|R|R_PASO_13_MINFREE|performance|10|10|3|madvise|kyber|1024|1|on|bbr|50|1500|250|1|3|65536|0|256|20|16384"
echo "489|R|R_PASO_14_DIX_COMPLETO|performance|10|10|3|madvise|kyber|1024|1|on|bbr|50|1500|250|1|3|65536|0|256|10|32768"
id=490

# ─────────────────────────────────────────────────────────────────────────────
# GRUPO S — Configs adversariales (10 perfiles)
# Configuraciones que PARECEN razonables pero rinden mal o son peligrosas
# ─────────────────────────────────────────────────────────────────────────────
echo "490|S|S_ADV_PERFORMANCE_GOV_ALTA_SWAP|performance|80|20|10|madvise|mq-deadline|64|1|off|cubic|100|3000|500|1|1|131072|0|512|30|1000"
echo "491|S|S_ADV_KYBER_QD_MINIMO|performance|10|10|3|madvise|kyber|32|1|on|bbr|100|3000|500|1|3|131072|0|512|20|16384"
echo "492|S|S_ADV_BBR_SWAP_ALTO|performance|80|10|3|madvise|kyber|1024|1|on|bbr|100|3000|500|1|3|131072|0|512|20|16384"
echo "493|S|S_ADV_HUGE_ALWAYS_SERVIDOR|performance|5|10|3|always|kyber|1024|1|on|bbr|100|3000|500|0|3|786432|0|512|0|65536"
echo "494|S|S_ADV_VFS_MUY_BAJO_SERVIDOR|performance|5|10|3|madvise|kyber|1024|1|on|bbr|10|3000|500|0|3|786432|0|512|0|65536"
echo "495|S|S_ADV_SCHEDUTIL_GAMING_LATENCIA|schedutil|5|8|3|madvise|kyber|4096|1|on|bbr|50|1000|100|1|3|65536|0|128|0|65536"
echo "496|S|S_ADV_MINFREE_GIGANTE_POCA_RAM|performance|5|10|3|madvise|kyber|1024|1|on|bbr|100|3000|500|1|3|1048576|1|512|20|16384"
echo "497|S|S_ADV_COMPACTION_100_HPC|performance|5|10|3|madvise|kyber|4096|1|on|bbr|100|2000|200|0|3|524288|0|2048|100|65536"
echo "498|S|S_ADV_ZONE_RECLAIM_ESCRITORIO|schedutil|15|10|5|madvise|kyber|512|1|on|bbr|100|3000|500|1|1|131072|1|512|20|16384"
echo "499|S|S_ADV_PEOR_DE_CADA_GRUPO|powersave|100|40|20|never|deadline|32|0|off|reno|1000|30000|5000|0|0|1048576|4|16384|100|131072"

} # fin generate_profiles

# ══════════════════════════════════════════════════════════════════════════════
# MAIN — contar perfiles y arrancar
# ══════════════════════════════════════════════════════════════════════════════
TOTAL_DISPONIBLES=$(generate_profiles | wc -l)
TOTAL_EJECUTAR=$TOTAL_DISPONIBLES
[[ $SOLO_N -gt 0 ]] && TOTAL_EJECUTAR=$SOLO_N

TIEMPO_EST=$(( TOTAL_EJECUTAR * ( BENCH_TIEMPO * 2 + (BENCH_TIEMPO * 3) + 5) / 60 ))

log "${W}  Hardware:${NC} $CPU_MODEL — ${RAM_GB}GB RAM — $DISCO_NOMBRE"
log "${W}  Perfiles disponibles:${NC} $TOTAL_DISPONIBLES"
log "${W}  Perfiles a ejecutar:${NC}  $TOTAL_EJECUTAR"
log "${W}  Benchmark por prueba:${NC} ${BENCH_TIEMPO}s (sysbench×2 + fio×3)"
log "${W}  Tiempo estimado:${NC}      ~${TIEMPO_EST} minutos"
$SIN_DISCO && warn "  Disco: OMITIDO"
log ""

write_csv_header

IDX=0
P_OK=0
P_BLOCK=0
declare -A MAP_CPU
declare -A MAP_MEM

while IFS='|' read -r P_ID P_GRP P_NOM P_GOV P_SW P_DR P_DRB P_HUGE P_SCHED P_QD \
    P_NUMA P_IRQ P_TCP P_VFS P_DEXP P_DWB P_SAUTO P_TCPFO P_MF P_ZONE P_RA P_CO P_ND; do

    IDX=$((IDX + 1))
    [[ $IDX -gt $TOTAL_EJECUTAR ]] && break

    POLITICA=$(validate_policy "$P_DR" "$P_HUGE" "$P_NUMA")
    [[ "$POLITICA" != "OK" ]] && P_BLOCK=$((P_BLOCK+1))

    # Barra de progreso
    BD=$(( IDX * 40 / TOTAL_EJECUTAR ))
    BL=$(( 40 - BD ))
    BAR=$(printf '█%.0s' $(seq 1 $BD) 2>/dev/null)
    EMP=$(printf '░%.0s' $(seq 1 $BL) 2>/dev/null)
    PCT=$(( IDX * 100 / TOTAL_EJECUTAR ))
    [[ "$POLITICA" == "OK" ]] && CLR="$G" || CLR="$R"

    printf "\n${W}[%s%s] %3d%%${NC} #%03d [%s] ${CLR}%-40s${NC}\n" \
        "$BAR" "$EMP" "$PCT" "$IDX" "$P_GRP" "$P_NOM" | tee -a "$LOG"
    printf "  ${DIM}gov=%-12s swap=%-3s dr=%-2s/%-2s huge=%-8s sched=%-10s qd=%-4s vfs=%-4s tcp=%-5s ra=%-5s${NC}\n" \
        "$P_GOV" "$P_SW" "$P_DR" "$P_DRB" "$P_HUGE" "$P_SCHED" "$P_QD" "$P_VFS" "$P_TCP" "$P_RA" | tee -a "$LOG"

    apply_profile "$P_GOV" "$P_SW" "$P_DR" "$P_DRB" "$P_HUGE" "$P_SCHED" "$P_QD" \
        "$P_NUMA" "$P_IRQ" "$P_TCP" "$P_VFS" "$P_DEXP" "$P_DWB" "$P_SAUTO" \
        "$P_TCPFO" "$P_MF" "$P_ZONE" "$P_RA" "$P_CO" "$P_ND"

    printf "  ${DIM}CPU  %ds...${NC} " "$BENCH_TIEMPO" | tee -a "$LOG"
    CPU_B=$(bench_cpu)
    IFS='|' read -r eps cl cp <<< "$CPU_B"
    printf "${G}%s ev/s${NC}  lat=%s ms  p95=%s ms\n" "$eps" "$cl" "$cp" | tee -a "$LOG"

    printf "  ${DIM}MEM  5s...${NC} " | tee -a "$LOG"
    MEM_B=$(bench_mem)
    IFS='|' read -r mm ml <<< "$MEM_B"
    printf "${G}%s MiB/s${NC}  lat=%s ms\n" "$mm" "$ml" | tee -a "$LOG"

    if ! $SIN_DISCO; then
        printf "  ${DIM}DISK %ds×3...${NC} " "$BENCH_TIEMPO" | tee -a "$LOG"
        DISK_B=$(bench_disk)
        IFS='|' read -r ri rl rp rq wi wl sb <<< "$DISK_B"
        printf "${G}RR=%s IOPS${NC} lat=%sµs p95=%sµs | ${G}RW=%s IOPS${NC} | ${G}Seq=%s MB/s${NC}\n" \
            "$ri" "$rl" "$rp" "$wi" "$sb" | tee -a "$LOG"
    else
        DISK_B="N/A|N/A|N/A|N/A|N/A|N/A|N/A"
    fi

    write_row "$P_ID" "$P_GRP" "$P_NOM" "$POLITICA" \
        "$P_GOV" "$P_SW" "$P_DR" "$P_DRB" "$P_HUGE" "$P_SCHED" "$P_QD" "$P_NUMA" "$P_IRQ" "$P_TCP" \
        "$P_VFS" "$P_DEXP" "$P_DWB" "$P_SAUTO" "$P_TCPFO" "$P_MF" "$P_ZONE" "$P_RA" "$P_CO" "$P_ND" \
        "$CPU_B" "$MEM_B" "$DISK_B"

    MAP_CPU["$P_NOM"]="${eps}"
    MAP_MEM["$P_NOM"]="${mm}"

    restore_baseline
    sleep 1
    P_OK=$((P_OK+1))

done < <(generate_profiles)

# ── Reporte final ─────────────────────────────────────────────────────────────
{
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  Dix batch_5000 v2.0 — Informe Final                             ║"
echo "║  $(date '+%Y-%m-%d %H:%M:%S')                                    ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "  CPU:    $CPU_MODEL"
echo "  RAM:    ${RAM_GB}GB  |  Disco: $DISCO_NOMBRE"
echo "  Perfiles ejecutados:      $P_OK"
echo "  Perfiles bloqueados:      $P_BLOCK  (medidos como referencia negativa)"
echo "  Columnas CSV:             39"
echo "  Filas de datos:           $P_OK"
echo "  Puntos de datos totales:  $(( P_OK * 39 ))"
echo ""
echo "── TOP 5 CPU (events/sec) ───────────────────────────────────────"
for n in "${!MAP_CPU[@]}"; do echo "${MAP_CPU[$n]} $n"; done | \
    sort -rn 2>/dev/null | head -5 | while read v name; do
    printf "  %-45s %s ev/s\n" "$name" "$v"
done
echo ""
echo "── TOP 5 MEMORIA (MiB/s) ────────────────────────────────────────"
for n in "${!MAP_MEM[@]}"; do echo "${MAP_MEM[$n]} $n"; done | \
    sort -rn 2>/dev/null | head -5 | while read v name; do
    printf "  %-45s %s MiB/s\n" "$name" "$v"
done
echo ""
echo "── ARCHIVOS ─────────────────────────────────────────────────────"
echo "  CSV:     $CSV"
echo "  Log:     $LOG"
echo "  Informe: $REPORT"
echo ""
echo "  Para analizar resultados:"
echo "  python3 -c \"import csv,sys; rows=list(csv.DictReader(open('$CSV'))); print(f'{len(rows)} filas, {len(rows[0])} columnas')\""
echo ""
} | tee "$REPORT"

log ""
log "${G}COMPLETADO.${NC} ${W}$(( P_OK * 39 )) puntos de datos reales${NC} en: ${C}$RUN_DIR${NC}"
log ""

ln -sfn "$RUN_DIR" "$SALIDA_DIR/ultimo_run"
echo "$(date '+%Y-%m-%d %H:%M') | $P_OK perfiles | $(( P_OK * 39 )) datapoints | $RUN_DIR" >> "$SALIDA_DIR/historial_runs.log"
