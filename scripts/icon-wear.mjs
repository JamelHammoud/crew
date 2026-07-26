import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

// Every set crew owns, drawn at the one size nearly all of it is worn at, and
// again at three times that so a stroke can be judged. The sheet is for keylines
// and the audit; this is for the eye.

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const out = path.join(root, 'icon-wear.html')

const SETS = [
  ['Crew icons', 'src/renderer/src/icons/index.ts'],
  ['Thread steps', 'src/renderer/src/components/toolGlyphs.tsx'],
  ['Doc blocks', 'src/renderer/src/components/doc/docGlyphs.tsx'],
  ['Design canvas', 'src/renderer/src/design/glyphs.tsx']
]

const ENTRY = `
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
${SETS.map(([, from], i) => `import * as set${i} from ${JSON.stringify(path.join(root, from))}`).join('\n')}
const sets = [${SETS.map((_, i) => `set${i}`).join(', ')}]
export function draw() {
  return sets.map(set =>
    Object.entries(set)
      .filter(([name, value]) => name.endsWith('Glyph') && typeof value === 'function')
      .map(([name, Icon]) => {
        try {
          return { name, markup: renderToStaticMarkup(createElement(Icon, {})) }
        } catch {
          return null
        }
      })
      .filter(Boolean)
  )
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
  const drawn = draw()

  const card = icon => `
    <div class="card">
      <span class="art">${icon.markup}</span>
      <span class="big">${icon.markup}</span>
      <span class="name">${icon.name.replace(/Glyph$/, '')}</span>
    </div>`

  const section = (title, icons) => `
    <h2>${title} <span>${icons.length}</span></h2>
    <div class="grid">${icons.map(card).join('')}</div>`

  await writeFile(
    out,
    `<!doctype html><meta charset="utf8"><style>
      body{margin:0;padding:22px;background:#0c0d0e;color:#f5f5f5;font:11px -apple-system,system-ui,sans-serif}
      h2{font-size:12px;font-weight:600;margin:22px 0 10px;color:#f5f5f5}
      h2 span{color:#4d5155;font-weight:400}
      .grid{display:grid;grid-template-columns:repeat(9,1fr);gap:8px}
      .card{background:#151719;border-radius:12px;padding:10px 6px;display:flex;flex-direction:column;align-items:center;gap:7px}
      .name{color:#8b8f94;font-size:9px;text-align:center;line-height:1.2}
      .art{display:inline-flex;width:16px;height:16px}
      .big{display:inline-flex;width:16px;height:16px;zoom:3}
      svg{width:100%;height:100%}
    </style>
    ${SETS.map(([title], i) => section(title, drawn[i])).join('')}`
  )
  console.log(out, drawn.map(set => set.length).join(' + '))
} finally {
  await rm(dir, { recursive: true, force: true })
}
