#!/bin/sh
# Mantiene activo el proyecto de Supabase (se pausa tras 7 días sin actividad).
# Escribe en la BD al arrancar y luego cada INTERVALO_DIAS días.
# Si falla (red, Supabase caído), reintenta en 1 hora en vez de esperar días.
set -u

INTERVALO_DIAS="${INTERVALO_DIAS:-5}"

while true; do
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] keepalive"
  if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f /keepalive/keepalive.sql; then
    sleep $((INTERVALO_DIAS * 86400))
  else
    echo "keepalive falló, reintento en 1 hora"
    sleep 3600
  fi
done
