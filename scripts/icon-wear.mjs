import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const out = path.join(root, 'icon-wear.html')

const SET = 'src/renderer/src/icons/index.ts'
const SIZES = [16, 14, 12]

const ENTRY = `
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import * as set from ${JSON.stringify(path.join(root, SET))}
export function draw() {
  return Object.entries(set)
    .filter(([, value]) => typeof value === 'function' && /^[A-Z]/.test(value.name || ''))
    .map(([name, Icon]) => ({
      name,
      sizes: [16, 14, 12].map(size => ({
        size,
        plain: renderToStaticMarkup(createElement(Icon, {})),
        heavy: renderToStaticMarkup(createElement(Icon, { strokeWidth: size === 16 ? 1.7 : 1.9 }))
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
      ${icon.sizes
        .map(
          s => `<div class="row">
            <span class="px">${s.size}</span>
            <span class="art" style="width:${s.size}px;height:${s.size}px">${s.plain}</span>
            <span class="art" style="width:${s.size}px;height:${s.size}px">${s.heavy}</span>
          </div>`
        )
        .join('')}
    </div>`

  await writeFile(
    out,
    `<!doctype html><meta charset="utf8"><style>
      body{margin:0;padding:24px;background:#0c0d0e;color:#f5f5f5;font:11px -apple-system,system-ui,sans-serif}
      .grid{display:grid;grid-template-columns:repeat(8,1fr);gap:10px}
      .card{background:#151719;border-radius:12px;padding:10px 8px}
      .name{color:#8b8f94;margin-bottom:8px;text-align:center;font-size:10px}
      .row{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:4px}
      .px{color:#4d5155;width:14px;text-align:right;font-size:9px}
      .art{display:inline-flex;align-items:center;justify-content:center}
      svg{width:100%;height:100%}
    </style><div class="grid">${icons.map(card).join('')}</div>`
  )
  console.log(out, icons.length)
} finally {
  await rm(dir, { recursive: true, force: true })
}
