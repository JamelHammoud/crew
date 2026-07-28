import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { compile } from '@tailwindcss/node'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const out = path.join(root, 'chip-probe.mjs.bundle.mjs')

await build({
  entryPoints: [path.join(root, 'scripts/chip-probe-entry.tsx')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  jsx: 'automatic',
  outfile: out,
  loader: { '.png': 'dataurl' },
  external: ['react', 'react-dom', 'react-dom/server', 'zustand', 'zustand/*']
})

const markup = execFileSync(process.execPath, [out], { encoding: 'utf8', cwd: root })

const source = fs.readFileSync(path.join(root, 'src/renderer/src/styles.css'), 'utf8')
const compiler = await compile(source, { base: root, onDependency: () => {} })
const candidates = [...new Set(markup.match(/[^"'\s<>]+/g) ?? [])]
const css = compiler.build(candidates)

fs.writeFileSync(
  path.join(root, 'chip-probe.html'),
  `<!doctype html><html class="dark"><head><meta charset="utf-8"><style>${css}</style></head><body class="bg-ink-900">${markup}</body></html>`
)
fs.rmSync(out)
console.log('wrote chip-probe.html')
