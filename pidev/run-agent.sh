#!/usr/bin/env bash
# Run one pi subagent in a directory, streaming JSON events to a log.
# Kills the agent if the log stops growing (pi can hang silently with no
# network connection and 0% CPU), then prints the agent's final message.
#
#   run-agent.sh <workdir> <prompt-file> <log.jsonl> [stall-minutes]
#
# Exit: pi's exit code, 124 on stall, 2 on usage error.
# Env: PI_MODEL (default opencode-go/deepseek-v4.1-flash), PI_THINKING (medium),
#      PI_TOOLS (read,bash,edit,write), STALL_SECONDS (overrides stall-minutes).
set -u
workdir=${1:?workdir}; prompt=${2:?prompt file}; log=${3:?log file}; stall_min=${4:-10}
stall_s=${STALL_SECONDS:-$(( stall_min * 60 ))}
[ -d "$workdir" ] && [ -f "$prompt" ] || { echo "usage: $0 <workdir> <prompt-file> <log.jsonl> [stall-minutes]" >&2; exit 2; }

# The prompt travels as one argv element read from a file: backticks, <angle>
# brackets and quotes in it never reach a shell parser.
(cd "$workdir" && exec pi -p --no-session --mode json \
  --model "${PI_MODEL:-opencode-go/deepseek-v4.1-flash}" --thinking "${PI_THINKING:-medium}" \
  --tools "${PI_TOOLS:-read,bash,edit,write}" "$(cat "$prompt")") >"$log" 2>&1 &
pid=$!

status=0
while kill -0 "$pid" 2>/dev/null; do
  sleep 5
  age=$(( $(date +%s) - $(stat -f %m "$log") ))
  if [ "$age" -gt "$stall_s" ]; then
    pkill -P "$pid" 2>/dev/null; kill "$pid" 2>/dev/null
    echo "STALLED: no output for ${age}s in $workdir; killed. Relaunch with the same prompt."
    status=124
    break
  fi
done
[ "$status" -eq 0 ] && { wait "$pid"; status=$?; }

echo "--- final message ($log) ---"
grep '"type":"agent_end"' "$log" | tail -1 | jq -r \
  '[.messages[]? | select(.role=="assistant") | .content[]? | select(.type=="text") | .text] | last // "(no final message)"' \
  2>/dev/null || tail -c 2000 "$log"
exit "$status"
