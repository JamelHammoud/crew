import { build } from 'vite'
import tailwind from '@tailwindcss/vite'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
await build({ root: '/tmp/shiftcheck', base: './', logLevel: 'silent', plugins: [tailwind()], build: { outDir: '/tmp/shiftcheck/dist', emptyOutDir: true } })
const assets = '/tmp/shiftcheck/dist/assets'
const files = await readdir(assets)
const css = await readFile(path.join(assets, files.find(f => f.endsWith('.css'))), 'utf8')
const hidden = css.indexOf('.hidden')
const shift = css.indexOf('shift\\:flex')
console.log('hidden at', hidden, JSON.stringify(css.slice(hidden, hidden + 60)))
console.log('shift at', shift, JSON.stringify(css.slice(Math.max(0,shift-20), shift + 90)))
console.log(shift > hidden ? 'SHIFT WINS' : 'HIDDEN WINS')
