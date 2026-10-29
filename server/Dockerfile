# SIM Pulse serveris – Kitware Pulse 4.3.1 atvaizdas + mūsų WebSocket serveris (+ numpy/pandas Pulse Python sąsajai).
# Statoma Azure: az acr build (žr. azure/diegti.sh). Vietoje: docker build -t sim-pulse . && docker run -p 8080:8080 -e SIM_TOKEN=... sim-pulse
ARG PULSE_IMAGE=kitware/pulse:4.3.1
FROM ${PULSE_IMAGE}
USER root
# Python reikalingas (atvaizde turėtų būti, nes Pulse Python API sukompiliuotas)
RUN command -v python3 >/dev/null 2>&1 || (apt-get update && apt-get install -y --no-install-recommends python3 && rm -rf /var/lib/apt/lists/*)
# Pulse Python sąsajai reikia numpy ir pandas (scipy, matplotlib – kai kuriems moduliams); diegiama tai Python versijai, kuriai sukompiliuotas PyPulse
RUN SO=$(find / -xdev -name 'PyPulse*.so' -not -path '/proc/*' 2>/dev/null | head -1); PY=python3; \
    V=$(basename "${SO:-x}" | sed -n 's/.*cpython-\([0-9]\)\([0-9]*\)-.*/\1.\2/p'); \
    [ -n "$V" ] && command -v "python$V" >/dev/null 2>&1 && PY="python$V"; echo "PyPulse: ${SO:-nerasta}  Python: $PY"; \
    $PY -m pip --version >/dev/null 2>&1 || $PY -m ensurepip >/dev/null 2>&1 || \
      (apt-get update && apt-get install -y --no-install-recommends python3-pip && rm -rf /var/lib/apt/lists/*) || true; \
    PK="numpy pandas scipy matplotlib"; \
    $PY -m pip install --no-cache-dir $PK || $PY -m pip install --no-cache-dir --break-system-packages $PK || echo "!!! pip nepavyko"; \
    $PY -c "import numpy, pandas; print('numpy', numpy.__version__, 'pandas', pandas.__version__)" || true
WORKDIR /app
COPY ws.py engine_pulse.py engine_mock.py pulse_server.py entrypoint.sh /app/
RUN chmod +x /app/entrypoint.sh \
 && echo "== Pulse failai ==" && (find / -xdev \( -name 'PyPulse*.so' -o -name 'PulseEngine.py' -o -name 'StandardMale@0s.json' \) -not -path '/proc/*' 2>/dev/null | head -10) \
 && echo "== Savitikra (statymo metu) ==" && (timeout 900 /app/entrypoint.sh selftest 2>&1 | head -150 || true)
ENV PORT=8080 MAX_SESSIONS=3 PYTHONUNBUFFERED=1
EXPOSE 8080
ENTRYPOINT ["/app/entrypoint.sh"]
