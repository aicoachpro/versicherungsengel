#!/bin/bash
# Cron-Aufruf mit Authorization Header statt Query-Param
# Usage: cron-call.sh <endpoint>
# Beispiel: cron-call.sh /api/cron/reminders

CRON_SECRET="${CRON_SECRET:-vf-cron-2024-secure}"
URL="http://localhost:3000$1"
curl -s -H "Authorization: Bearer $CRON_SECRET" "$URL"
