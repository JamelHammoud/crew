// electron.vite.config.ts
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// pdfjs-assets.ts
import { createRequire } from "node:module";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
var __electron_vite_injected_import_meta_url = "file:///Users/jamel/Documents/Repositories/crew/pdfjs-assets.ts";
var PDFJS_AT = "pdfjs/";
var PDFJS_DIRS = ["cmaps", "iccs", "standard_fonts", "wasm"];
var TYPES = {
  ".wasm": "application/wasm",
  ".js": "text/javascript",
  ".mjs": "text/javascript"
};
function pdfjsRoot() {
  return path.dirname(createRequire(__electron_vite_injected_import_meta_url).resolve("pdfjs-dist/package.json"));
}
async function pdfjsFiles() {
  const root = pdfjsRoot();
  const found = [];
  for (const dir of PDFJS_DIRS) {
    for (const name of await readdir(path.join(root, dir))) found.push(`${dir}/${name}`);
  }
  return found;
}
function under(rest) {
  const root = pdfjsRoot();
  const dir = rest.split("/")[0];
  if (!PDFJS_DIRS.some((known) => known === dir)) return null;
  const full = path.resolve(root, rest);
  return full.startsWith(path.join(root, dir) + path.sep) ? full : null;
}
function pdfjsAssets() {
  return {
    name: "crew-pdfjs-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const at = req.url?.split("?")[0];
        if (!at || !at.startsWith(`/${PDFJS_AT}`)) return next();
        const full = under(decodeURIComponent(at.slice(PDFJS_AT.length + 1)));
        if (!full) return next();
        void readFile(full).then(
          (body) => {
            res.setHeader("content-type", TYPES[path.extname(full)] ?? "application/octet-stream");
            res.end(body);
          },
          () => next()
        );
      });
    },
    async generateBundle() {
      const root = pdfjsRoot();
      for (const name of await pdfjsFiles()) {
        this.emitFile({
          type: "asset",
          fileName: `${PDFJS_AT}${name}`,
          source: await readFile(path.join(root, name))
        });
      }
    }
  };
}

// electron.vite.config.ts
var electron_vite_config_default = defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: {
          index: "src/main/index.ts",
          "scribe-function-key-listener": "src/main/scribe-function-key-listener.ts"
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { lib: { entry: "src/main/preload.ts" } }
  },
  renderer: {
    root: "src/renderer",
    plugins: [react(), tailwindcss(), pdfjsAssets()],
    build: { rollupOptions: { input: "src/renderer/index.html" } }
  }
});
export {
  electron_vite_config_default as default
};
