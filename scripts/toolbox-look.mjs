import { spawn } from 'node:child_process'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const shot = path.join(root, 'toolbox-look.png')

const rect = (x, y, w, h, r) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"></rect>`
const p = d => `<path d="${d}"></path>`

const arch = (halfSpan, top, foot, r) => {
  const l = 12 - halfSpan
  const rr = 12 + halfSpan
  return p(
    `M${l} ${foot}V${top + r}A${r} ${r} 0 0 1 ${l + r} ${top}h${2 * halfSpan - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}V${foot}`
  )
}

const VARIANTS = [
  { key: 'grip 9', art: rect(2.5, 9, 19, 10.5, 2.5) + p('M2.5 12.75H21.5') + arch(4.5, 4.5, 9, 2) },
  { key: 'grip 10', art: rect(2.5, 9, 19, 10.5, 2.5) + p('M2.5 12.75H21.5') + arch(5, 4.5, 9, 2) },
  { key: 'grip 11', art: rect(2.5, 9, 19, 10.5, 2.5) + p('M2.5 12.75H21.5') + arch(5.5, 4.5, 9, 2) }
]

const ROW = [
  ['ClockGlyph', 'Scheduled'],
  ['AtGlyph', 'Plugins'],
  ['CompassGlyph', 'Browser']
]

const ENTRY = `
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import * as set from ${JSON.stringify(path.join(root, 'src/renderer/src/icons/index.ts'))}
import { STROKE, wearWeight } from ${JSON.stringify(path.join(root, 'src/renderer/src/icons/keylines.ts'))}
const at = (name, px) =>
  renderToStaticMarkup(createElement(set[name], { className: 'w-[' + px + 'px] h-[' + px + 'px]' }))
    .replace(/class="[^"]*"/, 'style="width:' + px + 'px;height:' + px + 'px"')
export function draw() {
  return {
    row: ${JSON.stringify(ROW)}.map(([name, label]) => ({ label, svg: at(name, 16) })),
    weight: [64, 24, 20, 16].map(px => [px, wearWeight(STROKE, 'w-[' + px + 'px]')])
  }
}
`

const dir = await realpath(await mkdtemp(path.join(root, 'node_modules', '.crew-toolbox-look-')))
await writeFile(path.join(dir, 'entry.jsx'), ENTRY)
const bundle = path.join(dir, 'bundle.cjs')
await build({
  entryPoints: [path.join(dir, 'entry.jsx')],
  absWorkingDir: root,
  nodePaths: [path.join(root, 'node_modules')],
  bundle: true,
  outfile: bundle,
  format: 'cjs',
  platform: 'node',
  jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  logLevel: 'error'
})
const { createRequire } = await import('node:module')
const { row, weight } = createRequire(import.meta.url)(bundle).draw()
const weights = Object.fromEntries(weight)

const svg = (art, px) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${weights[px]}" stroke-linecap="round" stroke-linejoin="round" style="width:${px}px;height:${px}px">${art}</svg>`

const SIZES = [64, 24, 20, 16]

const page = `<!doctype html><html><body style="margin:0;background:#0c0d0e;color:#f5f5f5;font:13px -apple-system,system-ui,sans-serif;padding:28px">
<table style="border-collapse:collapse">
<tr><th></th>${SIZES.map(s => `<th style="padding:6px 18px;font-weight:400;color:#5a5c60">${s}</th>`).join('')}<th style="padding:6px 18px;font-weight:400;color:#5a5c60">in the menu</th></tr>
${VARIANTS.map(
  one =>
    `<tr><td style="padding:10px 18px 10px 0;color:#8b8d91;white-space:nowrap">${one.key}</td>` +
    SIZES.map(
      px => `<td style="padding:10px 18px"><span style="display:flex;justify-content:center">${svg(one.art, px)}</span></td>`
    ).join('') +
    `<td style="padding:10px 18px"><div style="width:168px;padding:5px;border-radius:13px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.09)">` +
    row
      .map(
        r =>
          `<div style="display:flex;align-items:center;gap:10px;height:26px;padding:0 9px;color:rgba(245,245,245,0.7)"><span style="display:flex">${r.svg}</span><span>${r.label}</span></div>`
      )
      .join('') +
    `<div style="display:flex;align-items:center;gap:10px;height:26px;padding:0 9px;color:rgba(245,245,245,0.7)"><span style="display:flex">${svg(one.art, 16)}</span><span>Toolbox</span></div>` +
    `</div></td></tr>`
).join('')}
</table>
</body></html>`

await writeFile(path.join(dir, 'look.html'), page)

const MAIN = `
const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 780, height: 480, show: false, backgroundColor: '#0c0d0e' })
  await win.loadFile(path.join(__dirname, 'look.html'))
  await new Promise(r => setTimeout(r, 300))
  const image = await win.webContents.capturePage()
  fs.writeFileSync(${JSON.stringify(shot)}, image.toPNG())
  console.log('SHOT ok')
  app.quit()
})
`
await writeFile(path.join(dir, 'main.cjs'), MAIN)

await new Promise((accept, reject) => {
  const child = spawn(electron, [path.join(dir, 'main.cjs')], { stdio: ['ignore', 'pipe', 'pipe'] })
  let out = ''
  child.stdout.on('data', chunk => (out += chunk))
  child.stderr.on('data', () => {})
  child.on('exit', () =>
    out.includes('SHOT ok') ? accept() : reject(new Error(out || 'nothing came back'))
  )
  child.on('error', reject)
})

await rm(dir, { recursive: true, force: true })
console.log(shot)
