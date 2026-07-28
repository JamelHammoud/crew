import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const out = path.join(root, 'hangup-probe.html')

const ENTRY = `
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { CameraGlyph, CloseGlyph, DesktopGlyph, ExpandGlyph, LeaveGlyph, MicGlyph, SpeakerGlyph }
  from ${JSON.stringify(path.join(root, 'src/renderer/src/icons/index.ts'))}
export function draw() {
  const at = (Icon, px) => renderToStaticMarkup(createElement(Icon, { className: 'w-[' + px + 'px] h-[' + px + 'px]' }))
  return {
    mic18: at(MicGlyph, 18), camera18: at(CameraGlyph, 18), desktop18: at(DesktopGlyph, 18),
    expand18: at(ExpandGlyph, 18), leave18: at(LeaveGlyph, 18),
    mic24: at(MicGlyph, 24), speaker24: at(SpeakerGlyph, 24), leave24: at(LeaveGlyph, 24),
    close20: at(CloseGlyph, 20)
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
  const g = draw()

  await writeFile(
    out,
    `<!doctype html><meta charset="utf8"><style>
      :root{--ink900:#0c0d0e;--ink800:#151719;--ink700:#212426;--fg:#f5f5f5;--danger:#ff6b6b}
      body{margin:0;padding:30px;background:var(--ink900);color:var(--fg);
        font:12px -apple-system,system-ui,sans-serif}
      h3{font-size:11px;color:#8b8f94;font-weight:600;margin:0 0 12px}
      section{margin-bottom:34px}
      .bar{display:flex;align-items:center;gap:6px;background:var(--ink800);
        border-radius:999px;padding:8px 10px;width:max-content}
      .btn{width:40px;height:40px;border-radius:999px;display:inline-flex;
        align-items:center;justify-content:center}
      .big{width:56px;height:56px}
      .on{background:var(--fg);color:var(--ink900)}
      .off{background:rgb(245 245 245/.08);color:#a7abb0}
      .quiet{background:rgb(245 245 245/.10);color:var(--fg)}
      .danger{background:rgb(255 107 107/.15);color:var(--danger)}
      .solid{background:var(--danger);color:#fff}
      .chrome{background:var(--ink800);color:#a7abb0}
      .rule{width:1px;height:24px;background:rgb(245 245 245/.08);margin:0 4px}
      .row{display:flex;align-items:center;gap:12px}
      .zoom{zoom:2.4;margin-top:18px;width:max-content}
    </style>
    <section>
      <h3>Huddle controls</h3>
      <div class="bar">
        <span class="btn on">${g.mic18}</span>
        <span class="btn on">${g.camera18}</span>
        <span class="btn off">${g.desktop18}</span>
        <span class="btn off">${g.expand18}</span>
        <span class="rule"></span>
        <span class="btn danger">${g.leave18}</span>
      </div>
      <div class="zoom"><div class="bar">
        <span class="btn on">${g.mic18}</span>
        <span class="btn off">${g.expand18}</span>
        <span class="rule"></span>
        <span class="btn danger">${g.leave18}</span>
      </div></div>
    </section>
    <section>
      <h3>Voice</h3>
      <div class="row">
        <span class="btn chrome">${g.close20}</span>
        <span style="width:40px"></span>
        <span class="btn big quiet">${g.mic24}</span>
        <span class="btn big quiet">${g.speaker24}</span>
        <span class="btn big solid">${g.leave24}</span>
      </div>
      <div class="zoom"><div class="row">
        <span class="btn big quiet">${g.mic24}</span>
        <span class="btn big solid">${g.leave24}</span>
      </div></div>
    </section>`
  )
  console.log(out)
} finally {
  await rm(dir, { recursive: true, force: true })
}
