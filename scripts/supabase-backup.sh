#!/usr/bin/env bash
# CUSTOM+ — Supabase databackup (agent "backup-restore", voorstel 50).
# ------------------------------------------------------------------
# Nodig: de omgevingsvariabele SUPABASE_DB_URL — DEZELFDE die de
# migratierunner van een andere agent gebruikt (scripts/supabase-migrate.mjs,
# npm run migrate) om met het live Supabase-project te verbinden. Zonder
# die variabele bestaat er nog geen live project om te back-uppen, en dit
# script verzint dan ook nooit een geslaagde backup — het stopt eerlijk.
#
# Dit script probeert twee tools, in volgorde van voorkeur:
#   1. de Supabase CLI (`supabase db dump --db-url ...`) — bevat ook
#      Supabase-specifieke metadata (roles, extensions);
#   2. `pg_dump` in het custom-formaat (-F c) — het generieke alternatief
#      als alleen de kale PostgreSQL-clienttools geïnstalleerd zijn.
# Is geen van beide geïnstalleerd, dan legt dit script precies uit hoe je
# ze installeert en stopt met exit 1 — geen halve actie, geen giswerk.
# ------------------------------------------------------------------
set -euo pipefail

HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECTROOT="$(cd "$HIER/.." && pwd)"
BACKUPMAP="$PROJECTROOT/backups"
GITIGNORE="$PROJECTROOT/.gitignore"
TIJDSTEMPEL="$(date -u +%Y%m%dT%H%M%SZ)"

echo "CUSTOM+ — Supabase backup"
echo "=========================="

# --------------------------------------------------------------
# 1. Welke tool is er?
# --------------------------------------------------------------
HEEFT_SUPABASE=0
HEEFT_PGDUMP=0
if command -v supabase >/dev/null 2>&1; then HEEFT_SUPABASE=1; fi
if command -v pg_dump >/dev/null 2>&1; then HEEFT_PGDUMP=1; fi

if [ "$HEEFT_SUPABASE" -eq 0 ] && [ "$HEEFT_PGDUMP" -eq 0 ]; then
  echo ""
  echo "GEEN backup gemaakt: geen van de benodigde tools is geïnstalleerd op deze machine."
  echo ""
  echo "Installeer een van de twee (één van de twee is genoeg):"
  echo ""
  echo "  Optie A — Supabase CLI (aanbevolen, bevat ook Supabase-metadata):"
  echo "    macOS (Homebrew):  brew install supabase/tap/supabase"
  echo "    overige platforms: zie https://supabase.com/docs/guides/cli/getting-started"
  echo ""
  echo "  Optie B — pg_dump (onderdeel van de PostgreSQL-clienttools):"
  echo "    macOS (Homebrew):  brew install libpq && brew link --force libpq"
  echo "    Debian/Ubuntu:     sudo apt-get install postgresql-client"
  echo ""
  echo "Draai dit script daarna opnieuw: bash scripts/supabase-backup.sh (of: npm run backup)."
  exit 1
fi

# --------------------------------------------------------------
# 2. De map en .gitignore staan klaar, ongeacht of de backup hierna lukt —
#    dumps horen nooit in git (kunnen klantgegevens bevatten).
# --------------------------------------------------------------
mkdir -p "$BACKUPMAP"
if [ -f "$GITIGNORE" ] && ! grep -qxF "backups/" "$GITIGNORE"; then
  printf '\nbackups/\n' >> "$GITIGNORE"
  echo "Regel 'backups/' toegevoegd aan .gitignore (databackups horen nooit in git)."
fi

# --------------------------------------------------------------
# 3. Zonder SUPABASE_DB_URL is er geen live project om te back-uppen.
# --------------------------------------------------------------
if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo ""
  echo "GEEN backup gemaakt: de omgevingsvariabele SUPABASE_DB_URL ontbreekt."
  echo "Zet 'm eerst (dezelfde connectiestring als scripts/supabase-migrate.mjs gebruikt), bijvoorbeeld:"
  echo '  export SUPABASE_DB_URL="postgresql://postgres:<db-wachtwoord>@db.<project-ref>.supabase.co:5432/postgres"'
  echo "Draai dit script daarna opnieuw."
  exit 1
fi

# --------------------------------------------------------------
# 4. De echte dump.
# --------------------------------------------------------------
if [ "$HEEFT_SUPABASE" -eq 1 ]; then
  BESTAND="$BACKUPMAP/customplus-$TIJDSTEMPEL.sql"
  echo "Backup met de Supabase CLI naar $BESTAND ..."
  supabase db dump --db-url "$SUPABASE_DB_URL" -f "$BESTAND"
else
  BESTAND="$BACKUPMAP/customplus-$TIJDSTEMPEL.dump"
  echo "Backup met pg_dump (custom-formaat) naar $BESTAND ..."
  pg_dump "$SUPABASE_DB_URL" -F c -f "$BESTAND"
fi

if [ ! -s "$BESTAND" ]; then
  echo "GEEN geldige backup: $BESTAND bestaat niet of is leeg, ondanks dat het commando geen fout gaf."
  exit 1
fi

GROOTTE="$(du -h "$BESTAND" | cut -f1)"
echo ""
echo "Backup gelukt: $BESTAND ($GROOTTE)"
echo "Herstelstappen: zie scripts/BACKUP-EN-HERSTEL.md."
