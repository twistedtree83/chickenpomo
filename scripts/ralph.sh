#!/bin/bash

# ralph.sh — Autonomous Ralph Wiggum loop for Chicken Pomodoro
# Adapted from snarktank/ralph (github.com/snarktank/ralph)
# Original technique by Geoffrey Huntley (ghuntley.com/ralph/)
#
# Usage:
#   ./scripts/ralph.sh              # 10 iterations (default)
#   ./scripts/ralph.sh 20           # 20 iterations

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAX_ITERATIONS=10

if [[ "$1" =~ ^[0-9]+$ ]]; then
  MAX_ITERATIONS="$1"
fi

PRD_FILE="$SCRIPT_DIR/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
PROMPT_FILE="$SCRIPT_DIR/RALPH_PROMPT.md"

if [ ! -f "$PRD_FILE" ]; then
  echo "Error: $PRD_FILE not found. Run from the repo root."
  exit 1
fi

if [ ! -f "$PROMPT_FILE" ]; then
  echo "Error: $PROMPT_FILE not found."
  exit 1
fi

if [ ! -f "$PROGRESS_FILE" ]; then
  echo "# Ralph Progress Log" > "$PROGRESS_FILE"
  echo "Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$PROGRESS_FILE"
  echo "---" >> "$PROGRESS_FILE"
fi

PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CLAUDE_BIN="$(command -v claude || echo /usr/local/bin/claude)"
PROMPT_CONTENT="$(cat "$PROMPT_FILE")"

echo ""
echo "Ralph Wiggum Loop — Chicken Pomodoro"
echo "Max iterations: $MAX_ITERATIONS"
echo "Prompt: $PROMPT_FILE"
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

# Reap orphaned claude/script wrappers from prior crashed sessions. When the
# parent shell of ralph.sh dies (terminal closed, Ctrl-C mid-iteration, SSH
# drop), `script -q -e -c claude ...` gets reparented to init and keeps the
# inner claude alive indefinitely. Threshold = 1 hour; legitimate iterations
# finish well under that.
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

for i in $(seq 1 "$MAX_ITERATIONS"); do
  echo "==============================================================="
  echo " Iteration $i of $MAX_ITERATIONS"
  echo " $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "==============================================================="
  echo ""

  reap_stale_jest
  reap_stale_claude

  TMPFILE=$(mktemp)
  ESCAPED_BIN=$(printf '%q' "$CLAUDE_BIN")
  ESCAPED_PROMPT=$(printf '%q' "$PROMPT_CONTENT")
  # `timeout` lives INSIDE the `script -c` payload, not around it. Wrapping
  # `script` with `timeout` puts script in its own pgroup, detaches it from the
  # parent terminal's foreground group, and the live TUI relay disappears —
  # claude still runs and the typescript file still grows, but the user sees
  # nothing. Running `timeout` inside the pty keeps script attached to the
  # shell and lets it relay claude's TUI normally.
  (cd "$PROJECT_DIR" && \
    script -q -e -c "timeout --kill-after=30s 45m $ESCAPED_BIN --dangerously-skip-permissions $ESCAPED_PROMPT" "$TMPFILE") || true
  OUTPUT=$(sed 's/\x1b\[[0-9;]*[mGKHFJK]//g; s/\r//g' "$TMPFILE")
  rm -f "$TMPFILE"

  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    echo ""
    echo "Ralph completed all tasks at iteration $i of $MAX_ITERATIONS."
    exit 0
  fi

  if echo "$OUTPUT" | grep -q "^WAITING:"; then
    echo ""
    echo "Ralph is waiting for a human-in-the-loop task. Review prd.json."
    exit 0
  fi

  echo ""
  echo "Iteration $i complete. Sleeping 2s..."
  sleep 2
done

echo ""
echo "Ralph reached max iterations ($MAX_ITERATIONS) without completing."
echo "Check $PROGRESS_FILE for status."
exit 1
