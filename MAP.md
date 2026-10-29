# Map of examples

Generated from the code by the agent harness (`maps/map.mjs`). Do not edit it. A line about a file is
that file's header comment: correct the file, then regenerate.

## Packages

### @paginary/paginary-example, at the root

Standalone examples for the Paginary editor.

| Command | Runs |
|---|---|
| `npm run test` | `npm run test:examples && node --test scripts/check-public-text.test.mjs` |
| `npm run test:examples` | `node scripts/check-examples.mjs` |
| `npm run check:text` | `node scripts/check-public-text.mjs` |

### paginary-example-callout, in `extension/callout/`

Entry points: exports `.`.

| Command | Runs |
|---|---|
| `npm run test` | `node --test "test/**/*.test.ts"` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | `tsc -p tsconfig.build.json` |
| `npm run prepack` | `npm run build` |
| `npm run test:browser` | `playwright test` |

### paginary-example-counter, in `widget/counter/`

| Command | Runs |
|---|---|
| `npm run test` | `node --test "test/**/*.test.ts"` |
| `npm run typecheck` | `tsc --noEmit` |

## Source files

Each file with the first sentence of its header comment, and the test files that load it by path.

### `extension/callout/src/`

- `CalloutExtension.ts`: (no header comment)
- `calloutLayout.ts`: (no header comment) Tests: `extension/callout/test/callout.test.ts`.
- `CalloutNode.ts`: (no header comment)
- `index.ts`: (no header comment) Tests: `extension/callout/test/callout.test.ts`.

### `widget/counter/src/`

- `counterWidget.ts`: (no header comment) Tests: `widget/counter/test/counterWidget.test.ts`.

## Tests that name no source file

These reach the code another way, such as through a page in a browser. Each with the first sentence of its
header comment. Find the one for a feature by what the page shows.

- `extension/callout/test/browser/callout.spec.ts`: (no header comment)
- `scripts/check-public-text.test.mjs`: (no header comment)
