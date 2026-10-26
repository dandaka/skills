You are fixing GitHub issue <OWNER/REPO>#__N__ in the git worktree <REPO_DIR>-wt-__N__ (branch fix/__N__-issue, based on origin/<BASE>). Work ONLY inside that directory: `cd <REPO_DIR>-wt-__N__` first and never edit the main checkout or any production checkout.

Steps:
1. Read the issue: `gh issue view __N__ --repo <OWNER/REPO> --comments`. Verify the diagnosis against the current code before changing anything; if part is already fixed on <BASE>, fix only the remainder. Stay within what the issue asks: do not broaden a cleanup, guard or refusal beyond the cases it lists.
2. Implement the smallest correct fix that matches the surrounding code style. Red/green TDD: add or extend a test that fails before the fix and passes after it.
3. Run the tests for the files you touched and their neighbours, plus the linter and typecheck for the changed package. Fix what you introduced.
4. Any SQL you add that runs per row over a large table must not use a correlated EXISTS with OR or a function on a join column: resolve ids once (uncorrelated subquery or CTE) and join on indexed columns.
5. If documented behaviour changes, update that doc in the same commit.
6. Commit with a conventional message like `fix(<area>): <what> (#__N__)`.
7. `git fetch origin <BASE> && git merge origin/<BASE>` (resolve conflicts, commit), then re-run the affected tests. Fix every failure and commit.
8. `git push -u origin fix/__N__-issue`, then open a PR against <BASE>:
   `gh pr create --repo <OWNER/REPO> --base <BASE> --head fix/__N__-issue --title "<conventional title> (#__N__)" --body "<root cause, the fix, tests run and their result>\n\nCloses #__N__"`
9. Final output: the PR URL and a 5-line summary. If you could not finish, say exactly what is blocking, and leave your work uncommitted rather than committing untested code.

Hard safety rules:
- Never touch production: no production database queries, no requests to production endpoints, nothing that sends a message to a person.
- Never read or write secrets directly; never deploy; never push to main.
- Do not modify unrelated files or reformat files wholesale.
