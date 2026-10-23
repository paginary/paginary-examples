# Callout extension example

This example is a complete block-callout extension. It includes a Lexical node, container layout, chrome renderer, commands, selection state, theme tokens, a role, a variant, a headless reopen test, and a host editor registration.

## Run

Copy this folder to start your own extension. The example installs once `@paginary/core` is published on npm. `npm install` installs the standalone dependencies, and `npm run typecheck` checks the sources while you edit. `npm test` runs the unit and headless tests. `npm run build` emits the package's JavaScript and declarations. Run `npx playwright install chromium` once to install the browser, then `npm run test:browser` runs the page test. `npm pack` creates the publishable archive.

## Files

- `.gitignore`: ignored package installs, build output, and browser-test reports.
- `LICENSE`: the license for this copied example.
- `package.json`: the standalone package metadata and commands.
- `tsconfig.json`: TypeScript compiler settings for the example.
- `tsconfig.build.json`: emitting compiler settings for the package files.
- `playwright.config.ts`: the Chromium test runner and Vite server configuration.
- `src/CalloutNode.ts`: the callout Lexical node and its JSON and DOM conversions.
- `src/calloutLayout.ts`: the block flattener, layouter, and region renderer.
- `src/CalloutExtension.ts`: the extension registration, commands, selection state, and theme declarations.
- `src/index.ts`: the public exports for the example.
- `example/editor.ts`: a host editor registration that creates the extension.
- `test/callout.test.ts`: unit and headless tests for the callout.
- `test/callout-document.json`: a document fixture containing a warning callout.
- `test/package-smoke.mjs`: a generic smoke test for the built package entry point.
- `test/browser/index.html`: the page served by the browser fixture.
- `test/browser/main.ts`: the browser fixture content and editor mount.
- `test/browser/callout-window.ts`: the shared browser fixture window shape.
- `test/browser/vite.config.ts`: the Vite server and dependency prebundling configuration.
- `test/browser/callout.spec.ts`: the browser assertions for pagination, variants, and text.
