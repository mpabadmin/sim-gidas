# SIM Pulse serveris – Kitware Pulse 4.3.1 atvaizdas + mūsų WebSocket serveris (be išorinių Python paketų).
# Statoma Azure: az acr build (žr. azure/diegti.sh). Vietoje: docker build -t sim-pulse . && docker run -p 8080:8080 -e SIM_TOKEN=... sim-pulse
ARG PULSE_IMAGE=kitware/pulse:4.3.1
FROM ${PULSE_IMAGE}
USER root
# Python reikalingas (atvaizde turėtų būti, nes Pulse Python API sukompiliuotas)
RUN command -v python3 >/dev/null 2>&1 || (apt-get update && apt-get install -y --no-install-recommends python3 && rm -rf /var/lib/apt/lists/*)
WORKDIR /app
COPY ws.py engine_pulse.py engine_mock.py pulse_server.py entrypoint.sh /app/
RUN chmod +x /app/entrypoint.sh \
 && echo "== Pulse failai ==" && (find / -xdev \( -name 'PyPulse*.so' -o -name 'PulseEngine.py' -o -name 'StandardMale@0s.json' \) -not -path '/proc/*' 2>/dev/null | head -10) \
 && echo "== Savitikra (statymo metu) ==" && (timeout 900 /app/entrypoint.sh selftest 2>&1 | head -150 || true)
ENV PORT=8080 MAX_SESSIONS=3 PYTHONUNBUFFERED=1
EXPOSE 8080
ENTRYPOINT ["/app/entrypoint.sh"]
