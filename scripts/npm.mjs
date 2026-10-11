// scripts/npm.mjs — run npm from a script on any OS (Fix 75).
// On Windows npm is npm.cmd, which execFileSync("npm") cannot start (ENOENT); a command string runs
// through the shell on every OS. Only fixed argument lists are passed, never user input.
import { execSync } from "node:child_process";

/** Runs `npm <args>` and returns its output. On a non-zero exit it throws, with `.stdout` set. */
export const npm = (args, options = {}) =>
  execSync(["npm", ...args].join(" "), { encoding: "utf8", ...options });
