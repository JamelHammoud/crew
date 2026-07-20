import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { lib: { entry: 'src/main/index.ts' } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { lib: { entry: 'src/main/preload.ts' } }
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react(), tailwindcss()],
    build: { rollupOptions: { input: 'src/renderer/index.html' } }
  }
})
