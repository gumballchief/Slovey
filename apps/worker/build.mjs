import { build } from "esbuild";

/**
 * Bundle the worker into one standalone JS file so production runs `node
 * dist/worker.mjs` instead of `tsx src/index.ts`. tsx keeps esbuild resident and
 * transpiles the whole @company-brain/core graph on the fly (~50-80MB of RSS on a
 * 512MB box); a prebuilt bundle removes that overhead entirely. Workspace source
 * is inlined; real npm deps stay external (installed in node_modules).
 */
const externalizeNpm = {
  name: "externalize-npm",
  setup(b) {
    b.onResolve({ filter: /^[^./]/ }, (args) => {
      if (args.path.startsWith("@company-brain/")) return undefined; // bundle workspace source
      return { path: args.path, external: true };
    });
  },
};

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: "dist/worker.mjs",
  plugins: [externalizeNpm],
  banner: {
    js: "import { createRequire as __cr } from 'node:module';\nimport { fileURLToPath as __f } from 'node:url';\nimport { dirname as __d } from 'node:path';\nconst require = __cr(import.meta.url);\nconst __filename = __f(import.meta.url);\nconst __dirname = __d(__filename);",
  },
  logLevel: "info",
});

console.log("built dist/worker.mjs");
