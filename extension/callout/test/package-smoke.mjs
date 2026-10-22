import assert from "node:assert/strict";

const packageName = process.argv[2];
assert.ok(packageName, "package smoke needs a package name");
const packageExports = await import(packageName);
assert.ok(Object.keys(packageExports).length > 0, `${packageName} has no main exports`);

// Example packages expose one extension constructor whose exported name ends in "Extension".
// The package name does not determine the extension name, so a copied example can be renamed.
// When it exports an *_EXTENSION_NAME string, the constructed extension uses that same name.
const Extension = Object.values(packageExports).find((value) => typeof value === "function" && value.name.endsWith("Extension"));
assert.ok(Extension, `${packageName} has no extension constructor export`);
const extension = new Extension();
assert.equal(typeof extension.name, "string", `${packageName} extension name is not a string`);
assert.ok(extension.name.length > 0, `${packageName} extension name is empty`);
const extensionName = Object.entries(packageExports).find(
  ([name, value]) => name.endsWith("_EXTENSION_NAME") && typeof value === "string",
)?.[1];
if (extensionName !== undefined) assert.equal(extension.name, extensionName);
