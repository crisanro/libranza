#!/bin/sh
# Respaldo diario del esquema public de Supabase (el plan gratuito no
# incluye respaldos descargables). Conserva los últimos RESPALDO_DIAS días.
# Si falla, reintenta en 1 hora.
#
# Restaurar:  pg_restore --no-owner --no-privileges -d "<url>" respaldos/<archivo>.dump
set -u

RESPALDO_DIAS="${RESPALDO_DIAS:-14}"
# pg_dump no funciona bien por el pooler en modo transacción (puerto 6543);
# se usa el modo sesión (5432) del mismo host
URL="${RESPALDO_DATABASE_URL:-$(echo "$DATABASE_URL" | sed 's/:6543\//:5432\//')}"

while true; do
  archivo="/respaldos/prestamos-$(date -u +%Y%m%d-%H%M%S).dump"
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] respaldo -> $archivo"
  if pg_dump "$URL" --schema=public --no-owner --no-privileges -Fc -f "$archivo.tmp"; then
    mv "$archivo.tmp" "$archivo"
    find /respaldos -name 'prestamos-*.dump' -mtime +"$RESPALDO_DIAS" -delete
    echo "ok ($(du -h "$archivo" | cut -f1))"
    sleep 86400
  else
    rm -f "$archivo.tmp"
    echo "respaldo falló, reintento en 1 hora"
    sleep 3600
  fi
done
