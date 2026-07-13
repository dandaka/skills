#!/usr/bin/env bash
# Frontend harness preflight — see docs/frontend-protocol.md §1.
# Usage: scripts/preflight.sh [dev] [browser] [figma]
#   No args = run all checks. Exits non-zero if any requested check fails.
set -u

DEV_URL="${DEV_URL:-http://localhost:4321}"
FAIL=0

check_dev() {
  if curl -sf -o /dev/null --max-time 3 "$DEV_URL"; then
    echo "✓ dev server responding at $DEV_URL"
  else
    echo "✗ dev server NOT responding at $DEV_URL"
    echo "  start it: npm run dev -- --host 0.0.0.0"
    FAIL=1
  fi
}

check_browser() {
  if ! command -v agent-browser >/dev/null; then
    echo "✗ agent-browser CLI not found on PATH"
    FAIL=1
    return
  fi
  local w
  w=$(agent-browser eval "window.innerWidth" 2>/dev/null)
  if [[ "$w" =~ ^[0-9]+$ ]]; then
    echo "✓ browser CDP live (innerWidth=$w — assert this matches your target breakpoint before measuring)"
  else
    echo "✗ browser CDP not responding via agent-browser"
    echo "  start a page: agent-browser open $DEV_URL   (then: agent-browser set viewport 390 660)"
    FAIL=1
  fi
}

check_figma() {
  if ! command -v figma-use >/dev/null; then
    echo "✗ figma-use CLI not found on PATH"
    FAIL=1
    return
  fi
  local out
  out=$(figma-use status 2>&1)
  if echo "$out" | grep -q "✗"; then
    echo "✗ Figma CDP not connected"
    echo "  relaunch: open -a Figma --args --remote-debugging-port=9222"
    echo "  (if still failing: Figma may be logged out, or needs 'figma-use patch' — do NOT fall back to screenshots as design source)"
    FAIL=1
  else
    echo "✓ Figma connected ($(echo "$out" | head -1))"
  fi
}

REQUESTED=("$@")
[[ ${#REQUESTED[@]} -eq 0 ]] && REQUESTED=(dev browser figma)

for c in "${REQUESTED[@]}"; do
  case "$c" in
    dev) check_dev ;;
    browser) check_browser ;;
    figma) check_figma ;;
    *) echo "unknown check: $c (valid: dev browser figma)"; FAIL=1 ;;
  esac
done

exit $FAIL
