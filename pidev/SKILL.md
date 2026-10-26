---
name: pidev
description: Launch DeepSeek v4.1 Flash subagents (OpenCode Go provider) headlessly through the pi CLI (pi.dev) and collect their results. Use when the user says /pidev, asks to delegate work to pi with DeepSeek, fan out cheap subagents, implement GitHub issues in worktrees with PRs, or get a second model's take.
---

# pidev (pi + OpenCode Go + DeepSeek v4.1 Flash)

`pi` runs one-shot agents from Bash. Each call is one subagent; run several in the background
for parallel work and read their output when they finish.

## Default command

```bash
pi -p --no-session --model opencode-go/deepseek-v4.1-flash --thinking medium --tools read,bash "<task>"
```

- **Provider:** `opencode-go`, **model:** `deepseek-v4.1-flash`, **thinking:** `medium`. Always
  pass model and thinking explicitly; pi's configured default may be a different (and pricier) model.
- Check auth: `pi auth check --provider opencode-go --no-refresh` (should print `ready`).
- Add `--mode json` when you need a parseable event stream. For any long task use
  `run-agent.sh` (below), which always streams JSON.
- A trivial task completes in ~2 s.

## Alternatives

- Other OpenCode Go models: `pi --offline --list-models | grep opencode-go` (e.g.
  `opencode-go/deepseek-v4-pro` for harder tasks). With `run-agent.sh`, set `PI_MODEL=<provider/model>`.
- Check a provider: `pi auth check --provider <name> --no-refresh`.

## Safety rules

- **pi has no permission prompts.** With `bash` a subagent can run anything, including
  production CLIs or database clients on your machine. For research/review, restrict tools
  (`--tools read,grep,find,ls`). Grant `bash`/`edit`/`write` only for scoped dev work.
- **Parallel writers need isolation:** give each editing subagent its own git worktree; never
  let two write to the same checkout, and never point one at a production checkout.
- **pi exits 0 even if the task failed.** A Flash model reports success confidently; review
  harder. Verify each result (read the output, run the tests, inspect the diff) before reporting success.
- pi loads `CLAUDE.md`/`AGENTS.md` by default, so subagents inherit repo rules. Keep that on
  (don't pass `--no-context-files`) unless there is a reason.

## Pattern for fan-out

1. Write each task prompt self-contained (paths, acceptance criteria, what not to touch) **to a
   file**, never inline in the Bash command.
2. Launch each with `run-agent.sh` under Bash `run_in_background` (one call per agent, so each
   finish is its own notification).
3. When notified, read the printed final message, **review the diff yourself**, and summarize.

## Issues → worktrees → PRs

Helpers live next to this file: `run-agent.sh` (runner with stall kill) and `issue-prompt.md`
(per-issue prompt template; fill in `<OWNER/REPO>`, `<REPO_DIR>` and `<BASE>` first).

```bash
D=~/.claude/skills/pidev
R=<REPO_DIR>              # main checkout
S=<scratchpad>/pi && mkdir -p $S
git -C $R fetch -q origin <BASE>
for n in 918 921; do
  git -C $R worktree add -q -b fix/$n-issue $R-wt-$n origin/<BASE>
  sed "s/__N__/$n/g" $D/issue-prompt.md > $S/p$n.txt   # append issue-specific notes here
done
df -m / | tail -1        # see "Disk" below before launching
```

Then one background Bash call per issue:

```bash
$D/run-agent.sh $R-wt-918 $S/p918.txt $S/j918.jsonl
```

Install dependencies in each worktree before launching, or agents stop with "blocked".

### Known failure modes, and the fixes built in

- **Disk.** Many worktrees plus parallel test runs (test databases, temp files) eat disk fast.
  Check `df -m /` first and keep a few GB of headroom.
- **Concurrency.** 24 agents at once once filled the disk and 21 of them stopped before pushing.
  Run at most 3–4 test-running agents at a time and gate each launch on free disk
  (`xargs -P 3` over a wrapper that waits for enough free space).
- **Silent hangs.** pi processes can sit at 0% CPU, no TCP connection, no output for an hour.
  `run-agent.sh` kills an agent whose log has not grown for 10 min and exits 124
  (`STALLED`); relaunch with the same prompt file (the worktree is intact). Bash output streams
  as events, so test runs keep the log alive; for a task with a known long silent step, pass a
  larger 4th argument (minutes).
- **Shell quoting.** A prompt containing backticks and `<id>` gets parsed by the shell and never
  runs. Prompts go in files; `run-agent.sh` passes them as one argv element.
- **Invisible output.** Plain `-p` prints nothing until the end, so a hang looks like work.
  `--mode json` (always on in the runner) lets you check progress:
  `grep -c toolcall_end $S/j918.jsonl`.
- **Orphaned children.** Never let an agent redirect a long command's output to a file without
  printing progress: the stall guard kills the agent after 10 minutes and its child keeps running.

### Review every PR before calling it done

pi reports success confidently; expect some PRs to need a follow-up. Check:

- `git diff origin/<BASE>...HEAD` (three dots; two dots shows the base's newer commits as reverts).
- The diff against the issue's expected behaviour: scope creep in cleanups, guards and refusals.
- SQL shape on big tables: correlated `EXISTS` with `OR`/functions per row can turn a query
  from milliseconds into seconds.
- New enum-like values against DB triggers/constraints.
- Duplicate writes on repeated runs.

### Nudging an agent

Write a continuation prompt file: the original prompt + "REVIEW FOLLOW-UP — continuation of PR
<url> on branch <b>; do NOT open a new PR; add a follow-up commit, push, `gh pr edit`" + numbered
findings + the tests you expect. Relaunch `run-agent.sh` in the same worktree.

### Wrap-up

- List PRs: `gh pr list --repo <OWNER/REPO> --base <BASE> --state open --search "author:@me"`.
- Flag PRs that touch the same files (they will conflict in merge order).
- Remove worktrees after merge: `git worktree remove $R-wt-<n>`.
