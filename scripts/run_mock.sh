#!/bin/bash
# Dix — Lanzador con perfil de PC simulado
# Uso: ./run_mock.sh [perfil]
# Perfiles disponibles: gaming_pc | laptop_viejo | servidor

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PERFIL="${1:-gaming_pc}"
PROFILE_DIR="$SCRIPT_DIR/mock_profiles/$PERFIL"

if [ ! -d "$PROFILE_DIR" ]; then
    echo "Error: perfil '$PERFIL' no existe."
    echo "Perfiles disponibles:"
    ls "$SCRIPT_DIR/mock_profiles/"
    exit 1
fi

export DIX_SYS_ROOT="$PROFILE_DIR"

echo "============================================"
echo "  Dix — Modo Simulacion"
echo "  Perfil: $PERFIL"
echo "  Ruta:   $PROFILE_DIR"
echo "============================================"
echo ""

cd "$SCRIPT_DIR"
cargo tauri dev
