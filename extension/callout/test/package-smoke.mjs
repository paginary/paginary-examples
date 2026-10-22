import assert from "node:assert/strict";

const packageName = process.argv[2];
assert.ok(packageName, "package smoke needs a package name");
const packageExports = await import(packageName);
assert.ok(Object.keys(packageExports).length > 0, `${packageName} has no main exports`);
assert.ok(
  Object.values(packageExports).some((value) => typeof value === "function"),
  `${packageName} has no callable main export`,
);
