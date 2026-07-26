import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  root: 'src/renderer',
  plugins: [react(), tailwindcss()],
  optimizeDeps: { exclude: ['@tldraw/assets'] },
  server: { port: 5199, strictPort: true }
})
