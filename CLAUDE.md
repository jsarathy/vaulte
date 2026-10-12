# Vaulte — instructions for Claude sessions

Read this first in every session, cloud or local.

## Docs

The process and fix docs are not in this repo. They are in the private repo `jsarathy/vaulte-docs`: `FUTURE_FIXES.md` and `claude/*.md`. Keep a clone next to this repo (`../vaulte-docs` on a local machine, `/home/claude/vaulte-docs` in a cloud session); if it is missing, ask for it to be attached or cloned.

- Before any change: pull `vaulte-docs`, read `FUTURE_FIXES.md` and `claude/CI_CD_Process.md` (including the local-session variant), and follow that process. Every new change is raised as a new Fix, numbered from the highest number in `FUTURE_FIXES.md` after pulling.
- A cycle is not finished until the docs are updated. After the merge and cleanup, in `vaulte-docs`: mark the Fix Done in `FUTURE_FIXES.md` with date, branch and PR; update the Fix's own doc under `claude/` if it has one; update `claude/CI_CD_Process.md` if the process changed. Commit to `main` of `vaulte-docs` and push (fetch first).
- The Claude Project "Vaulte" keeps a mirror of those docs. A session that can write to the Project (cloud) publishes the changed files to the same paths; a session that cannot (local) says the Project copy is behind.
- Never put personal or internal details (IDs, token paths, health data) in this public repo.

## Tests

- **Spec map (Fix 94):** `tests/ui/spec-map.json` says which UI specs exercise which source files; the tier tool uses it. Before starting each Fix, count the Fix commits on `main` since the map last changed: `git log $(git log -1 --format=%H -- tests/ui/spec-map.json)..main --oneline | grep -cE "^[0-9a-f]+ Fix [0-9]+"`. At 5 or more, rebuild it with `npm run spec-map` as its own Fix, without being asked, straight after the current Fix's cycle is finished. Jiten can also ask for a rebuild at any time.
- **Mutation survivors (Fix 96):** after every mutation run (full or one file), read `reports/mutation/mutation.json` and list the survivors (`Survived` and `NoCoverage`) as counts per file. For each, read the mutated line and judge whether the change alters behaviour: if not, it is equivalent (or unreachable); if it does and no test covers it, it is a real test gap. Report the real gaps (file:line, and what a test should check) in the summary, and say that the judgement is mine.

## Working style

Bottom line first, brief answers, minimal preamble. State assumptions in one line instead of asking. Anything the user must do is given one step at a time. No suggestions or closing offers unless asked.
