#!/bin/bash
# The test bench: every animal, behavior, idle and collar on localhost.  bash tools/bench.sh [species]
cd "$(dirname "$0")/.."
pgrep -f "http.server 8765" >/dev/null || (python3 -m http.server 8765 --bind 127.0.0.1 >/dev/null 2>&1 &)
sleep 0.5
URL="http://127.0.0.1:8765/docs/pet-motion-bench.html?species=${1:-pup}"
echo "$URL"; open "$URL" 2>/dev/null || true
