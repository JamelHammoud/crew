import { build } from 'vite'
import tailwind from '@tailwindcss/vite'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
const root = new URL('./.shiftprobe/', import.meta.url).pathname
await build({ root, base: './', logLevel: 'error', plugins: [tailwind()], build: { outDir: path.join(root, 'dist'), emptyOutDir: true } })
const assets = path.join(root, 'dist/assets')
const files = await readdir(assets)
const css = await readFile(path.join(assets, files.find(f => f.endsWith('.css'))), 'utf8')
const hidden = css.indexOf('.hidden{')
const shift = css.indexOf('shift\\:flex')
console.log('hidden at', hidden, JSON.stringify(css.slice(hidden, hidden + 40)))
console.log('shift  at', shift, JSON.stringify(css.slice(Math.max(0, shift - 2), shift + 90)))
console.log(shift > hidden ? 'SHIFT WINS on order' : 'HIDDEN WINS on order')
