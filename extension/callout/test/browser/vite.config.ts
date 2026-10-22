import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export const TEST_PORT = 5179;

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  server: { port: TEST_PORT, strictPort: true },
  // The copied example installs a packed sibling core. Its metadata still carries a development
  // condition pointing at source, while the published core exposes only its dist import entry.
  resolve: { conditions: ["import", "module", "browser", "default"] },
  // Prebundle one dependency graph so core and the example share one Lexical constructor; separate
  // copies fail Lexical's node identity checks on the first editor update.
  optimizeDeps: { include: ["lexical", "@lexical/selection", "@paginary/core"] },
});
