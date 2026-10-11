# Vaulte — instructions for Claude sessions

Read this first in every session, cloud or local.

## Docs

The process and fix docs are not in this repo. They are in the private repo `jsarathy/vaulte-docs`: `FUTURE_FIXES.md` and `claude/*.md`. Keep a clone next to this repo (`../vaulte-docs` on a local machine, `/home/claude/vaulte-docs` in a cloud session); if it is missing, ask for it to be attached or cloned.

- Before any change: pull `vaulte-docs`, read `FUTURE_FIXES.md` and `claude/CI_CD_Process.md` (including the local-session variant), and follow that process. Every new change is raised as a new Fix, numbered from the highest number in `FUTURE_FIXES.md` after pulling.
- A cycle is not finished until the docs are updated. After the merge and cleanup, in `vaulte-docs`: mark the Fix Done in `FUTURE_FIXES.md` with date, branch and PR; update the Fix's own doc under `claude/` if it has one; update `claude/CI_CD_Process.md` if the process changed. Commit to `main` of `vaulte-docs` and push (fetch first).
- The Claude Project "Vaulte" keeps a mirror of those docs. A session that can write to the Project (cloud) publishes the changed files to the same paths; a session that cannot (local) says the Project copy is behind.
- Never put personal or internal details (IDs, token paths, health data) in this public repo.

## Working style

Bottom line first, brief answers, minimal preamble. State assumptions in one line instead of asking. Anything the user must do is given one step at a time. No suggestions or closing offers unless asked.
