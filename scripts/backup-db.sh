#!/bin/bash
# Taegliches DB-Backup fuer versicherungsengel + daily-crm.
# Konsistente Snapshots via sqlite3 .backup, gzip-komprimiert, 14 Tage Rotation.
# Telegram-Alert nur bei Fehler. Setup: siehe config/cron-backup.

set -uo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/root/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
ENV_FILE="${ENV_FILE:-/root/versicherungsengel/.env}"
VE_DB="${VE_DB:-/var/lib/docker/volumes/versicherungsengel_app_data/_data/versicherungsengel.db}"
DC_DB="${DC_DB:-/opt/daily_crm/data/daily_crm.db}"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

DATE="$(date +%Y-%m-%d_%H-%M)"
DEST="$BACKUP_ROOT/$DATE"
HOSTNAME="$(hostname)"
ERRORS=()

mkdir -p "$DEST"

backup_one() {
  local label="$1" src="$2" out="$DEST/$1.db"
  if [ ! -f "$src" ]; then
    ERRORS+=("$label: src nicht gefunden ($src)")
    return 1
  fi
  if ! sqlite3 "$src" ".backup '$out'" 2>/tmp/backup-err.$$; then
    ERRORS+=("$label: sqlite3 .backup fehlgeschlagen — $(cat /tmp/backup-err.$$ 2>/dev/null)")
    rm -f /tmp/backup-err.$$ "$out"
    return 1
  fi
  rm -f /tmp/backup-err.$$
  gzip -f "$out"
  echo "  $label: $(du -h "${out}.gz" | cut -f1)"
}

echo "=== Backup $DATE ==="
backup_one ve "$VE_DB" || true
backup_one dc "$DC_DB" || true

# Rotation: loesche Backup-Verzeichnisse aelter als KEEP_DAYS
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime "+$KEEP_DAYS" -exec rm -rf {} \; 2>/dev/null || true

TOTAL="$(du -sh "$BACKUP_ROOT" 2>/dev/null | cut -f1)"
echo "Total Backup-Volume: $TOTAL"

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo "FEHLER:" >&2
  for e in "${ERRORS[@]}"; do echo "  - $e" >&2; done

  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    MSG="🚨 DB-Backup fehlgeschlagen auf ${HOSTNAME}"
    for e in "${ERRORS[@]}"; do
      MSG+=$'\n• '"$e"
    done
    curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
      --data-urlencode "text=${MSG}" >/dev/null || true
  else
    echo "WARN: TELEGRAM_BOT_TOKEN/CHAT_ID nicht gesetzt — kein Alert verschickt" >&2
  fi
  exit 1
fi

echo "Backup OK"
exit 0
