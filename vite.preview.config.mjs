import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default {
  root: 'src/renderer',
  plugins: [react(), tailwindcss()],
  optimizeDeps: { exclude: ['@tldraw/assets'] },
  server: { port: 5199 }
}
