import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const out = path.join(root, 'icon-wear.html')

const SET = 'src/renderer/src/icons/index.ts'

const ENTRY = `
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import * as set from ${JSON.stringify(path.join(root, SET))}
const WEIGHTS = [1.5, 1.75, 2, 2.25]
export function draw() {
  return Object.entries(set)
    .filter(([, value]) => typeof value === 'function' && /^[A-Z]/.test(value.name || ''))
    .map(([name, Icon]) => ({
      name,
      art: WEIGHTS.map(weight => ({
        weight,
        markup: renderToStaticMarkup(createElement(Icon, { strokeWidth: weight }))
      }))
    }))
}
`

const dir = await mkdtemp(path.join(root, 'node_modules', '.crew-wear-'))
try {
  const entry = path.join(dir, 'entry.jsx')
  await writeFile(entry, ENTRY)
  const bundle = path.join(dir, 'bundle.mjs')
  await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    outfile: bundle,
    jsx: 'automatic',
    external: ['react', 'react-dom', 'react-dom/server'],
    logLevel: 'silent'
  })
  const { draw } = await import(bundle)
  const icons = draw()

  const card = icon => `
    <div class="card">
      <div class="name">${icon.name.replace(/Glyph$/, '')}</div>
      <div class="row">
        ${icon.art.map(a => `<span class="art">${a.markup}</span>`).join('')}
      </div>
    </div>`

  await writeFile(
    out,
    `<!doctype html><meta charset="utf8"><style>
      body{margin:0;padding:20px;background:#0c0d0e;color:#f5f5f5;font:11px -apple-system,system-ui,sans-serif}
      .head{display:flex;gap:20px;margin-bottom:14px;color:#8b8f94}
      .grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
      .card{background:#151719;border-radius:12px;padding:9px 6px}
      .name{color:#8b8f94;margin-bottom:7px;text-align:center;font-size:10px}
      .row{display:flex;align-items:center;justify-content:center;gap:14px}
      .art{display:inline-flex;width:16px;height:16px}
      svg{width:100%;height:100%}
    </style>
    <div class="head"><span>16px wear</span><span>1.5</span><span>1.75</span><span>2.0</span><span>2.25</span></div>
    <div class="grid">${icons.map(card).join('')}</div>`
  )
  console.log(out, icons.length)
} finally {
  await rm(dir, { recursive: true, force: true })
}
