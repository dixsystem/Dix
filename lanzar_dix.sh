#!/bin/bash
# Lanzador oficial de Dix — DixSystem 2026

DIX_CONFIG="$HOME/.config/dix"
OLD_CONFIG="$HOME/.config/pcoptimizer"

# Migrar store si existe la ruta antigua y no la nueva
if [ ! -f "$DIX_CONFIG/store.json" ] && [ -f "$OLD_CONFIG/store.json" ]; then
    mkdir -p "$DIX_CONFIG"
    cp "$OLD_CONFIG/store.json" "$DIX_CONFIG/store.json"
    echo "[DIX] Store migrado de pcoptimizer → dix"
fi

# Crear directorio si no existe
mkdir -p "$DIX_CONFIG"

# Si no hay store en absoluto, crear uno limpio sin límite de demo
if [ ! -f "$DIX_CONFIG/store.json" ]; then
    cat > "$DIX_CONFIG/store.json" << 'EOF'
{
  "version": 0,
  "api_key": null,
  "sessions": [],
  "license_key": "DIXDEV-2026-INTERNAL",
  "demo_analyses_used": 0
}
EOF
    echo "[DIX] Store inicializado"
fi

# Lanzar Dix
cd "$(dirname "$0")"
npx tauri dev
