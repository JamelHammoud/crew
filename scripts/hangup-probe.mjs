import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { formOf, measure } from './icon-geometry.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const out = path.join(root, 'hangup-probe.html')
const SLASH = 'm3.9 3.9 16.2 16.2'

// A bent bar with a pad at each end, drawn on 17 x 17. The outer elbow and the
// inner one are concentric on (12.5, 11.5), so the shaft keeps one thickness all
// the way round, and each pad flares inward off a concave notch.
const HANDSET =
  'M5.5 3.5h3a2 2 0 0 1 2 2v2a2.5 2.5 0 0 1-2.5 2.5v1.5A4.5 4.5 0 0 0 12.5 16h1.5a2.5 2.5 0 0 1 2.5-2.5h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-6A9 9 0 0 1 3.5 11.5v-6a2 2 0 0 1 2-2Z'

const flip = art => `<g transform="translate(24 0) scale(-1 1)">${art}</g>`
const spin = (art, deg, at = 12, scale = 1, dx = 0, dy = 0) =>
  `<g transform="translate(${dx} ${dy}) rotate(${deg} ${at} ${at}) translate(${at} ${at}) scale(${scale}) translate(${-at} ${-at})">${art}</g>`

const HAND = `<path d="${HANDSET}"></path>`
const HAND_SOLID = `<path d="${HANDSET}" fill="currentColor"></path>`

const CANDIDATES = [
  {
    key: '1',
    name: 'Slashed handset',
    note: 'the set’s own negation, the same SLASH as MicOff and CameraOff',
    art: `${flip(HAND)}<path d="${SLASH}"></path>`
  },
  {
    key: '2',
    name: 'Handset going down',
    note: 'the receiver rocking onto its rest',
    art: `${spin(HAND, 135, 12, 0.74, 0, -1.6)}<path d="M3.9 19.6a11 11 0 0 1 16.2 0"></path>`
  },
  {
    key: '3',
    name: 'Leave, already drawn',
    note: 'the mark the app already uses for leaving',
    art: '<path d="M13.5 4.5H6A2.5 2.5 0 0 0 3.5 7v10A2.5 2.5 0 0 0 6 19.5h7.5"></path><path d="M10 12h10.5"></path><path d="m16.5 8 4 4-4 4"></path>'
  },
  {
    key: '4',
    name: 'Door',
    note: 'the object version of leave, with a handle',
    art: '<path d="M13.5 3.4H6.9a1.6 1.6 0 0 0-1.6 1.6v14a1.6 1.6 0 0 0 1.6 1.6h6.6"></path><path d="M10.1 12.05v-.1"></path><path d="M13.4 12h7.1"></path><path d="m17.1 8.4 3.6 3.6-3.6 3.6"></path>'
  },
  {
    key: '5',
    name: 'Leaving the crew',
    note: 'the house mark, one disc stepping away',
    art: '<circle cx="7.1" cy="9.3" r="3.6"></circle><circle cx="12.6" cy="9.3" r="3.6"></circle><path d="M4.4 20.4a5.4 5.4 0 0 1 8.5-2.6"></path><path d="M15.5 18.2h5"></path><path d="m18.1 15.6 2.6 2.6-2.6 2.6"></path>'
  },
  {
    key: '6',
    name: 'Solid handset, hung up',
    note: 'keeps the solid, redrawn so it stops reading as an arch',
    art: spin(HAND_SOLID, 135, 12, 0.93)
  }
]

const TRIALS = [
  ['down 120', `${spin(HAND, 120, 12, 0.74, 0, -1.6)}<path d="M3.9 19.6a11 11 0 0 1 16.2 0"></path>`],
  ['down 135', `${spin(HAND, 135, 12, 0.74, 0, -1.6)}<path d="M3.9 19.6a11 11 0 0 1 16.2 0"></path>`],
  ['down 150', `${spin(HAND, 150, 12, 0.74, 0, -1.6)}<path d="M3.9 19.6a11 11 0 0 1 16.2 0"></path>`],
  ['solid 90', spin(HAND_SOLID, 90, 12, 0.93)],
  ['solid 135', spin(HAND_SOLID, 135, 12, 0.93)],
  ['solid 180', spin(HAND_SOLID, 180, 12, 0.93)],
  ['plain handset', HAND],
  ['flipped', flip(HAND)]
]

const ENTRY = `
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { CameraGlyph, DesktopGlyph, ExpandGlyph, MicGlyph, HangupGlyph } from ${JSON.stringify(path.join(root, 'src/renderer/src/icons/index.ts'))}
export function draw() {
  const at = (Icon, px) => renderToStaticMarkup(createElement(Icon, { className: 'w-[' + px + 'px] h-[' + px + 'px]' }))
  return {
    mic: at(MicGlyph, 18), camera: at(CameraGlyph, 18), desktop: at(DesktopGlyph, 18),
    expand: at(ExpandGlyph, 18), hangup: at(HangupGlyph, 18)
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
    one.box = box ? `${box.width.toFixed(1)} × ${box.height.toFixed(1)}` : 'transform'
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
        <span class="plain">${svg(one.art, 52, 1.7)}</span>
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
      .head b{color:#6f7276;margin-right:6px}
      .head span{display:block;color:#8b8f94;font-weight:400;font-size:11px;margin-top:3px}
      .bar{display:flex;align-items:center;gap:6px;background:#0c0d0e;
        border-radius:999px;padding:8px 10px;width:max-content}
      .btn{width:40px;height:40px;border-radius:999px;display:inline-flex;
        align-items:center;justify-content:center}
      .on{background:var(--fg);color:var(--ink900)}
      .off{background:rgb(245 245 245/.08);color:#a7abb0}
      .danger{background:rgb(255 107 107/.15);color:var(--danger)}
      .rule{width:1px;height:24px;background:rgb(245 245 245/.08);margin:0 4px}
      .zooms{display:flex;align-items:center;gap:24px;margin-top:14px}
      .z{display:inline-flex;zoom:2.6}
      .plain{display:inline-flex;color:var(--fg);opacity:.85}
      h3{font-size:11px;color:#8b8f94;font-weight:600;margin:26px 0 10px}
      .trials{display:flex;flex-wrap:wrap;gap:10px}
      .trial{background:var(--ink800);border-radius:14px;padding:10px 8px;width:104px;
        display:flex;flex-direction:column;align-items:center;gap:8px}
      .trial b{font-size:9px;color:#8b8f94;font-weight:400}
      .trial .z{zoom:2.2}
    </style>
    <div class="grid">${CANDIDATES.map(row).join('')}</div>
    <h3>trials</h3>
    <div class="trials">${TRIALS.map(
      ([label, art]) =>
        `<div class="trial"><span class="z"><span class="btn danger">${svg(art, 18)}</span></span><b>${label}</b></div>`
    ).join('')}</div>`
  )
  console.log(out)
} finally {
  await rm(dir, { recursive: true, force: true })
}
