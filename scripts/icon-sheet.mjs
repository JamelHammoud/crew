import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { measure } from './icon-geometry.mjs'

// Draws every icon crew owns onto one page, at the sizes it is really worn at,
// and measures each one against the keyline it is supposed to sit on. An icon
// set is the one thing that cannot be reviewed a file at a time: the whole point
// is how they look beside each other.

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const out = path.join(root, 'icon-sheet.html')

const SETS = [
  { title: 'Crew icons', from: 'src/renderer/src/icons/index.ts', audit: true },
  { title: 'Thread steps', from: 'src/renderer/src/components/toolGlyphs.tsx', audit: true },
  { title: 'Doc blocks', from: 'src/renderer/src/components/doc/docGlyphs.tsx', audit: false }
]

const LIVE = 19.5
const SQUARE = 17
const CIRCLE = 18.5

const ENTRY = (files) => `
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
${files.map((file, i) => `import * as set${i} from ${JSON.stringify(path.join(root, file))}`).join('\n')}
const sets = [${files.map((_, i) => `set${i}`).join(', ')}]
export function draw() {
  return sets.map(set =>
    Object.entries(set)
      .filter(([, value]) => typeof value === 'function' && /^[A-Z]/.test(value.name || ''))
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

async function collect() {
  const dir = await mkdtemp(path.join(tmpdir(), 'crew-icons-'))
  try {
    const entry = path.join(dir, 'entry.jsx')
    await writeFile(entry, ENTRY(SETS.map(set => set.from)))
    const bundle = path.join(dir, 'bundle.mjs')
    await build({
      entryPoints: [entry],
      bundle: true,
      format: 'esm',
      platform: 'node',
      outfile: bundle,
      jsx: 'automatic',
      loader: { '.ts': 'ts', '.tsx': 'tsx' },
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      absWorkingDir: root,
      logLevel: 'silent'
    })
    const { draw } = await import(`file://${bundle}`)
    return draw()
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

// A rect keeps the square's area as it flattens, so the number an icon is held
// to is the geometric mean of its own box rather than its longest side.
function keyline(box) {
  const round = Math.abs(box.width - box.height) < 1.2
  const target = round ? CIRCLE : SQUARE
  const size = round ? (box.width + box.height) / 2 : Math.sqrt(box.width * box.height)
  return { target, size, off: (size / target - 1) * 100 }
}

function report(rows) {
  const inks = rows.map(row => row.box.ink).sort((a, b) => a - b)
  const median = inks[Math.floor(inks.length / 2)] || 1
  return rows.map(row => {
    const { target, size, off } = keyline(row.box)
    const drift = Math.max(Math.abs(row.box.cx - 12), Math.abs(row.box.cy - 12))
    const over = Math.max(0, row.box.x + row.box.width - (12 + LIVE / 2), 12 - LIVE / 2 - row.box.x)
    return {
      ...row,
      target,
      size,
      off,
      drift,
      over,
      weight: (row.box.ink / median - 1) * 100
    }
  })
}

const svg = (markup, px) =>
  markup.replace('<svg', `<svg width="${px}" height="${px}"`).replace(/class="[^"]*"/, '')

const flag = (row) =>
  row.over > 0.01 ? 'over' : Math.abs(row.off) > 8 || Math.abs(row.weight) > 45 ? 'watch' : ''

function page(sets) {
  const cards = sets
    .map(
      set => `<section><h2>${set.title} <em>${set.rows.length}</em></h2><div class="grid">${set.rows
        .map(
          row => `<figure class="${flag(row)}">
  <div class="stage">
    <div class="keys"></div>
    ${svg(row.markup, 48)}
  </div>
  <div class="real">${svg(row.markup, 24)}${svg(row.markup, 20)}${svg(row.markup, 16)}</div>
  <figcaption>${row.name.replace(/Glyph$/, '')}</figcaption>
  <dl><dt>box</dt><dd>${row.size.toFixed(1)} / ${row.target}</dd>
      <dt>size</dt><dd class="${Math.abs(row.off) > 8 ? 'bad' : ''}">${row.off > 0 ? '+' : ''}${row.off.toFixed(1)}%</dd>
      <dt>ink</dt><dd class="${Math.abs(row.weight) > 45 ? 'bad' : ''}">${row.weight > 0 ? '+' : ''}${row.weight.toFixed(0)}%</dd>
      <dt>centre</dt><dd class="${row.drift > 0.5 ? 'bad' : ''}">${row.drift.toFixed(2)}</dd></dl>
</figure>`
        )
        .join('')}</div></section>`
    )
    .join('')
  return `<!doctype html><meta charset="utf-8"><title>Crew icons</title><style>
:root { color-scheme: dark; --ink-900:#0c0d0e; --ink-800:#161719; --ink-700:#232427; --fg:#f5f5f5; --fg-muted:#8b8d91; --fg-faint:#5a5c60; --danger:#ff6b6b; }
* { box-sizing: border-box }
body { margin:0; padding:40px; background:var(--ink-900); color:var(--fg); font:14px/1.5 -apple-system,BlinkMacSystemFont,system-ui,sans-serif }
h1 { font-size:16px; font-weight:600; margin:0 0 4px }
p.lede { color:var(--fg-muted); margin:0 0 32px; max-width:60ch }
h2 { font-size:13px; font-weight:600; margin:40px 0 16px; display:flex; gap:8px; align-items:center }
h2 em { color:var(--fg-faint); font-style:normal; font-size:11px }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:8px }
figure { margin:0; padding:14px 12px 12px; background:var(--ink-800); border:1px solid transparent; border-radius:20px; display:flex; flex-direction:column; align-items:center; gap:10px }
figure.watch { border-color:#5c4a1f }
figure.over { border-color:var(--danger) }
.stage { position:relative; width:72px; height:72px; display:grid; place-items:center }
.stage svg { position:relative }
.keys { position:absolute; inset:0; pointer-events:none; opacity:0 }
body.keys .keys { opacity:1 }
.keys::before, .keys::after { content:''; position:absolute; border:1px solid #3aa0ff55 }
.keys::before { inset:${((24 - SQUARE) / 24 / 2) * 100}%; }
.keys::after { inset:${((24 - CIRCLE) / 24 / 2) * 100}%; border-radius:50%; border-color:#ff9f3a55 }
.real { display:flex; align-items:center; gap:10px; color:var(--fg) }
figcaption { font-size:11px; color:var(--fg-muted); text-align:center; word-break:break-word }
dl { display:grid; grid-template-columns:auto auto; gap:0 8px; margin:0; font-size:10px; width:100%; color:var(--fg-faint) }
dl dt { text-align:left } dl dd { margin:0; text-align:right; font-variant-numeric:tabular-nums }
dl dd.bad { color:var(--danger) }
.bar { position:fixed; left:0; right:0; bottom:0; padding:12px 40px; background:#0c0d0eee; border-top:1px solid var(--ink-700); backdrop-filter:blur(12px); display:flex; gap:20px; font-size:12px; color:var(--fg-muted) }
label { display:flex; gap:6px; align-items:center; cursor:pointer }
body.light { background:#fff; color:#111 } body.light figure { background:#f2f2f3 }
</style>
<h1>Crew icons</h1>
<p class="lede">Each card shows the art at 48 with its keylines, then at the sizes it is really worn at: 24, 20 and 16. The numbers under it are the box against the keyline for its family, the ink against the median of the set, and how far the art's centre sits from the centre of the box. Red is outside the live area.</p>
${cards}
<div class="bar">
  <label><input type="checkbox" onchange="document.body.classList.toggle('keys')"> keylines</label>
  <label><input type="checkbox" onchange="document.body.classList.toggle('light')"> light</label>
  <span>square ${SQUARE} &middot; circle ${CIRCLE} &middot; live ${LIVE}</span>
</div>`
}

const drawn = await collect()
const sets = SETS.map((set, i) => ({
  title: set.title,
  audit: set.audit,
  rows: report(drawn[i].map(icon => ({ ...icon, box: measure(icon.markup) })).filter(icon => icon.box))
}))

await writeFile(out, page(sets))

for (const set of sets) {
  const over = set.rows.filter(row => row.over > 0.01)
  const off = set.rows.filter(row => Math.abs(row.off) > 8)
  console.log(`\n${set.title}  ${set.rows.length} icons`)
  console.log(`  outside the live area  ${over.length ? over.map(r => r.name).join(', ') : 'none'}`)
  console.log(
    `  off the keyline        ${off.length ? off.map(r => `${r.name} ${r.off > 0 ? '+' : ''}${r.off.toFixed(0)}%`).join(', ') : 'none'}`
  )
  const drift = set.rows.filter(row => row.drift > 0.5)
  console.log(`  off centre             ${drift.length ? drift.map(r => `${r.name} ${r.drift.toFixed(1)}`).join(', ') : 'none'}`)
}

console.log(`\n${out}`)
