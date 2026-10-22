# Counter widget example

This example is a small counter widget with migration, a numeric step input, derived state, static export, mount tests, and an insert command.

Copy this folder, then run `npm install` and `npm test`. The example installs once `@paginary/core` is published on npm. Use `npm run typecheck` while editing.

## Files

- `LICENSE`: the license for this copied example.
- `package.json`: the standalone package metadata and commands.
- `tsconfig.json`: TypeScript compiler settings for the example.
- `src/counterWidget.ts`: the widget definition, mount lifecycle, exports, and editor extension.
- `example/editor.ts`: a host editor registration and insert-command helper.
- `test/counterWidget.test.ts`: unit, mount, export, migration, and headless tests for the counter.
