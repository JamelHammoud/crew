import { spawn } from 'node:child_process'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import electron from 'electron'
import { build } from 'esbuild'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const shot = path.join(root, 'at-look.png')

const ROW = ['AtGlyph', 'ClockGlyph', 'CompassGlyph', 'ToolboxGlyph']
const LADDER = ['AtGlyph', 'PlugGlyph', 'GlobeGlyph', 'ChatGlyph']

const ENTRY = `
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import * as set from ${JSON.stringify(path.join(root, 'src/renderer/src/icons/index.ts'))}
const at = (name, px) =>
  renderToStaticMarkup(createElement(set[name], { className: 'w-[' + px + 'px] h-[' + px + 'px]' }))
    .replace(/class="[^"]*"/, 'style="width:' + px + 'px;height:' + px + 'px;display:block"')
export function draw() {
  return {
    row: ${JSON.stringify(ROW)}.map(name => ({ name, svg: at(name, 16) })),
    ladder: ${JSON.stringify(LADDER)}.map(name => ({
      name,
      sizes: [48, 24, 20, 16].map(px => at(name, px))
    }))
  }
}
`

const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-at-look-')))
const entry = path.join(dir, 'entry.jsx')
await writeFile(entry, ENTRY)
const bundle = path.join(dir, 'bundle.cjs')
await build({
  entryPoints: [entry],
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
const { row, ladder } = createRequire(import.meta.url)(bundle).draw()

const LABELS = {
  AtGlyph: 'Plugins',
  ClockGlyph: 'Scheduled',
  CompassGlyph: 'Browser',
  ToolboxGlyph: 'Toolbox'
}

const page = `<!doctype html><html><body style="margin:0;background:#0b0b0d;color:#f5f5f7;font:13px -apple-system,system-ui,sans-serif;padding:32px;display:flex;gap:56px;align-items:flex-start">
<div style="width:176px;padding:6px;border-radius:14px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.08)">
${row
  .map(
    one =>
      `<div style="display:flex;align-items:center;gap:10px;height:32px;padding:0 10px;border-radius:9px;color:rgba(245,245,247,0.7)"><span style="display:flex">${one.svg}</span><span>${LABELS[one.name]}</span></div>`
  )
  .join('')}
</div>
<table style="border-collapse:collapse">
<tr><th></th>${[48, 24, 20, 16].map(s => `<th style="padding:10px 24px;font-weight:400;color:#8a8a92">${s}</th>`).join('')}</tr>
${ladder
  .map(
    one =>
      `<tr><td style="padding:16px 24px 16px 0;color:#8a8a92">${one.name.replace('Glyph', '')}</td>` +
      one.sizes
        .map(
          svg =>
            `<td style="padding:16px 24px"><span style="display:flex;justify-content:center">${svg}</span></td>`
        )
        .join('') +
      '</tr>'
  )
  .join('')}
</table>
</body></html>`

await writeFile(path.join(dir, 'look.html'), page)

const MAIN = `
const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 780, height: 440, show: false, backgroundColor: '#0b0b0d' })
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
  child.on('exit', () => (out.includes('SHOT ok') ? accept() : reject(new Error(out || 'nothing came back'))))
  child.on('error', reject)
})

await rm(dir, { recursive: true, force: true })
console.log(shot)
