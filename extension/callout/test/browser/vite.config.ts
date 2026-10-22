import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export const TEST_PORT = 5179;

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  server: { port: TEST_PORT, strictPort: true },
  // Resolve packages through their built entry points. A core built from source can also declare a
  // development condition that points at its sources; the core published on npm has none, so with
  // it this line changes nothing.
  resolve: { conditions: ["import", "module", "browser", "default"] },
  // Prebundle one dependency graph so core and the example share one Lexical constructor; separate
  // copies fail Lexical's node identity checks on the first editor update.
  optimizeDeps: { include: ["lexical", "@lexical/selection", "@paginary/core"] },
});
