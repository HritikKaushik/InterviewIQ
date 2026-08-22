/**
 * Fetches (clones or updates) the upstream dataset repository into `.data-source/`.
 *
 * The upstream repo is the single source of truth for every field this app
 * displays. It is intentionally kept OUT of version control (see .gitignore) so
 * the dataset can be refreshed without polluting this repo's history.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "https://github.com/liquidslr/leetcode-company-wise-problems.git";
export const SOURCE_DIR = path.join(ROOT, ".data-source");

const git = (args, cwd = ROOT) =>
  execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "inherit"] }).toString().trim();

function main() {
  if (existsSync(path.join(SOURCE_DIR, ".git"))) {
    console.log("· updating existing dataset checkout…");
    git(["fetch", "--depth", "1", "origin", "HEAD"], SOURCE_DIR);
    git(["reset", "--hard", "FETCH_HEAD"], SOURCE_DIR);
  } else {
    console.log("· cloning dataset…");
    mkdirSync(path.dirname(SOURCE_DIR), { recursive: true });
    git(["clone", "--depth", "1", REPO, SOURCE_DIR]);
  }
  const sha = git(["rev-parse", "--short", "HEAD"], SOURCE_DIR);
  const date = git(["log", "-1", "--format=%cI"], SOURCE_DIR);
  console.log(`✓ dataset at ${sha} (${date})`);
}

main();
