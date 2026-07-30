// electron.vite.config.ts
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
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
    plugins: [react(), tailwindcss()],
    // Pre-bundling would drop the ?url suffix its font and icon imports rely on.
    optimizeDeps: { exclude: ["@tldraw/assets"] },
    build: { rollupOptions: { input: "src/renderer/index.html" } }
  }
});
export {
  electron_vite_config_default as default
};
