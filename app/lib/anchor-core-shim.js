// Shim for @anchor-lang/core.
//
// @arcium-hq/client does `import anchorDefault, { BorshCoder } from
// "@anchor-lang/core"`, using the default import as the whole anchor namespace.
// But @anchor-lang/core's ESM build exposes only named exports (no default),
// which Turbopack rejects. We can't use the CJS build instead — CJS eagerly
// pulls in workspace.js / nodewallet.js (fs, child_process, toml), which break
// the browser bundle. The ESM build tree-shakes those Node-only modules away.
//
// So: re-export the ESM build's named exports AND synthesize a default export
// (the namespace). next.config.ts aliases "@anchor-lang/core" to this shim.
// The imports below target the ESM build by subpath so the alias isn't circular.
import * as anchor from "@anchor-lang/core/dist/esm/index.js";
export * from "@anchor-lang/core/dist/esm/index.js";
export default anchor;
