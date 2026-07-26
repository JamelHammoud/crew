import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const ENTRY = `
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import * as icons from ${JSON.stringify(path.join(root, 'src/renderer/src/icons/index.ts'))}
export function draw(names) {
  return names.map(name => renderToStaticMarkup(createElement(icons[name], {})))
}
`

const dir = await mkdtemp(path.join(root, 'node_modules', '.crew-try-'))
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
  const [sun, moon, on, off] = draw(['SunGlyph', 'MoonGlyph', 'SpeakerGlyph', 'SpeakerOffGlyph'])

  const row = (mark, label) => `<div class="row">${mark}<em>${label}</em></div>`
  const menu = (a, b) => `<div class="menu">${a}${b}</div>`
  const pair = (mark, label) => `
    <div class="card">
      <div class="zoom">${mark}</div>
      <span class="name">${label}</span>
    </div>`

  await writeFile(
    path.join(root, 'speaker-try.html'),
    `<!doctype html><meta charset="utf8"><style>
      body{margin:0;padding:24px;background:#0c0d0e;color:#f5f5f5;font:11px -apple-system,system-ui,sans-serif;display:flex;gap:24px;align-items:flex-start}
      .menu{background:#1b1e21;border:1px solid #2a2e32;border-radius:14px;padding:6px;width:196px}
      .row{display:flex;align-items:center;gap:10px;font-size:13px;color:#d6dade;padding:7px 10px;border-radius:9px}
      .row:hover{background:#25292d}
      .row em{font-style:normal}
      .row svg{width:16px;height:16px;flex:none}
      .cards{display:flex;gap:12px}
      .card{background:#151719;border-radius:14px;padding:14px;display:flex;flex-direction:column;align-items:center;gap:10px}
      .zoom{display:inline-flex;width:16px;height:16px;zoom:6}
      .zoom svg{width:100%;height:100%}
      .name{color:#8b8f94;font-size:10px}
    </style>
    <div>
      ${menu(row(sun, 'Light mode'), row(off, 'Mute sounds'))}
    </div>
    <div>
      ${menu(row(moon, 'Dark mode'), row(on, 'Unmute sounds'))}
    </div>
    <div class="cards">${pair(on, 'on')}${pair(off, 'off')}</div>`
  )
  console.log('drawn')
} finally {
  await rm(dir, { recursive: true, force: true })
}
