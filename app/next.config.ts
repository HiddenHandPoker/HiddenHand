import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    "http://192.168.1.10:3000",
    "http://localhost:3000",
  ],
  turbopack: {
    resolveAlias: {
      // @arcium-hq/client needs a default export from @anchor-lang/core that its
      // ESM build doesn't provide. Route through a shim that re-exports the ESM
      // build's names and adds a default (see lib/anchor-core-shim.js).
      "@anchor-lang/core": "./lib/anchor-core-shim.js",
      // The Arcium client statically imports Node built-ins: `crypto` (used by
      // RescueCipher for AES-CTR) and `fs` (only a Node keypair-read path, never
      // hit in-browser). Polyfill crypto for the browser bundle and stub fs.
      crypto: { browser: "crypto-browserify" },
      stream: { browser: "stream-browserify" },
      vm: { browser: "vm-browserify" },
      // fs / child_process are only used by @anchor-lang/core's workspace loader
      // and the Arcium client's keypair-read path — both Node-only, never reached
      // in the browser. Stub them so the (dead-in-browser) code still bundles.
      fs: { browser: "./lib/empty-module.js" },
      child_process: { browser: "./lib/empty-module.js" },
    },
  },
};

export default nextConfig;
