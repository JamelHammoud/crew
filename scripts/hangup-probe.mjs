import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { formOf, measure } from './icon-geometry.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const out = path.join(root, 'hangup-probe.html')
const SLASH = 'm3.9 3.9 16.2 16.2'

const HANDSET =
  'M15.4 4.1a1.9 1.9 0 0 1 2.75.25L19.7 6.25a2.7 2.7 0 0 1 .45 2.7c-1.95 5-5.2 8.25-10.2 10.2a2.7 2.7 0 0 1-2.7-.45l-1.9-1.55a1.9 1.9 0 0 1-.25-2.75l1.6-1.95a1.9 1.9 0 0 1 2.4-.45l1.5.9a14.5 14.5 0 0 0 3.55-3.55l-.9-1.5a1.9 1.9 0 0 1 .45-2.4Z'

const SOLID_HANDSET =
  'M4.04 17.77A9.6 8 0 1 1 19.96 17.77A2.14 2.14 0 0 1 18.36 13.8A6.4 4.8 0 1 0 5.64 13.8A2.14 2.14 0 0 1 4.04 17.77Z'

const CANDIDATES = [
  {
    key: '1',
    name: 'Slashed handset',
    note: 'the set’s own negation, same SLASH as MicOff and CameraOff',
    art: `<path d="${HANDSET}"></path><path d="${SLASH}"></path>`
  },
  {
    key: '2',
    name: 'Handset going down',
    note: 'receiver rocking onto its rest',
    art: `<g transform="rotate(-38 12 10.5)"><path d="${HANDSET}" transform="translate(0 -2.5) scale(0.86) translate(2 2)"></path></g><path d="M4.5 19.5a9 9 0 0 1 15 0"></path>`
  },
  {
    key: '3',
    name: 'Leave (already drawn)',
    note: 'the mark the app already uses for leaving',
    art: '<path d="M13.5 4.5H6A2.5 2.5 0 0 0 3.5 7v10A2.5 2.5 0 0 0 6 19.5h7.5"></path><path d="M10 12h10.5"></path><path d="m16.5 8 4 4-4 4"></path>'
  },
  {
    key: '4',
    name: 'Door',
    note: 'the object version of leave',
    art: '<path d="M13.75 3.5H6.75a1.5 1.5 0 0 0-1.5 1.5v14a1.5 1.5 0 0 0 1.5 1.5h7"></path><path d="M10.25 12h.01"></path><path d="M13.5 12h7"></path><path d="m17.25 8.5 3.5 3.5-3.5 3.5"></path>'
  },
  {
    key: '5',
    name: 'Leaving the crew',
    note: 'the house mark, one disc stepping out',
    art: '<circle cx="6.2" cy="12" r="3.4"></circle><circle cx="11.9" cy="12" r="3.4"></circle><circle cx="19" cy="12" r="2.4"></circle>'
  },
  {
    key: '6',
    name: 'Solid handset, tilted',
    note: 'least change: keeps the solid, stops it reading as an arch',
    art: `<g transform="rotate(135 12 12)"><path d="${SOLID_HANDSET}" fill="currentColor"></path></g>`
  }
]

const NEIGHBOURS = `
import { CameraGlyph, DesktopGlyph, ExpandGlyph, MicGlyph, HangupGlyph } from ${JSON.stringify(path.join(root, 'src/renderer/src/icons/index.ts'))}
`

const ENTRY = `
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
${NEIGHBOURS}
export function draw() {
  const at = (Icon, px) => renderToStaticMarkup(createElement(Icon, { className: 'w-[' + px + 'px] h-[' + px + 'px]' }))
  return {
    mic: at(MicGlyph, 18),
    camera: at(CameraGlyph, 18),
    desktop: at(DesktopGlyph, 18),
    expand: at(ExpandGlyph, 18),
    hangup: at(HangupGlyph, 18)
  }
}
`

const dir = await mkdtemp(path.join(root, 'node_modules', '.crew-hangup-'))
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
  const real = draw()

  const svg = (art, px, stroke = 2) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" style="width:${px}px;height:${px}px">${art}</svg>`

  for (const one of CANDIDATES) {
    const box = measure(formOf(one.art, SLASH), 2)
    one.box = box
      ? `${box.width.toFixed(1)} × ${box.height.toFixed(1)}`
      : '—'
  }

  const row = one => `
    <div class="cand">
      <div class="head"><b>${one.key}</b> ${one.name}<span>${one.note}</span></div>
      <div class="bar">
        <span class="btn on">${real.mic}</span>
        <span class="btn on">${real.camera}</span>
        <span class="btn off">${real.desktop}</span>
        <span class="btn off">${real.expand}</span>
        <span class="rule"></span>
        <span class="btn danger">${svg(one.art, 18)}</span>
      </div>
      <div class="zooms">
        <span class="z"><span class="btn danger">${svg(one.art, 18)}</span></span>
        <span class="plain">${svg(one.art, 48, 1.6)}</span>
        <span class="dim">${one.box}</span>
      </div>
    </div>`

  await writeFile(
    out,
    `<!doctype html><meta charset="utf8"><style>
      :root{--ink900:#0c0d0e;--ink800:#151719;--fg:#f5f5f5;--danger:#ff6b6b}
      body{margin:0;padding:26px;background:var(--ink900);color:var(--fg);
        font:12px -apple-system,system-ui,sans-serif}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .cand{background:var(--ink800);border-radius:20px;padding:16px 18px}
      .head{font-size:12px;font-weight:600;margin-bottom:12px}
      .head b{color:#6f7276;font-weight:600;margin-right:6px}
      .head span{display:block;color:#8b8f94;font-weight:400;font-size:11px;margin-top:3px}
      .bar{display:flex;align-items:center;gap:6px;background:#0c0d0e;
        border-radius:999px;padding:8px 10px;width:max-content}
      .btn{width:40px;height:40px;border-radius:999px;display:inline-flex;
        align-items:center;justify-content:center}
      .on{background:var(--fg);color:var(--ink900)}
      .off{background:rgb(245 245 245/.08);color:#a7abb0}
      .danger{background:rgb(255 107 107/.15);color:var(--danger)}
      .rule{width:1px;height:24px;background:rgb(245 245 245/.08);margin:0 4px}
      .zooms{display:flex;align-items:center;gap:22px;margin-top:14px}
      .z{display:inline-flex;zoom:2.6}
      .plain{display:inline-flex;color:var(--fg);opacity:.85}
      .dim{color:#6f7276;font-size:10px;margin-left:auto;font-variant-numeric:tabular-nums}
    </style>
    <div class="grid">${CANDIDATES.map(row).join('')}</div>`
  )
  console.log(out)
} finally {
  await rm(dir, { recursive: true, force: true })
}
