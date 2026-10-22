import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

/** Proves each public example through the same packed-core install a stranger would use. */
class ExampleCheck {
  /**
   * @param {string} id the kind/name identifier of the example.
   * @param {string} repositoryRoot the examples repository root.
   * @param {string} corePackage the built core package directory.
   * @param {string} coreArchive the packed core archive shared by this run.
   */
  constructor(id, repositoryRoot, corePackage, coreArchive) {
    this.id = id;
    this.repositoryRoot = repositoryRoot;
    this.exampleRoot = join(repositoryRoot, ...id.split("/"));
    this.corePackage = corePackage;
    this.coreArchive = coreArchive;
  }

  /** Run the isolated install, typecheck, one-Lexical check, and example tests. */
  run() {
    this.checkFileList();
    this.checkLicence();
    const copyRoot = join(tmpdir(), `pg-example-${this.id.replaceAll("/", "-")}-${process.pid}`);
    rmSync(copyRoot, { recursive: true, force: true });
    try {
      this.copyExample(copyRoot);
      this.usePackedCore(copyRoot);
      this.install(copyRoot);
      this.checkLexical(copyRoot);
      this.runTool(copyRoot, "typecheck", executable("npx"), ["--no-install", "tsc", "--noEmit"]);
      const testResult = this.runTool(copyRoot, "tests", executable("node"), ["--test", "--test-reporter=tap", "test/**/*.test.ts"]);
      const testOutput = `${testResult.stdout}\n${testResult.stderr}`;
      const testCount = testOutput.match(/(?:1\.\.|# tests )(\d+)/)?.[1] ?? "unknown";
      console.log(`${this.id}: ${testCount} tests passed`);
      const packageJson = JSON.parse(readFileSync(join(copyRoot, "package.json"), "utf8"));
      if (packageJson.scripts?.build) this.checkPackage(copyRoot);
      if (packageJson.scripts?.["test:browser"]) this.runBrowserTests(copyRoot);
      console.log(`${this.id}: example checks passed`);
    } finally {
      rmSync(copyRoot, { recursive: true, force: true });
    }
  }

  /** Pack the example, then prove a fresh consumer can install and use the public package surface. */
  checkPackage(copyRoot) {
    const packageJson = JSON.parse(readFileSync(join(copyRoot, "package.json"), "utf8"));
    const packDirectory = mkdtempSync(join(tmpdir(), "pg-example-package-"));
    let archivePath;
    try {
      const packResult = this.runTool(copyRoot, "package", executable("npm"), ["pack", "--json", "--pack-destination", packDirectory]);
      const metadata = JSON.parse(packResult.stdout)[0];
      const files = metadata.files.map(({ path }) => path.replace(/^package\//, ""));
      const allowed = (file) => file === "package.json" || file === "README.md" || file === "LICENSE" || file.startsWith("dist/");
      if (!files.some((file) => file.startsWith("dist/")) || files.some((file) => !allowed(file))) {
        throw new Error(`${this.id}: package contains unexpected files: ${files.join(", ")}`);
      }
      archivePath = join(packDirectory, metadata.filename);
      if (!existsSync(archivePath)) throw new Error(`${this.id}: package archive was not created`);
      console.log(`${this.id}: package check passed`);

      const consumerRoot = mkdtempSync(join(tmpdir(), "pg-example-consumer-"));
      try {
        writeFileSync(join(consumerRoot, "package.json"), JSON.stringify({ private: true, type: "module" }, null, 2));
        const peers = Object.entries(packageJson.peerDependencies ?? {}).map(([name, version]) => `${name}@${version}`);
        this.runTool(consumerRoot, "consumer install", executable("npm"), ["install", "--no-package-lock", "--ignore-scripts", archivePath, this.coreArchive, ...peers]);
        this.checkLexical(consumerRoot);
        writeFileSync(join(consumerRoot, "consumer.mjs"), 'import { CalloutExtension } from "paginary-example-callout";\nif (!(new CalloutExtension() instanceof CalloutExtension)) throw new Error("CalloutExtension was not constructed");\n');
        this.runTool(consumerRoot, "consumer import", executable("node"), ["consumer.mjs"]);
        writeFileSync(join(consumerRoot, "consumer.ts"), 'import { CalloutExtension } from "paginary-example-callout";\nnew CalloutExtension();\n');
        this.runTool(consumerRoot, "consumer typecheck", executable("npx"), ["--no-install", "tsc", "--noEmit", "--module", "ESNext", "--moduleResolution", "bundler", "--target", "ES2020", "--strict", "--skipLibCheck", "consumer.ts"]);
      } finally {
        rmSync(consumerRoot, { recursive: true, force: true });
      }
    } finally {
      rmSync(packDirectory, { recursive: true, force: true });
    }
  }

  /** Install the browser engine and run the copied example's Playwright tests. */
  runBrowserTests(copyRoot) {
    const browserInstallArgs = ["--no-install", "playwright", "install", "chromium"];
    if (process.env.CI) browserInstallArgs.push("--with-deps");
    this.runTool(copyRoot, "browser install", executable("npx"), browserInstallArgs);
    this.runTool(copyRoot, "browser tests", executable("npm"), ["run", "test:browser"]);
    console.log(`${this.id}: browser test passed`);
  }

  /** Require the README file list to match every tracked file in this example. */
  checkFileList() {
    const tracked = gitFiles(this.repositoryRoot, this.id).map((file) => relative(this.exampleRoot, join(this.repositoryRoot, file)).replaceAll("\\", "/"));
    const listed = readFileSync(join(this.exampleRoot, "README.md"), "utf8").match(/^\s*-\s+`([^`]+)`/gm)?.map((line) => line.match(/`([^`]+)`/)?.[1]).filter(Boolean) ?? [];
    const expected = new Set([...listed, "README.md"]);
    const actual = new Set(tracked);
    const missing = [...expected].filter((file) => !actual.has(file)).sort();
    const unlisted = [...actual].filter((file) => !expected.has(file)).sort();
    if (missing.length || unlisted.length) {
      const details = [
        ...missing.map((file) => `missing from git: ${file}`),
        ...unlisted.map((file) => `unlisted in README.md: ${file}`),
      ];
      throw new Error(`${this.id}: file list mismatch\n${details.map((detail) => `  ${detail}`).join("\n")}`);
    }
  }

  /** Require the example license to be byte-identical to the repository license. */
  checkLicence() {
    const root = readFileSync(join(this.repositoryRoot, "LICENSE"));
    const example = readFileSync(join(this.exampleRoot, "LICENSE"));
    if (!root.equals(example)) throw new Error(`${this.id}: LICENSE does not match the root LICENSE`);
  }

  /** Copy only the example source; a temporary install must not inherit dependencies. */
  copyExample(copyRoot) {
    cpSync(this.exampleRoot, copyRoot, {
      recursive: true,
      filter: (source) => !source.split(/[\\/]/).includes("node_modules"),
    });
  }

  /** Point the copied package at the one packed core used by every isolated example install. */
  usePackedCore(copyRoot) {
    const packagePath = join(copyRoot, "package.json");
    const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
    packageJson.dependencies ??= {};
    packageJson.dependencies["@paginary/core"] = `file:${this.coreArchive}`;
    if (packageJson.devDependencies) delete packageJson.devDependencies["@paginary/core"];
    writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  }

  /** Install the example and core peers without creating a lock file. */
  install(copyRoot) {
    this.runTool(copyRoot, "install", executable("npm"), ["install", "--no-package-lock"]);
  }

  /** Require npm's dependency tree to resolve exactly one Lexical path. */
  checkLexical(copyRoot) {
    const result = spawnSync(executable("npm"), shellArguments(["ls", "lexical", "--all", "--parseable"]), {
      cwd: copyRoot,
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    const paths = result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (result.error || result.status !== 0 || paths.length !== 1) {
      throw new Error(`${this.id}: lexical check failed: expected one path; found ${paths.length}`);
    }
  }

  /** Run one dependency command and turn its output into an example-scoped failure. */
  runTool(cwd, step, command, args) {
    const result = spawnSync(command, shellArguments(args), {
      cwd,
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    if (result.error || result.status !== 0) {
      const detail = [result.error?.message, result.stdout, result.stderr].filter(Boolean).join("\n").trim();
      throw new Error(`${this.id}: ${step} failed${detail ? `: ${detail}` : ""}`);
    }
    return result;
  }
}

/** Return the Windows command name where npm exposes a .cmd shim. */
function executable(command) {
  return process.platform === "win32" && (command === "npm" || command === "npx") ? `${command}.cmd` : command;
}

/** Quote every child-process argument because cmd.exe receives Node's shell-joined command line. */
function shellArguments(args) {
  if (process.platform !== "win32") return args;
  return args.map((arg) => `"${arg.replaceAll('"', '\\"')}"`);
}

/** Return the tracked paths under one example identifier. */
function gitFiles(repositoryRoot, exampleId) {
  const result = spawnSync("git", ["ls-files", "--", exampleId], { cwd: repositoryRoot, encoding: "utf8" });
  if (result.error || result.status !== 0) throw new Error(`git ls-files failed: ${result.stderr || result.error?.message || "unknown error"}`);
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

/** Pack core once so every isolated example install tests the same artifact. */
function packCore(corePackage, packDirectory) {
  const result = spawnSync(executable("npm"), shellArguments(["pack", corePackage, "--pack-destination", packDirectory]), {
    cwd: dirname(packDirectory),
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (result.error || result.status !== 0) {
    const detail = [result.error?.message, result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`core: pack failed${detail ? `: ${detail}` : ""}`);
  }
  const archives = readdirSync(packDirectory).filter((entry) => entry.endsWith(".tgz"));
  if (archives.length !== 1) throw new Error("core: pack failed: expected one .tgz archive");
  return join(packDirectory, archives[0]);
}

const repositoryRoot = process.cwd();
const argumentsList = process.argv.slice(2);
const requested = [];
let coreRoot = resolve(repositoryRoot, "..", "core");
for (let index = 0; index < argumentsList.length; index += 1) {
  const argument = argumentsList[index];
  if (argument === "--core") {
    const value = argumentsList[++index];
    if (!value) throw new Error("--core needs a folder");
    coreRoot = resolve(repositoryRoot, value);
  } else if (argument.startsWith("--core=")) {
    coreRoot = resolve(repositoryRoot, argument.slice("--core=".length));
  } else {
    requested.push(argument);
  }
}

const available = readdirSync(repositoryRoot, { withFileTypes: true })
  .filter((kind) => kind.isDirectory() && kind.name !== "node_modules" && !kind.name.startsWith("."))
  .flatMap((kind) => readdirSync(join(repositoryRoot, kind.name), { withFileTypes: true })
    .filter((example) => example.isDirectory() && existsSync(join(repositoryRoot, kind.name, example.name, "package.json")))
    .map((example) => `${kind.name}/${example.name}`))
  .sort();
const names = requested.length === 0 ? available : requested;
for (const name of names) {
  if (!available.includes(name)) throw new Error(`unknown example: ${name}`);
}
if (names.length === 0) throw new Error("no examples found");

const packDirectory = mkdtempSync(join(tmpdir(), "pg-example-core-"));
try {
  if (!existsSync(join(coreRoot, "dist", "index.js"))) throw new Error("core: build core first: `npm run build:lib` in core");
  const corePackage = realpathSync(coreRoot);
  const coreArchive = packCore(corePackage, packDirectory);
  for (const name of names) new ExampleCheck(name, repositoryRoot, corePackage, coreArchive).run();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  rmSync(packDirectory, { recursive: true, force: true });
}
