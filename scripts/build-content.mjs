import { build } from "esbuild";
import { mkdir } from "node:fs/promises";

await mkdir("dist", { recursive: true });

await build({
  entryPoints: ["src/content/entry.jsx"],
  outfile: "dist/content.js",
  bundle: true,
  format: "iife",
  target: ["chrome108"],
  define: {
    "process.env.NODE_ENV": '"production"'
  }
});
