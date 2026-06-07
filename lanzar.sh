#!/bin/bash
nohup /home/alons/mi-optimizador-ia/batch_5000.sh --bench-tiempo 10 > /home/alons/mi-optimizador-ia/bench_live.log 2>&1 &
echo "PID: $!"
echo "Log: /home/alons/mi-optimizador-ia/bench_live.log"
