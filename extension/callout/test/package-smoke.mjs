import assert from "node:assert/strict";

const packageName = process.argv[2];
assert.ok(packageName, "package smoke needs a package name");
const packageExports = await import(packageName);
assert.ok(Object.keys(packageExports).length > 0, `${packageName} has no main exports`);

// Example packages expose one extension constructor whose exported name ends in "Extension".
const Extension = Object.values(packageExports).find((value) => typeof value === "function" && value.name.endsWith("Extension"));
assert.ok(Extension, `${packageName} has no extension constructor export`);
const extension = new Extension();
assert.equal(extension.name, packageName.replace(/^paginary-/, ""));
