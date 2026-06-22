#!/bin/bash
# Dix — Ruleta de Simulación
# Genera un PC aleatorio realista y lanza la app contra él
# Uso: ./roulette.sh [--seed N] [--escenario crisis|idle|fresh|gaming|server] [--dry-run]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_DIR=$(mktemp -d /tmp/dix_mock_XXXXXX)
trap "rm -rf $TMP_DIR" EXIT

# ── Colores ────────────────────────────────────────────────────────────────────
R='\033[0;31m' G='\033[0;32m' Y='\033[0;33m' B='\033[0;34m' M='\033[0;35m'
C='\033[0;36m' W='\033[1;37m' NC='\033[0m' DIM='\033[2m'

# ── Seed / escenario ───────────────────────────────────────────────────────────
SEED=""
ESCENARIO=""
DRY_RUN=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --seed) SEED="$2"; shift 2 ;;
        --escenario) ESCENARIO="$2"; shift 2 ;;
        --dry-run) DRY_RUN=true; shift ;;
        *) shift ;;
    esac
done

if [ -n "$SEED" ]; then
    RANDOM=$SEED
fi

# ── Helpers aleatorios ─────────────────────────────────────────────────────────
pick() {
    local arr=("$@")
    echo "${arr[$RANDOM % ${#arr[@]}]}"
}

rand_range() {
    echo $(( $1 + RANDOM % ($2 - $1 + 1) ))
}

# ── Generar perfil según escenario o aleatoriamente ───────────────────────────

case "$ESCENARIO" in

  crisis)
    # RAM crítica, carga altísima, todo mal configurado
    NOMBRE="PC en Crisis"
    ICON="🔥"
    CORES=$(pick 2 4 4)
    RAM_GB=$(pick 4 4 8)
    FREE_PCT=$(rand_range 5 15)
    GOVERNOR=$(pick "powersave" "ondemand" "conservative")
    SWAPPINESS=$(rand_range 80 100)
    DIRTY_RATIO=$(rand_range 30 40)
    DIRTY_BG=$(rand_range 15 25)
    SCHEDULER_RAW="cfq [deadline] noop"
    SCHEDULER_ACTIVE="deadline"
    DISK_TYPE="sda"
    QUEUE_DEPTH=$(pick 32 64 64)
    HUGEPAGES="[always] madvise never"
    NUMA="0"
    AUDIO=$(pick "pulseaudio" "unknown")
    IRQBALANCE=false
    LOAD_1=$(rand_range 8 16).$(rand_range 0 99)
    LOAD_5=$(rand_range 6 12).$(rand_range 0 99)
    LOAD_15=$(rand_range 4 8).$(rand_range 0 99)
    MIN_FREQ=400000
    MAX_FREQ=$(pick 1800000 2400000 2800000)
    ;;

  idle)
    # Todo bien configurado, carga mínima — poco que optimizar
    NOMBRE="PC Ocioso Bien Configurado"
    ICON="😴"
    CORES=$(pick 8 12 16)
    RAM_GB=$(pick 16 32 32)
    FREE_PCT=$(rand_range 70 90)
    GOVERNOR="performance"
    SWAPPINESS=$(rand_range 5 15)
    DIRTY_RATIO=$(rand_range 10 15)
    DIRTY_BG=$(rand_range 3 8)
    SCHEDULER_RAW="[kyber] mq-deadline none"
    SCHEDULER_ACTIVE="kyber"
    DISK_TYPE="nvme0n1"
    QUEUE_DEPTH=$(pick 256 512 1024)
    HUGEPAGES="always [madvise] never"
    NUMA="1"
    AUDIO="pipewire"
    IRQBALANCE=true
    LOAD_1=0.$(rand_range 10 40)
    LOAD_5=0.$(rand_range 10 30)
    LOAD_15=0.$(rand_range 5 20)
    MIN_FREQ=800000
    MAX_FREQ=$(pick 4800000 5200000 5600000)
    ;;

  fresh)
    # Instalación limpia, todo en valores por defecto del kernel
    NOMBRE="Linux Recien Instalado"
    ICON="🐧"
    CORES=$(pick 4 8 8 16)
    RAM_GB=$(pick 8 16 16 32)
    FREE_PCT=$(rand_range 50 75)
    GOVERNOR="powersave"
    SWAPPINESS=60
    DIRTY_RATIO=20
    DIRTY_BG=10
    SCHEDULER_RAW="mq-deadline [none] kyber"
    SCHEDULER_ACTIVE="none"
    DISK_TYPE=$(pick "nvme0n1" "sda")
    QUEUE_DEPTH=64
    HUGEPAGES="always [madvise] never"
    NUMA="1"
    AUDIO=$(pick "pipewire" "pulseaudio")
    IRQBALANCE=false
    LOAD_1=0.$(rand_range 30 80)
    LOAD_5=0.$(rand_range 20 60)
    LOAD_15=0.$(rand_range 10 40)
    MIN_FREQ=400000
    MAX_FREQ=$(pick 3200000 4000000 4800000)
    ;;

  gaming)
    # PC gaming con config mixta — algunas cosas bien, otras mal
    NOMBRE="PC Gaming Mejorable"
    ICON="🎮"
    CORES=$(pick 8 12 16 16 24)
    RAM_GB=$(pick 16 32 32)
    FREE_PCT=$(rand_range 35 60)
    GOVERNOR=$(pick "powersave" "schedutil" "ondemand")
    SWAPPINESS=$(rand_range 40 70)
    DIRTY_RATIO=$(rand_range 15 25)
    DIRTY_BG=$(rand_range 8 15)
    SCHEDULER_RAW="[mq-deadline] kyber none"
    SCHEDULER_ACTIVE="mq-deadline"
    DISK_TYPE="nvme0n1"
    QUEUE_DEPTH=$(pick 64 128 256)
    HUGEPAGES=$(pick "[always] madvise never" "always [madvise] never")
    NUMA=$(pick "0" "1")
    AUDIO="pipewire"
    IRQBALANCE=$(pick true false)
    LOAD_1=$(rand_range 2 6).$(rand_range 0 99)
    LOAD_5=$(rand_range 1 4).$(rand_range 0 99)
    LOAD_15=1.$(rand_range 0 99)
    MIN_FREQ=800000
    MAX_FREQ=$(pick 4800000 5200000 5600000 6000000)
    ;;

  server)
    # Servidor de producción
    NOMBRE="Servidor de Produccion"
    ICON="🖥️"
    CORES=$(pick 16 32 32 64)
    RAM_GB=$(pick 32 64 64 128)
    FREE_PCT=$(rand_range 25 55)
    GOVERNOR=$(pick "performance" "schedutil")
    SWAPPINESS=$(rand_range 5 20)
    DIRTY_RATIO=$(rand_range 30 50)
    DIRTY_BG=$(rand_range 3 10)
    SCHEDULER_RAW="[kyber] mq-deadline none"
    SCHEDULER_ACTIVE="kyber"
    DISK_TYPE="nvme0n1"
    QUEUE_DEPTH=$(pick 512 1024 2048)
    HUGEPAGES=$(pick "[always] madvise never" "always [madvise] never")
    NUMA="1"
    AUDIO="unknown"
    IRQBALANCE=true
    LOAD_1=$(rand_range 5 20).$(rand_range 0 99)
    LOAD_5=$(rand_range 4 18).$(rand_range 0 99)
    LOAD_15=$(rand_range 3 15).$(rand_range 0 99)
    MIN_FREQ=1200000
    MAX_FREQ=$(pick 3200000 3800000 4200000)
    ;;

  *)
    # Totalmente aleatorio
    NOMBRE="PC Aleatorio"
    ICON="🎲"
    CORES=$(pick 2 4 4 6 8 8 12 16 24 32)
    RAM_GB=$(pick 4 8 8 16 16 32 64 128)
    FREE_PCT=$(rand_range 10 85)
    GOVERNOR=$(pick "performance" "powersave" "ondemand" "conservative" "schedutil" "schedutil")
    SWAPPINESS=$(rand_range 1 100)
    DIRTY_RATIO=$(rand_range 5 50)
    DIRTY_BG=$(rand_range 2 20)
    DISK_TYPE=$(pick "nvme0n1" "nvme0n1" "sda" "nvme1n1")
    if [[ "$DISK_TYPE" == "sda" ]]; then
        SCHEDULER_RAW=$(pick "cfq [deadline] noop" "[bfq] mq-deadline" "mq-deadline [none]")
        SCHEDULER_ACTIVE=$(echo "$SCHEDULER_RAW" | grep -o '\[.*\]' | tr -d '[]')
    else
        SCHEDULER_RAW=$(pick "[kyber] mq-deadline none" "mq-deadline [none] kyber" "[mq-deadline] kyber none" "[none] kyber mq-deadline")
        SCHEDULER_ACTIVE=$(echo "$SCHEDULER_RAW" | grep -o '\[.*\]' | tr -d '[]')
    fi
    QUEUE_DEPTH=$(pick 32 64 64 128 256 512 1024)
    HUGEPAGES=$(pick "[always] madvise never" "always [madvise] never" "always madvise [never]")
    NUMA=$(pick "0" "1" "1")
    AUDIO=$(pick "pipewire" "pipewire" "pulseaudio" "unknown")
    IRQBALANCE=$(pick true false true)
    LOAD_1=$(rand_range 0 15).$(rand_range 0 99)
    LOAD_5=$(rand_range 0 12).$(rand_range 0 99)
    LOAD_15=$(rand_range 0 10).$(rand_range 0 99)
    MIN_FREQ=$(pick 400000 800000 1200000 1600000)
    MAX_FREQ=$(pick 1800000 2400000 3200000 4000000 4800000 5200000 6000000)
    ;;
esac

# ── Calcular valores derivados ─────────────────────────────────────────────────
RAM_KB=$((RAM_GB * 1024 * 1024))
AVAIL_KB=$((RAM_KB * FREE_PCT / 100))
FREE_KB=$((AVAIL_KB - RAM_KB / 10))
[ $FREE_KB -lt 0 ] && FREE_KB=102400
PROCS=$((RANDOM % 800 + 100))
PID=$((RANDOM % 50000 + 10000))
MIN_MHZ=$((MIN_FREQ / 1000))
MAX_MHZ=$((MAX_FREQ / 1000))

# ── Construir árbol de ficheros mock ──────────────────────────────────────────
mkdir -p $TMP_DIR/{proc/sys/vm,proc/sys/kernel}
mkdir -p $TMP_DIR/sys/devices/system/cpu/cpu0/cpufreq
mkdir -p $TMP_DIR/sys/block/$DISK_TYPE/queue
mkdir -p $TMP_DIR/sys/kernel/mm/transparent_hugepage
mkdir -p $TMP_DIR/mock/services

# Crear directorios de cores CPU
for i in $(seq 0 $((CORES - 1))); do
    mkdir -p $TMP_DIR/sys/devices/system/cpu/cpu$i
done

# CPU
echo "$GOVERNOR"          > $TMP_DIR/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor
echo "$MIN_FREQ"          > $TMP_DIR/sys/devices/system/cpu/cpu0/cpufreq/scaling_min_freq
echo "$MAX_FREQ"          > $TMP_DIR/sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq

# Disco
echo "$SCHEDULER_RAW"    > $TMP_DIR/sys/block/$DISK_TYPE/queue/scheduler
echo "$QUEUE_DEPTH"      > $TMP_DIR/sys/block/$DISK_TYPE/queue/nr_requests

# Memoria virtual
echo "$SWAPPINESS"       > $TMP_DIR/proc/sys/vm/swappiness
echo "$DIRTY_RATIO"      > $TMP_DIR/proc/sys/vm/dirty_ratio
echo "$DIRTY_BG"         > $TMP_DIR/proc/sys/vm/dirty_background_ratio

# Kernel
echo "$NUMA"             > $TMP_DIR/proc/sys/kernel/numa_balancing
echo "$HUGEPAGES"        > $TMP_DIR/sys/kernel/mm/transparent_hugepage/enabled

# meminfo
printf "MemTotal:       %8d kB\nMemFree:        %8d kB\nMemAvailable:   %8d kB\nBuffers:          512000 kB\nCached:          2048000 kB\n" \
    $RAM_KB $FREE_KB $AVAIL_KB > $TMP_DIR/proc/meminfo

# loadavg
echo "$LOAD_1 $LOAD_5 $LOAD_15 $((RANDOM % 20 + 1))/$PROCS $PID" > $TMP_DIR/proc/loadavg

# Audio y servicios
echo "$AUDIO" > $TMP_DIR/mock/audio_server
if [ "$IRQBALANCE" = true ]; then
    touch $TMP_DIR/mock/services/irqbalance
fi

# ── Ficha del PC simulado ──────────────────────────────────────────────────────
clear
echo ""
echo -e "${W}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${W}║        Dix — Ruleta de Simulacion               ║${NC}"
echo -e "${W}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${C}Escenario:${NC} ${W}${NOMBRE}${NC}"
[ -n "$SEED" ] && echo -e "  ${DIM}Seed: $SEED${NC}"
[ -n "$ESCENARIO" ] && echo -e "  ${DIM}Perfil forzado: $ESCENARIO${NC}"
echo ""
echo -e "  ${Y}┌─ CPU ─────────────────────────────────────────────────────┐${NC}"
echo -e "  ${Y}│${NC}  Cores:     ${W}${CORES}${NC}"
echo -e "  ${Y}│${NC}  Governor:  $([ "$GOVERNOR" = "performance" ] && echo "${G}${GOVERNOR}${NC}" || echo "${R}${GOVERNOR}${NC}")"
echo -e "  ${Y}│${NC}  Freq:      ${W}${MIN_MHZ} MHz — ${MAX_MHZ} MHz${NC}"
echo -e "  ${Y}└───────────────────────────────────────────────────────────┘${NC}"
echo ""
echo -e "  ${B}┌─ MEMORIA ─────────────────────────────────────────────────┐${NC}"
echo -e "  ${B}│${NC}  RAM total:   ${W}${RAM_GB} GB${NC}"
echo -e "  ${B}│${NC}  Disponible:  ${W}${FREE_PCT}%${NC}  ($((AVAIL_KB / 1024)) MB)"
echo -e "  ${B}│${NC}  Swappiness:  $([ $SWAPPINESS -le 20 ] && echo "${G}${SWAPPINESS}${NC}" || ([ $SWAPPINESS -ge 60 ] && echo "${R}${SWAPPINESS}${NC}" || echo "${Y}${SWAPPINESS}${NC}"))"
echo -e "  ${B}│${NC}  Dirty ratio: ${W}${DIRTY_RATIO} / ${DIRTY_BG}${NC}"
echo -e "  ${B}└───────────────────────────────────────────────────────────┘${NC}"
echo ""
echo -e "  ${M}┌─ ALMACENAMIENTO ──────────────────────────────────────────┐${NC}"
echo -e "  ${M}│${NC}  Dispositivo: ${W}${DISK_TYPE}${NC}"
echo -e "  ${M}│${NC}  Scheduler:   ${W}${SCHEDULER_ACTIVE}${NC}"
echo -e "  ${M}│${NC}  Queue depth: ${W}${QUEUE_DEPTH}${NC}"
echo -e "  ${M}└───────────────────────────────────────────────────────────┘${NC}"
echo ""
echo -e "  ${C}┌─ SISTEMA ─────────────────────────────────────────────────┐${NC}"
echo -e "  ${C}│${NC}  Hugepages:   ${W}$(echo $HUGEPAGES | grep -o '\[.*\]' | tr -d '[]')${NC}"
echo -e "  ${C}│${NC}  NUMA:        $([ "$NUMA" = "1" ] && echo "${G}activo${NC}" || echo "${R}inactivo${NC}")"
echo -e "  ${C}│${NC}  IRQBalance:  $([ "$IRQBALANCE" = true ] && echo "${G}activo${NC}" || echo "${R}inactivo${NC}")"
echo -e "  ${C}│${NC}  Audio:       ${W}${AUDIO}${NC}"
echo -e "  ${C}│${NC}  Carga:       ${W}${LOAD_1} ${LOAD_5} ${LOAD_15}${NC}"
echo -e "  ${C}└───────────────────────────────────────────────────────────┘${NC}"
echo ""
echo -e "  ${DIM}Perfil temporal: $TMP_DIR${NC}"
echo ""
echo -e "${W}  Lanzando Dix...${NC}"
echo -e "${DIM}  (el perfil se borra al cerrar la app)${NC}"
echo ""

# ── Lanzar la app o mostrar dry-run ───────────────────────────────────────────
export DIX_SYS_ROOT="$TMP_DIR"
cd "$SCRIPT_DIR"

if [ "$DRY_RUN" = true ]; then
    echo -e "${W}  Modo dry-run — JSON que recibiria Claude:${NC}"
    echo ""
    cat <<JSON
{
  "cpu_governor":            "$GOVERNOR",
  "cpu_cores":               $CORES,
  "cpu_min_freq_mhz":        $MIN_MHZ,
  "cpu_max_freq_mhz":        $MAX_MHZ,
  "swappiness":              $SWAPPINESS,
  "dirty_ratio":             $DIRTY_RATIO,
  "dirty_background_ratio":  $DIRTY_BG,
  "disk_scheduler":          "$(echo $SCHEDULER_RAW | grep -o '\[.*\]' | tr -d '[]')",
  "nvme_queue_depth":        "$QUEUE_DEPTH",
  "hugepages":               "$(echo $HUGEPAGES | grep -o '\[.*\]' | tr -d '[]')",
  "numa_balancing":          "$NUMA",
  "audio_server":            "$AUDIO",
  "irqbalance_active":       $IRQBALANCE,
  "mem_total_mb":            $((RAM_KB / 1024)),
  "mem_available_mb":        $((AVAIL_KB / 1024)),
  "load_avg":                "$LOAD_1 $LOAD_5 $LOAD_15"
}
JSON
    echo ""
    echo -e "${DIM}  (usa sin --dry-run para lanzar la app)${NC}"
else
    DISPLAY=:0 /usr/bin/dix-pro
fi
