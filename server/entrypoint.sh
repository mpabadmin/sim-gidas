#!/bin/sh
# Suranda Pulse diegimą (PyPulse*.so) ir paleidžia serverį su tinkama Python versija.
if [ -z "$PULSE_BIN" ]; then
  SO=$(find / -xdev -name 'PyPulse*.so' -not -path '*/proc/*' 2>/dev/null | head -1)
  [ -n "$SO" ] && PULSE_BIN=$(dirname "$SO") && export PULSE_BIN
else
  SO=$(ls "$PULSE_BIN"/PyPulse*.so 2>/dev/null | head -1)
fi
PY=python3
if [ -n "$SO" ]; then
  V=$(basename "$SO" | sed -n 's/.*cpython-\([0-9]\)\([0-9]*\)-.*/\1.\2/p')
  if [ -n "$V" ] && command -v "python$V" >/dev/null 2>&1; then PY="python$V"; fi
fi
echo "PULSE_BIN=${PULSE_BIN:-nerasta} PYTHON=$PY ($($PY --version 2>&1))"
exec "$PY" /app/pulse_server.py "$@"
