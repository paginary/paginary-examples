import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ISSUE_MARKER = /(?:^|[^\w#])#(?!\d{6}\b)(?!\d{8}\b)\d{2,}\b|\b[\w-]+(?:\/[\w-]+)?#(?!\d{6}\b)(?!\d{8}\b)\d{2,}\b/;
const PRIVATE_REPOSITORIES = [
  "internal-core",
  "internal-ext-standard",
  "internal-ext-premium",
  "internal-test-harness",
  "internal-ai-harness",
  "internal-pm",
  "paginary/internal-",
];
const PLANNING_MARKERS = [
  /\bmilestones?\b/i,
  /\bwave\s*\d+\b/i,
  /\bscenario\s*\d+\b/i,
  /\bP\d+\b/,
  /\bstep\s+\d+[a-z]?\b/i,
];
const RULES = [
  { name: "issue reference", pattern: ISSUE_MARKER },
  { name: "private repository", pattern: new RegExp(PRIVATE_REPOSITORIES.map(escapePattern).join("|")) },
  { name: "internal note", pattern: /@internal-note/ },
  ...PLANNING_MARKERS.map((pattern) => ({ name: "planning term", pattern })),
  { name: "agent folder", pattern: /\.delegated|agent-runs|\.tmp\// },
];
// These files must name some of the text the gate refuses: the CI workflow names the private repositories it
// checks out, this file holds the rules themselves, and its test holds an issue-number fixture. Each is exempt
// only from the rules listed for it.
const EXEMPTIONS_BY_FILE = new Map([
  [".github/workflows/ci.yml", new Set(["private repository"])],
  ["scripts/check-public-text.mjs", new Set(["private repository", "internal note", "agent folder"])],
  ["scripts/check-public-text.test.mjs", new Set(["issue reference"])],
]);

function escapePattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Checks tracked public files and commit messages for references that must stay private. */
export class PublicTextCheck {
  /**
   * @param {string} repositoryRoot the repository whose tracked files and history are checked.
   */
  constructor(repositoryRoot = process.cwd()) {
    this.repositoryRoot = repositoryRoot;
  }

  /**
   * Scan files and, when requested, commit messages.
   * @param {boolean} commits whether to include commit messages.
   * @param {string | null} selector a git range, or null when all commits should be checked.
   * @returns {string[]} findings formatted with their source and line number.
   */
  run(commits = false, selector = null) {
    const findings = this.trackedFindings();
    if (commits) findings.push(...this.commitFindings(selector));
    return findings;
  }

  /**
   * Run git with an argument array in the checked repository.
   * @param {string[]} args git arguments, never a shell command string.
   * @returns {string} standard output from git.
   */
  git(args) {
    const result = spawnSync("git", args, { cwd: this.repositoryRoot, encoding: "utf8" });
    if (result.error || result.status !== 0) {
      throw new Error(`git ${args[0]} failed: ${result.stderr || result.error?.message || "unknown error"}`);
    }
    return result.stdout;
  }

  /**
   * Find rule matches in lines of one public source.
   * @param {string[]} lines source lines, without their line terminators.
   * @param {string} source file name or commit label used in findings.
   * @param {Set<string>} exemptions rule names intentionally allowed in this source file.
   * @returns {string[]} one finding for each matching rule and line.
   */
  findingsFor(lines, source, exemptions = new Set()) {
    const findings = [];
    lines.forEach((line, index) => {
      for (const rule of RULES) {
        if (exemptions.has(rule.name)) continue;
        if (rule.pattern.test(line)) findings.push(`${source}:${index + 1}: ${rule.name}`);
      }
    });
    return findings;
  }

  /**
   * Scan every tracked file except the two intentional rule-documentation files.
   * @returns {string[]} findings from tracked public files.
   */
  trackedFindings() {
    const files = this.git(["ls-files"]).split(/\r?\n/).map((file) => file.trim()).filter(Boolean);
    return files.flatMap((file) => {
      const text = readFileSync(join(this.repositoryRoot, file), "utf8");
      return this.findingsFor(text.split(/\r?\n/), file, EXEMPTIONS_BY_FILE.get(file));
    });
  }

  /**
   * Scan commit bodies from a range or all reachable commits.
   * @param {string | null} selector a git range, or null for every reachable commit.
   * @returns {string[]} findings from commit messages.
   */
  commitFindings(selector) {
    const logArguments = ["log", "--format=%x00%H%x00%B"];
    logArguments.push(selector === null ? "--all" : selector);
    const fields = this.git(logArguments).split("\0");
    const findings = [];
    for (let index = 0; index + 1 < fields.length; index += 1) {
      const hash = fields[index].trim();
      if (!/^[0-9a-f]{40}$/i.test(hash)) continue;
      findings.push(...this.findingsFor(fields[index + 1].split(/\r?\n/), `commit ${hash}`));
    }
    return findings;
  }
}

const argumentsList = process.argv.slice(2);
const commitIndex = argumentsList.indexOf("--commits");
const commits = commitIndex !== -1;
const selector = commits && argumentsList[commitIndex + 1] === "--all" ? null : commits ? argumentsList[commitIndex + 1] : null;
if (commits && selector === undefined) throw new Error("--commits needs a range or --all");
const findings = new PublicTextCheck().run(commits, selector);
if (findings.length) {
  for (const finding of findings) console.error(finding);
  process.exitCode = 1;
} else {
  console.log(commits ? "public text and commit check passed" : "public text check passed");
}
