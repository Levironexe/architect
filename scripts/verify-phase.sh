#!/usr/bin/env bash
set -e

PHASE=""
JSON_MODE=false
DIRECTORY="."

for arg in "$@"; do
  case "$arg" in
    --phase=*) PHASE="${arg#*=}" ;;
    --phase) shift; PHASE="$1" ;;
    --json) JSON_MODE=true ;;
    --help|-h)
      echo "Usage: verify-phase.sh [--phase N] [--json] [directory]"
      echo ""
      echo "Runs post-phase verification:"
      echo "  1. TypeScript compilation check (npx tsc --noEmit)"
      echo "  2. Re-scan project and save snapshot"
      echo "  3. Compare against baseline snapshot"
      echo "  4. Report pass/fail"
      echo ""
      echo "Options:"
      echo "  --phase N   Phase number (saves snapshot as .architect/scans/phase-N.json)"
      echo "  --json      Output results as JSON"
      echo "  directory   Project directory (default: .)"
      exit 0
      ;;
    *) DIRECTORY="$arg" ;;
  esac
done

if [ ! -d "$DIRECTORY" ]; then
  echo "ERROR: Directory not found: $DIRECTORY" >&2
  exit 1
fi

PHASE_FLAG=""
if [ -n "$PHASE" ]; then
  PHASE_FLAG="--phase $PHASE"
fi

JSON_FLAG=""
if [ "$JSON_MODE" = true ]; then
  JSON_FLAG="--json"
fi

exec npx @levironexe/architect verify "$DIRECTORY" $PHASE_FLAG $JSON_FLAG
