import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const checker = new URL("./check-public-text.mjs", import.meta.url);

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

test("--commits --all reports an issue in the older of two commits", () => {
  const repository = mkdtempSync(join(tmpdir(), "pg-public-text-test-"));
  try {
    git(repository, ["init", "--quiet"]);
    git(repository, ["config", "user.name", "Public Text Test"]);
    git(repository, ["config", "user.email", "public-text@example.invalid"]);
    git(repository, ["config", "commit.gpgsign", "false"]);
    writeFileSync(join(repository, "note.txt"), "clean file\n");
    git(repository, ["add", "note.txt"]);
    git(repository, ["commit", "--quiet", "-m", "older #84"]);
    const olderCommit = git(repository, ["rev-parse", "HEAD"]);

    writeFileSync(join(repository, "note.txt"), "still clean\n");
    git(repository, ["commit", "--quiet", "-am", "newer clean commit"]);

    const result = spawnSync(process.execPath, [fileURLToPath(checker), "--commits", "--all"], {
      cwd: repository,
      encoding: "utf8",
    });
    const output = `${result.stdout}\n${result.stderr}`;
    assert.notEqual(result.status, 0, output);
    assert.match(output, new RegExp(`commit ${olderCommit}:\\d+: issue reference`));
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
});
