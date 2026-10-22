# Paginary examples

Small, complete examples for the Paginary editor. Each example is a standalone package that a reader can copy into a project.

## Examples

- [Callout extension](extension/callout/): a block content type with layout, commands, selection state, and theming.
- [Counter widget](widget/counter/): a widget with state, inputs, derived output, mounting, and static export.

## Run an example

Copy an example folder, change into it, install its dependencies, and run its tests. The example installs once `@paginary/core` is published on npm.

```sh
cp -r extension/callout my-callout
cd my-callout
npm install
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm pack
```
