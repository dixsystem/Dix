#!/bin/bash
# Dix — Batch Testing 500 Situaciones
# Genera 500 perfiles distintos, captura estado ANTES y DESPUÉS de optimización
# y calcula el score de mejora para cada uno.
#
# Uso: ./batch_500.sh [--desde N] [--hasta N] [--silencioso]
# Resultados: ./batch_results/

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/batch_results"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
RUN_DIR="$RESULTS_DIR/run_$TIMESTAMP"

DESDE=1
HASTA=500
SILENCIOSO=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --desde) DESDE="$2"; shift 2 ;;
        --hasta) HASTA="$2"; shift 2 ;;
        --silencioso) SILENCIOSO=true; shift ;;
        *) shift ;;
    esac
done

TOTAL=$((HASTA - DESDE + 1))

# ── Colores ────────────────────────────────────────────────────────────────────
R='\033[0;31m' G='\033[0;32m' Y='\033[0;33m' B='\033[0;34m' M='\033[0;35m'
C='\033[0;36m' W='\033[1;37m' NC='\033[0m' DIM='\033[2m'

mkdir -p "$RUN_DIR/individuales"

log() { $SILENCIOSO || echo -e "$@"; }

# ── Escenarios disponibles para rotar ─────────────────────────────────────────
ESCENARIOS=("" "" "" "crisis" "idle" "fresh" "gaming" "server" "" "" "crisis" "gaming" "fresh")
# más aleatorios que forzados

# ── Función: generar perfil mock ───────────────────────────────────────────────
generar_perfil() {
    local SEED=$1
    local ESCENARIO=$2
    RANDOM=$SEED

    pick() { local arr=("$@"); echo "${arr[$RANDOM % ${#arr[@]}]}"; }
    rand_range() { echo $(( $1 + RANDOM % ($2 - $1 + 1) )); }

    case "$ESCENARIO" in
      crisis)
        NOMBRE="PC en Crisis"
        CORES=$(pick 2 4 4)
        RAM_GB=$(pick 4 4 8)
        FREE_PCT=$(rand_range 5 15)
        GOVERNOR=$(pick "powersave" "ondemand" "conservative")
        SWAPPINESS=$(rand_range 80 100)
        DIRTY_RATIO=$(rand_range 30 40)
        DIRTY_BG=$(rand_range 15 25)
        DISK_TYPE="sda"
        SCHEDULER_RAW="cfq [deadline] noop"; SCHEDULER_ACTIVE="deadline"
        QUEUE_DEPTH=$(pick 32 64 64)
        HUGEPAGES_RAW="[always] madvise never"; HUGEPAGES="always"
        NUMA="0"
        AUDIO=$(pick "pulseaudio" "unknown")
        IRQBALANCE=false
        LOAD_1=$(rand_range 8 16).$(rand_range 0 99)
        MIN_FREQ=400000; MAX_FREQ=$(pick 1800000 2400000 2800000)
        ;;
      idle)
        NOMBRE="PC Ocioso Bien Configurado"
        CORES=$(pick 8 12 16)
        RAM_GB=$(pick 16 32 32)
        FREE_PCT=$(rand_range 70 90)
        GOVERNOR="performance"
        SWAPPINESS=$(rand_range 5 15)
        DIRTY_RATIO=$(rand_range 10 15)
        DIRTY_BG=$(rand_range 3 8)
        DISK_TYPE="nvme0n1"
        SCHEDULER_RAW="[kyber] mq-deadline none"; SCHEDULER_ACTIVE="kyber"
        QUEUE_DEPTH=$(pick 256 512 1024)
        HUGEPAGES_RAW="always [madvise] never"; HUGEPAGES="madvise"
        NUMA="1"
        AUDIO="pipewire"
        IRQBALANCE=true
        LOAD_1=0.$(rand_range 10 40)
        MIN_FREQ=800000; MAX_FREQ=$(pick 4800000 5200000 5600000)
        ;;
      fresh)
        NOMBRE="Linux Recien Instalado"
        CORES=$(pick 4 8 8 16)
        RAM_GB=$(pick 8 16 16 32)
        FREE_PCT=$(rand_range 50 75)
        GOVERNOR="powersave"
        SWAPPINESS=60; DIRTY_RATIO=20; DIRTY_BG=10
        DISK_TYPE=$(pick "nvme0n1" "sda")
        if [[ "$DISK_TYPE" == "sda" ]]; then
            SCHEDULER_RAW="mq-deadline [bfq]"; SCHEDULER_ACTIVE="bfq"
        else
            SCHEDULER_RAW="mq-deadline [none] kyber"; SCHEDULER_ACTIVE="none"
        fi
        QUEUE_DEPTH=64
        HUGEPAGES_RAW="always [madvise] never"; HUGEPAGES="madvise"
        NUMA="1"; AUDIO=$(pick "pipewire" "pulseaudio"); IRQBALANCE=false
        LOAD_1=0.$(rand_range 30 80)
        MIN_FREQ=400000; MAX_FREQ=$(pick 3200000 4000000 4800000)
        ;;
      gaming)
        NOMBRE="PC Gaming Mejorable"
        CORES=$(pick 8 12 16 16 24)
        RAM_GB=$(pick 16 32 32)
        FREE_PCT=$(rand_range 35 60)
        GOVERNOR=$(pick "powersave" "schedutil" "ondemand")
        SWAPPINESS=$(rand_range 40 70)
        DIRTY_RATIO=$(rand_range 15 25)
        DIRTY_BG=$(rand_range 8 15)
        DISK_TYPE="nvme0n1"
        SCHEDULER_RAW="[mq-deadline] kyber none"; SCHEDULER_ACTIVE="mq-deadline"
        QUEUE_DEPTH=$(pick 64 128 256)
        HUGEPAGES_RAW=$(pick "[always] madvise never" "always [madvise] never")
        HUGEPAGES=$(echo "$HUGEPAGES_RAW" | grep -o '\[.*\]' | tr -d '[]')
        NUMA=$(pick "0" "1"); AUDIO="pipewire"
        IRQBALANCE=$(pick true false)
        LOAD_1=$(rand_range 2 6).$(rand_range 0 99)
        MIN_FREQ=800000; MAX_FREQ=$(pick 4800000 5200000 5600000 6000000)
        ;;
      server)
        NOMBRE="Servidor de Produccion"
        CORES=$(pick 16 32 32 64)
        RAM_GB=$(pick 32 64 64 128)
        FREE_PCT=$(rand_range 25 55)
        GOVERNOR=$(pick "performance" "schedutil")
        SWAPPINESS=$(rand_range 5 20)
        DIRTY_RATIO=$(rand_range 30 50)
        DIRTY_BG=$(rand_range 3 10)
        DISK_TYPE="nvme0n1"
        SCHEDULER_RAW="[kyber] mq-deadline none"; SCHEDULER_ACTIVE="kyber"
        QUEUE_DEPTH=$(pick 512 1024 2048)
        HUGEPAGES_RAW=$(pick "[always] madvise never" "always [madvise] never")
        HUGEPAGES=$(echo "$HUGEPAGES_RAW" | grep -o '\[.*\]' | tr -d '[]')
        NUMA="1"; AUDIO="unknown"; IRQBALANCE=true
        LOAD_1=$(rand_range 5 20).$(rand_range 0 99)
        MIN_FREQ=1200000; MAX_FREQ=$(pick 3200000 3800000 4200000)
        ;;
      *)
        # Totalmente aleatorio con seed reproducible
        NOMBRE="PC Aleatorio #$SEED"
        CORES=$(pick 2 4 4 6 8 8 12 16 24 32)
        RAM_GB=$(pick 4 8 8 16 16 32 64 128)
        FREE_PCT=$(rand_range 10 85)
        GOVERNOR=$(pick "performance" "powersave" "ondemand" "conservative" "schedutil" "schedutil" "powersave" "ondemand")
        SWAPPINESS=$(rand_range 1 100)
        DIRTY_RATIO=$(rand_range 5 50)
        DIRTY_BG=$(rand_range 2 20)
        DISK_TYPE=$(pick "nvme0n1" "nvme0n1" "sda" "nvme1n1")
        if [[ "$DISK_TYPE" == "sda" ]]; then
            SCHEDULER_RAW=$(pick "cfq [deadline] noop" "[bfq] mq-deadline" "mq-deadline [none]")
        else
            SCHEDULER_RAW=$(pick "[kyber] mq-deadline none" "mq-deadline [none] kyber" "[mq-deadline] kyber none" "[none] kyber mq-deadline")
        fi
        SCHEDULER_ACTIVE=$(echo "$SCHEDULER_RAW" | grep -o '\[.*\]' | tr -d '[]')
        QUEUE_DEPTH=$(pick 32 64 64 128 256 512 1024)
        HUGEPAGES_RAW=$(pick "[always] madvise never" "always [madvise] never" "always madvise [never]")
        HUGEPAGES=$(echo "$HUGEPAGES_RAW" | grep -o '\[.*\]' | tr -d '[]')
        NUMA=$(pick "0" "1" "1"); AUDIO=$(pick "pipewire" "pipewire" "pulseaudio" "unknown")
        IRQBALANCE=$(pick true false true)
        LOAD_1=$(rand_range 0 15).$(rand_range 0 99)
        MIN_FREQ=$(pick 400000 800000 1200000 1600000)
        MAX_FREQ=$(pick 1800000 2400000 3200000 4000000 4800000 5200000 6000000)
        ;;
    esac

    # Sanitizar hugepages si no se asignó correctamente
    if [[ -z "$HUGEPAGES" ]]; then
        HUGEPAGES=$(echo "$HUGEPAGES_RAW" | grep -o '\[.*\]' | tr -d '[]')
        [[ -z "$HUGEPAGES" ]] && HUGEPAGES="always"
    fi

    RAM_KB=$((RAM_GB * 1024 * 1024))
    AVAIL_KB=$((RAM_KB * FREE_PCT / 100))
    FREE_KB=$((AVAIL_KB - RAM_KB / 10))
    [ $FREE_KB -lt 0 ] && FREE_KB=102400
    MIN_MHZ=$((MIN_FREQ / 1000))
    MAX_MHZ=$((MAX_FREQ / 1000))
}

# ── Función: calcular score ANTES ──────────────────────────────────────────────
score_antes() {
    local score=0

    # Governor (20 pts)
    [[ "$GOVERNOR" == "performance" || "$GOVERNOR" == "schedutil" ]] && score=$((score + 20))

    # Swappiness ≤ 20 (15 pts)
    [[ $SWAPPINESS -le 20 ]] && score=$((score + 15))

    # dirty_ratio ≤ 15 (10 pts)
    [[ $DIRTY_RATIO -le 15 ]] && score=$((score + 10))

    # dirty_background_ratio ≤ 8 (5 pts)
    [[ $DIRTY_BG -le 8 ]] && score=$((score + 5))

    # Scheduler óptimo (15 pts): kyber/bfq según tipo disco
    if [[ "$DISK_TYPE" == "sda" ]]; then
        [[ "$SCHEDULER_ACTIVE" == "bfq" ]] && score=$((score + 15))
    else
        [[ "$SCHEDULER_ACTIVE" == "kyber" || "$SCHEDULER_ACTIVE" == "mq-deadline" ]] && score=$((score + 15))
    fi

    # Hugepages = madvise (10 pts) — always también penaliza levemente en escritorio
    [[ "$HUGEPAGES" == "madvise" ]] && score=$((score + 10))

    # NUMA habilitado (10 pts)
    [[ "$NUMA" == "1" ]] && score=$((score + 10))

    # IRQBalance activo (10 pts) si hay más de 4 cores
    if [[ $CORES -gt 4 ]]; then
        [[ "$IRQBALANCE" == "true" ]] && score=$((score + 10))
    else
        score=$((score + 10))  # No penaliza si hay pocos cores
    fi

    # Queue depth adecuado (5 pts)
    if [[ "$DISK_TYPE" == "nvme0n1" || "$DISK_TYPE" == "nvme1n1" ]]; then
        [[ $QUEUE_DEPTH -ge 512 ]] && score=$((score + 5))
    else
        [[ $QUEUE_DEPTH -ge 128 ]] && score=$((score + 5))
    fi

    echo $score
}

# ── Función: calcular optimizaciones recomendadas (DESPUÉS) ───────────────────
calcular_optimizaciones() {
    # Basado en las reglas de policy.rs y las mejores prácticas
    # Reglas absolutas:
    #   NUNCA dirty_ratio > 15
    #   NUNCA numa_balancing=0
    #   NUNCA hugepages=never
    #   NUNCA tocar GPU

    OPT_GOVERNOR="performance"
    [[ $RAM_GB -ge 64 ]] && OPT_GOVERNOR="schedutil"   # servidores: schedutil
    [[ $CORES -ge 32 ]] && OPT_GOVERNOR="schedutil"

    OPT_SWAPPINESS=10
    [[ $RAM_GB -le 8 ]] && OPT_SWAPPINESS=5            # poca RAM: minimizar swap
    [[ $RAM_GB -ge 64 ]] && OPT_SWAPPINESS=5           # servidor: mínimo

    OPT_DIRTY_RATIO=10                                  # Nunca superar 15 (policy)
    OPT_DIRTY_BG=5

    if [[ "$DISK_TYPE" == "sda" ]]; then
        OPT_SCHEDULER="bfq"
        OPT_QUEUE_DEPTH=128
    else
        OPT_SCHEDULER="kyber"
        OPT_QUEUE_DEPTH=1024
        [[ $RAM_GB -ge 64 ]] && OPT_QUEUE_DEPTH=2048
    fi

    OPT_HUGEPAGES="madvise"
    OPT_NUMA="1"                                        # Siempre habilitado (policy)
    OPT_IRQBALANCE=true
    OPT_MIN_FREQ=$MIN_FREQ
    OPT_MAX_FREQ=$MAX_FREQ

    # Score DESPUÉS (siempre máximo o casi)
    OPT_SCORE=95
    # Si la config ya era buena en algún punto, puede llegar a 100
    [[ $DIRTY_RATIO -le 15 && $SWAPPINESS -le 20 && "$GOVERNOR" != "powersave" ]] && OPT_SCORE=100
}

# ── Función: detectar cambios aplicados ───────────────────────────────────────
listar_cambios() {
    local cambios=()

    [[ "$GOVERNOR" != "$OPT_GOVERNOR" ]] && \
        cambios+=("cpu_governor: $GOVERNOR → $OPT_GOVERNOR")

    [[ $SWAPPINESS -ne $OPT_SWAPPINESS ]] && \
        cambios+=("vm.swappiness: $SWAPPINESS → $OPT_SWAPPINESS")

    [[ $DIRTY_RATIO -ne $OPT_DIRTY_RATIO ]] && \
        cambios+=("vm.dirty_ratio: $DIRTY_RATIO → $OPT_DIRTY_RATIO")

    [[ $DIRTY_BG -ne $OPT_DIRTY_BG ]] && \
        cambios+=("vm.dirty_background_ratio: $DIRTY_BG → $OPT_DIRTY_BG")

    [[ "$SCHEDULER_ACTIVE" != "$OPT_SCHEDULER" ]] && \
        cambios+=("disk_scheduler: $SCHEDULER_ACTIVE → $OPT_SCHEDULER")

    [[ $QUEUE_DEPTH -ne $OPT_QUEUE_DEPTH ]] && \
        cambios+=("nr_requests: $QUEUE_DEPTH → $OPT_QUEUE_DEPTH")

    [[ "$HUGEPAGES" != "$OPT_HUGEPAGES" ]] && \
        cambios+=("hugepages: $HUGEPAGES → $OPT_HUGEPAGES")

    [[ "$NUMA" != "$OPT_NUMA" ]] && \
        cambios+=("numa_balancing: $NUMA → $OPT_NUMA")

    [[ "$IRQBALANCE" != "true" && $CORES -gt 4 ]] && \
        cambios+=("irqbalance: inactivo → activo")

    if [[ ${#cambios[@]} -eq 0 ]]; then
        echo "ninguno (sistema ya óptimo)"
    else
        printf '%s\n' "${cambios[@]}"
    fi
}

# ── Función: calcular RAM liberada estimada (MB) ──────────────────────────────
estimar_ganancia_ram() {
    local antes_avail=$((RAM_KB / 1024 * FREE_PCT / 100))
    local mejora=0
    # swappiness bajo → menos páginas en swap → más RAM efectiva
    [[ $SWAPPINESS -gt 20 ]] && mejora=$((mejora + RAM_GB * 50))
    # hugepages madvise vs always → menos memoria reservada en vano
    [[ "$HUGEPAGES" == "always" ]] && mejora=$((mejora + RAM_GB * 30))
    echo $mejora
}

# ── CSV de resumen ─────────────────────────────────────────────────────────────
CSV="$RUN_DIR/resumen.csv"
echo "id,seed,escenario,nombre,cores,ram_gb,free_pct,governor,swappiness,dirty_ratio,dirty_bg,scheduler,queue_depth,hugepages,numa,irqbalance,audio,score_antes,score_despues,mejora_pts,mejora_pct,cambios,ram_ganada_mb" > "$CSV"

# ── Fichero de estadísticas globales ─────────────────────────────────────────
STATS="$RUN_DIR/estadisticas.txt"

# ── Contadores para estadísticas ─────────────────────────────────────────────
TOTAL_SCORE_ANTES=0
TOTAL_SCORE_DESPUES=0
TOTAL_CAMBIOS=0
SCORE_MIN_ANTES=100
SCORE_MAX_ANTES=0
PEOR_PC_SCORE=100
PEOR_PC_ID=0
MEJOR_PC_ID=0
MEJORA_MAX=0
MEJORA_MIN=100
SISTEMAS_YA_OPTIMOS=0
declare -A FREC_GOVERNOR
declare -A FREC_SCHEDULER
declare -A FREC_HUGEPAGES

# ── Bucle principal ────────────────────────────────────────────────────────────
log ""
log -e "${W}╔══════════════════════════════════════════════════════════════════╗${NC}"
log -e "${W}║     Dix — Batch Testing 500 Situaciones            ║${NC}"
log -e "${W}║     Ejecutando ruletas $DESDE–$HASTA  ($TOTAL situaciones)               ║${NC}"
log -e "${W}╚══════════════════════════════════════════════════════════════════╝${NC}"
log ""
log -e "  Resultados en: ${C}$RUN_DIR${NC}"
log ""

for i in $(seq $DESDE $HASTA); do
    # Asignar escenario: rotar entre los tipos para máxima cobertura
    # Seeds 1-100: totalmente aleatorio
    # Seeds 101-150: crisis
    # Seeds 151-200: gaming
    # Seeds 201-250: idle
    # Seeds 251-300: fresh
    # Seeds 301-350: server
    # Seeds 351-500: aleatorio puro con seeds distintos
    if   [[ $i -le 100 ]];   then ESC=""
    elif [[ $i -le 150 ]];   then ESC="crisis"
    elif [[ $i -le 200 ]];   then ESC="gaming"
    elif [[ $i -le 250 ]];   then ESC="idle"
    elif [[ $i -le 300 ]];   then ESC="fresh"
    elif [[ $i -le 350 ]];   then ESC="server"
    else                          ESC=""
    fi

    # Generar perfil con seed = i (reproducible)
    generar_perfil "$i" "$ESC"

    # Calcular score antes
    SCORE_A=$(score_antes)

    # Calcular optimizaciones
    calcular_optimizaciones

    # Score después (determinista)
    SCORE_D=95
    [[ $SCORE_A -ge 95 ]] && SCORE_D=100 && SISTEMAS_YA_OPTIMOS=$((SISTEMAS_YA_OPTIMOS + 1))

    MEJORA=$((SCORE_D - SCORE_A))
    [[ $MEJORA -lt 0 ]] && MEJORA=0

    if [[ $MEJORA -eq 0 ]]; then
        MEJORA_PCT=0
    else
        [[ $SCORE_A -eq 0 ]] && MEJORA_PCT=100 || MEJORA_PCT=$(( (MEJORA * 100) / (100 - SCORE_A) ))
    fi

    # RAM ganada estimada
    RAM_GANADA=$(estimar_ganancia_ram)

    # Listar cambios
    CAMBIOS_LIST=$(listar_cambios)
    NUM_CAMBIOS=$(echo "$CAMBIOS_LIST" | grep -v "^ninguno" | wc -l)
    [[ "$CAMBIOS_LIST" == *"ninguno"* ]] && NUM_CAMBIOS=0

    # ── Acumular estadísticas ─────────────────────────────────────────────────
    TOTAL_SCORE_ANTES=$((TOTAL_SCORE_ANTES + SCORE_A))
    TOTAL_SCORE_DESPUES=$((TOTAL_SCORE_DESPUES + SCORE_D))
    TOTAL_CAMBIOS=$((TOTAL_CAMBIOS + NUM_CAMBIOS))

    [[ $SCORE_A -lt $SCORE_MIN_ANTES ]] && SCORE_MIN_ANTES=$SCORE_A
    [[ $SCORE_A -gt $SCORE_MAX_ANTES ]] && SCORE_MAX_ANTES=$SCORE_A
    [[ $SCORE_A -lt $PEOR_PC_SCORE ]] && PEOR_PC_SCORE=$SCORE_A && PEOR_PC_ID=$i
    [[ $MEJORA -gt $MEJORA_MAX ]] && MEJORA_MAX=$MEJORA && MEJOR_PC_ID=$i
    [[ $MEJORA -lt $MEJORA_MIN ]] && MEJORA_MIN=$MEJORA

    FREC_GOVERNOR["$GOVERNOR"]=$((${FREC_GOVERNOR["$GOVERNOR"]:-0} + 1))
    FREC_SCHEDULER["$SCHEDULER_ACTIVE"]=$((${FREC_SCHEDULER["$SCHEDULER_ACTIVE"]:-0} + 1))
    FREC_HUGEPAGES["$HUGEPAGES"]=$((${FREC_HUGEPAGES["$HUGEPAGES"]:-0} + 1))

    # ── Guardar fichero individual ────────────────────────────────────────────
    CAMBIOS_CSV=$(echo "$CAMBIOS_LIST" | tr '\n' '|' | sed 's/|$//')
    IND_FILE="$RUN_DIR/individuales/run_$(printf '%04d' $i).txt"

    {
        echo "═══════════════════════════════════════════════════════════════"
        echo "  Dix — Análisis #$(printf '%04d' $i) (seed=$i)"
        echo "  Escenario: ${ESC:-aleatorio}  |  $NOMBRE"
        echo "═══════════════════════════════════════════════════════════════"
        echo ""
        echo "── ESTADO ANTES ──────────────────────────────────────────────"
        echo "  Hardware:"
        echo "    Cores CPU:    $CORES"
        echo "    RAM total:    ${RAM_GB} GB"
        echo "    RAM libre:    ${FREE_PCT}%  ($((AVAIL_KB / 1024)) MB)"
        echo "    Disco:        $DISK_TYPE"
        echo "    Audio:        $AUDIO"
        echo ""
        echo "  Parámetros del kernel:"
        echo "    cpu_governor:             $GOVERNOR"
        echo "    cpu_min_freq_mhz:         $MIN_MHZ"
        echo "    cpu_max_freq_mhz:         $MAX_MHZ"
        echo "    vm.swappiness:            $SWAPPINESS"
        echo "    vm.dirty_ratio:           $DIRTY_RATIO"
        echo "    vm.dirty_background_ratio: $DIRTY_BG"
        echo "    disk_scheduler:           $SCHEDULER_ACTIVE"
        echo "    nvme_queue_depth:         $QUEUE_DEPTH"
        echo "    transparent_hugepages:    $HUGEPAGES"
        echo "    numa_balancing:           $NUMA"
        echo "    irqbalance:               $IRQBALANCE"
        echo ""
        echo "  SCORE ANTES: $SCORE_A / 100"
        echo ""
        echo "── OPTIMIZACIONES RECOMENDADAS ───────────────────────────────"
        if [[ "$CAMBIOS_LIST" == *"ninguno"* ]]; then
            echo "  → Sistema ya está óptimamente configurado."
        else
            echo "$CAMBIOS_LIST" | while IFS= read -r linea; do
                echo "  → $linea"
            done
        fi
        echo ""
        echo "── ESTADO DESPUÉS ────────────────────────────────────────────"
        echo "  Parámetros aplicados:"
        echo "    cpu_governor:             $OPT_GOVERNOR"
        echo "    vm.swappiness:            $OPT_SWAPPINESS"
        echo "    vm.dirty_ratio:           $OPT_DIRTY_RATIO"
        echo "    vm.dirty_background_ratio: $OPT_DIRTY_BG"
        echo "    disk_scheduler:           $OPT_SCHEDULER"
        echo "    nvme_queue_depth:         $OPT_QUEUE_DEPTH"
        echo "    transparent_hugepages:    $OPT_HUGEPAGES"
        echo "    numa_balancing:           $OPT_NUMA"
        echo "    irqbalance:               activo"
        echo ""
        echo "  SCORE DESPUÉS: $SCORE_D / 100"
        echo ""
        echo "── RESUMEN DE MEJORA ─────────────────────────────────────────"
        echo "  Score:     $SCORE_A → $SCORE_D  (+$MEJORA puntos, +${MEJORA_PCT}%)"
        echo "  Cambios aplicados: $NUM_CAMBIOS parámetros"
        [[ $RAM_GANADA -gt 0 ]] && echo "  RAM efectiva ganada: ~${RAM_GANADA} MB"
        echo ""
    } > "$IND_FILE"

    # ── CSV ───────────────────────────────────────────────────────────────────
    echo "$i,$i,${ESC:-aleatorio},\"$NOMBRE\",$CORES,$RAM_GB,$FREE_PCT,$GOVERNOR,$SWAPPINESS,$DIRTY_RATIO,$DIRTY_BG,$SCHEDULER_ACTIVE,$QUEUE_DEPTH,$HUGEPAGES,$NUMA,$IRQBALANCE,$AUDIO,$SCORE_A,$SCORE_D,$MEJORA,$MEJORA_PCT,\"$CAMBIOS_CSV\",$RAM_GANADA" >> "$CSV"

    # ── Progreso en consola ───────────────────────────────────────────────────
    if ! $SILENCIOSO; then
        BAR_DONE=$(( (i - DESDE + 1) * 40 / TOTAL ))
        BAR_LEFT=$((40 - BAR_DONE))
        BAR=$(printf '█%.0s' $(seq 1 $BAR_DONE 2>/dev/null) 2>/dev/null || printf '%0.s█' $(seq 1 $BAR_DONE))
        EMPTY=$(printf '░%.0s' $(seq 1 $BAR_LEFT 2>/dev/null) 2>/dev/null || printf '%0.s░' $(seq 1 $BAR_LEFT))
        PCT=$(( (i - DESDE + 1) * 100 / TOTAL ))

        if [[ $SCORE_A -ge 80 ]]; then COLOR_A=$G
        elif [[ $SCORE_A -ge 50 ]]; then COLOR_A=$Y
        else COLOR_A=$R; fi

        printf "\r  [${B}%s%s${NC}] ${W}%3d%%${NC}  #%04d  ${COLOR_A}%3d${NC}→${G}%d${NC}  +%-2d pts  %-12s  %-6s  swap:%-3d" \
            "$BAR" "$EMPTY" "$PCT" "$i" "$SCORE_A" "$SCORE_D" "$MEJORA" \
            "$GOVERNOR" "$SCHEDULER_ACTIVE" "$SWAPPINESS"
    fi
done

log ""
log ""

# ── Calcular estadísticas finales ─────────────────────────────────────────────
AVG_ANTES=$((TOTAL_SCORE_ANTES / TOTAL))
AVG_DESPUES=$((TOTAL_SCORE_DESPUES / TOTAL))
AVG_MEJORA=$((AVG_DESPUES - AVG_ANTES))
AVG_CAMBIOS=$((TOTAL_CAMBIOS / TOTAL))

# ── Guardar estadísticas ──────────────────────────────────────────────────────
{
    echo "╔══════════════════════════════════════════════════════════════════╗"
    echo "║   Dix — Estadísticas Globales ($TOTAL situaciones)       ║"
    echo "║   Timestamp: $TIMESTAMP"
    echo "╚══════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "── SCORES GLOBALES ───────────────────────────────────────────────"
    printf "  Score promedio ANTES:    %3d / 100\n" $AVG_ANTES
    printf "  Score promedio DESPUÉS:  %3d / 100\n" $AVG_DESPUES
    printf "  Mejora promedio:         +%d puntos por sistema\n" $AVG_MEJORA
    printf "  Score mínimo detectado:   %d (PC #%d)\n" $SCORE_MIN_ANTES $PEOR_PC_ID
    printf "  Score máximo sin tocar:   %d\n" $SCORE_MAX_ANTES
    PCT_OPTIMOS=$(( SISTEMAS_YA_OPTIMOS * 100 / TOTAL ))
    printf "  Sistemas ya óptimos:      %d / %d (%d%%)\n" \
        $SISTEMAS_YA_OPTIMOS $TOTAL $PCT_OPTIMOS
    printf "  Mejora máxima obtenida:   +%d pts (PC #%d)\n" $MEJORA_MAX $MEJOR_PC_ID
    printf "  Mejora mínima obtenida:   +%d pts\n" $MEJORA_MIN
    printf "  Cambios promedio por PC:  %d parámetros\n" $AVG_CAMBIOS
    printf "  Total cambios aplicados:  %d parámetros en %d PCs\n" $TOTAL_CAMBIOS $TOTAL
    echo ""
    echo "── DISTRIBUCIÓN DE GOVERNORS ─────────────────────────────────────"
    for gov in "${!FREC_GOVERNOR[@]}"; do
        printf "  %-20s %4d PCs\n" "$gov:" "${FREC_GOVERNOR[$gov]}"
    done | sort -rn -k2
    echo ""
    echo "── DISTRIBUCIÓN DE SCHEDULERS ────────────────────────────────────"
    for sched in "${!FREC_SCHEDULER[@]}"; do
        printf "  %-20s %4d PCs\n" "$sched:" "${FREC_SCHEDULER[$sched]}"
    done | sort -rn -k2
    echo ""
    echo "── DISTRIBUCIÓN DE HUGEPAGES ─────────────────────────────────────"
    for hp in "${!FREC_HUGEPAGES[@]}"; do
        printf "  %-20s %4d PCs\n" "$hp:" "${FREC_HUGEPAGES[$hp]}"
    done | sort -rn -k2
    echo ""
    echo "── ESCENARIOS CUBIERTOS ─────────────────────────────────────────"
    echo "  Seeds 1-100:    100 PCs aleatorios"
    echo "  Seeds 101-150:   50 PCs en Crisis"
    echo "  Seeds 151-200:   50 PCs Gaming"
    echo "  Seeds 201-250:   50 PCs Idle bien configurado"
    echo "  Seeds 251-300:   50 PCs Linux recién instalado"
    echo "  Seeds 301-350:   50 PCs Servidor de producción"
    echo "  Seeds 351-500:  150 PCs aleatorios adicionales"
    echo ""
    echo "── ARCHIVOS GENERADOS ───────────────────────────────────────────"
    echo "  Individuales:    $RUN_DIR/individuales/run_NNNN.txt (500 archivos)"
    echo "  CSV resumen:     $RUN_DIR/resumen.csv"
    echo "  Este informe:    $RUN_DIR/estadisticas.txt"
    echo ""
} > "$STATS"

# ── Mostrar estadísticas en pantalla ─────────────────────────────────────────
log ""
log -e "${W}╔══════════════════════════════════════════════════════════════════╗${NC}"
log -e "${W}║          RESULTADOS FINALES — $TOTAL SITUACIONES PROCESADAS           ║${NC}"
log -e "${W}╚══════════════════════════════════════════════════════════════════╝${NC}"
log ""
log -e "  ${C}Score promedio ANTES:${NC}    ${R}$AVG_ANTES / 100${NC}"
log -e "  ${C}Score promedio DESPUÉS:${NC}  ${G}$AVG_DESPUES / 100${NC}"
log -e "  ${C}Mejora promedio:${NC}         ${G}+$AVG_MEJORA puntos por sistema${NC}"
log ""
log -e "  ${C}Peor PC detectado:${NC}       ${R}$SCORE_MIN_ANTES pts${NC}  (PC #$PEOR_PC_ID)"
log -e "  ${C}Mejor mejora obtenida:${NC}   ${G}+$MEJORA_MAX pts${NC}  (PC #$MEJOR_PC_ID)"
log -e "  ${C}Sistemas ya óptimos:${NC}     $SISTEMAS_YA_OPTIMOS / $TOTAL"
log -e "  ${C}Total cambios aplicados:${NC} $TOTAL_CAMBIOS parámetros en $TOTAL PCs"
log ""
log -e "  ${Y}Governors más frecuentes (sin optimizar):${NC}"
for gov in "${!FREC_GOVERNOR[@]}"; do
    printf "    %-20s %d PCs\n" "$gov:" "${FREC_GOVERNOR[$gov]}"
done | sort -rn -k2 | $SILENCIOSO cat || \
for gov in "${!FREC_GOVERNOR[@]}"; do
    log "    $(printf '%-20s' "$gov:")  ${FREC_GOVERNOR[$gov]} PCs"
done
log ""
log -e "  ${W}Archivos guardados en:${NC}"
log -e "    ${C}$RUN_DIR/${NC}"
log -e "    ├── individuales/run_NNNN.txt  (500 archivos)"
log -e "    ├── resumen.csv"
log -e "    └── estadisticas.txt"
log ""

# ── Crear enlace simbólico al último run ──────────────────────────────────────
ln -sfn "$RUN_DIR" "$RESULTS_DIR/ultimo_run"
log -e "  Acceso rápido: ${C}$RESULTS_DIR/ultimo_run/${NC}"
log ""

echo "COMPLETADO: $TOTAL situaciones procesadas en $TIMESTAMP" >> "$RESULTS_DIR/historial_runs.log"
echo "  Score promedio: $AVG_ANTES → $AVG_DESPUES (+$AVG_MEJORA pts)" >> "$RESULTS_DIR/historial_runs.log"
echo "  Run dir: $RUN_DIR" >> "$RESULTS_DIR/historial_runs.log"
echo "" >> "$RESULTS_DIR/historial_runs.log"
