#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
nohup "$SCRIPT_DIR/batch_5000.sh" --bench-tiempo 10 > "$SCRIPT_DIR/bench_live.log" 2>&1 &
echo "PID: $!"
echo "Log: $SCRIPT_DIR/bench_live.log"
