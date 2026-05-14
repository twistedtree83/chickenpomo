#!/bin/bash

# ralphonce.sh — Single-iteration Ralph (human-in-the-loop)
# Adapted from snarktank/ralph (github.com/snarktank/ralph)
# Original technique by Geoffrey Huntley (ghuntley.com/ralph/)
#
# Run this once, review the output, then re-run when ready.
# Use ralph.sh for fully autonomous looping.
#
# Usage:
#   ./scripts/ralphonce.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPT_FILE="$SCRIPT_DIR/RALPH_PROMPT.md"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"

if [ ! -f "$PROMPT_FILE" ]; then
  echo "Error: $PROMPT_FILE not found."
  exit 1
fi

if [ ! -f "$PROGRESS_FILE" ]; then
  echo "# Ralph Progress Log" > "$PROGRESS_FILE"
  echo "Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$PROGRESS_FILE"
  echo "---" >> "$PROGRESS_FILE"
fi

echo "Ralph Wiggum — single iteration"
echo "Project: Chicken Pomodoro"
echo "Prompt: $PROMPT_FILE"
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# Reap stale jest workers from prior crashed sessions before launching Claude.
# When the parent shell dies mid-`jest`, the worker stays running and pins
# ~2-3% RAM each. Multiple bad sessions = OOM. Threshold = 30 min; legitimate
# jest runs in this repo finish in seconds.
reap_stale_jest() {
  local killed=0
  while read -r pid; do
    [ -z "$pid" ] && continue
    if kill -KILL "$pid" 2>/dev/null; then
      killed=$((killed + 1))
    fi
  done < <(ps -eo pid,etimes,args --no-headers \
    | awk '$2 > 1800 && /jest/ && !/awk|grep|claude/ { print $1 }')
  if [ "$killed" -gt 0 ]; then
    echo "[reaper] killed $killed stale jest process(es) from prior sessions"
  fi
}
reap_stale_jest

# Reap orphaned claude processes from prior crashed sessions. When the parent
# shell dies mid-iteration, claude gets reparented to init and runs forever.
# Threshold = 1 hour; legitimate iterations finish well under that.
reap_stale_claude() {
  local killed=0
  while read -r pid; do
    [ -z "$pid" ] && continue
    if kill -KILL "$pid" 2>/dev/null; then
      killed=$((killed + 1))
    fi
  done < <(ps -eo pid,etimes,args --no-headers \
    | awk '$2 > 3600 && /claude --dangerously-skip-permissions/ && !/awk|grep/ { print $1 }')
  if [ "$killed" -gt 0 ]; then
    echo "[reaper] killed $killed stale claude process(es) from prior sessions"
  fi
}
reap_stale_claude

PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PROMPT_CONTENT="$(cat "$PROMPT_FILE")"
CLAUDE_BIN="$(command -v claude || echo /usr/local/bin/claude)"
cd "$PROJECT_DIR" && timeout --kill-after=30s 45m \
  "$CLAUDE_BIN" --dangerously-skip-permissions "$PROMPT_CONTENT"
exit $?
