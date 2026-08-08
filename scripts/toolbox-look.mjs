import { spawn } from 'node:child_process'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const shot = path.join(root, 'toolbox-look.png')

const ROW = [
  ['ClockGlyph', 'Scheduled'],
  ['AtGlyph', 'Plugins'],
  ['CompassGlyph', 'Browser'],
  ['ToolboxGlyph', 'Toolbox']
]

const ENTRY = `
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import * as set from ${JSON.stringify(path.join(root, 'src/renderer/src/icons/index.ts'))}
import { TOOLBOX_CASE, TOOLBOX_SHUT } from ${JSON.stringify(path.join(root, 'src/renderer/src/icons/toolbox.ts'))}
import { STROKE, wearWeight } from ${JSON.stringify(path.join(root, 'src/renderer/src/icons/keylines.ts'))}

const at = (name, px) =>
  renderToStaticMarkup(createElement(set[name], { className: 'w-[' + px + 'px] h-[' + px + 'px]' }))
    .replace(/class="[^"]*"/, 'style="width:' + px + 'px;height:' + px + 'px"')

const was = px =>
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' +
  wearWeight(STROKE, 'w-[' + px + 'px]') +
  '" stroke-linecap="round" stroke-linejoin="round" style="width:' + px + 'px;height:' + px + 'px">' +
  '<path d="' + TOOLBOX_CASE + '"></path><path d="' + TOOLBOX_SHUT.lid + '"></path><path d="' +
  TOOLBOX_SHUT.handle + '"></path></svg>'

export function draw() {
  return {
    row: ${JSON.stringify(ROW)}.map(([name, label]) => ({ label, svg: at(name, 16) })),
    ladder: ${JSON.stringify(ROW)}.map(([name, label]) => ({
      label,
      sizes: [48, 24, 20, 16].map(px => at(name, px))
    })),
    versus: [48, 24, 16].map(px => ({ px, was: was(px), now: at('ToolboxGlyph', px) }))
  }
}
`

const dir = await realpath(await mkdtemp(path.join(root, 'node_modules', '.crew-toolbox-look-')))
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
const { createRequire } = await import('node:module')
const { row, ladder, versus } = createRequire(import.meta.url)(bundle).draw()

const page = `<!doctype html><html><body style="margin:0;background:#0c0d0e;color:#f5f5f5;font:13px -apple-system,system-ui,sans-serif;padding:28px;display:flex;gap:44px;align-items:flex-start">

<div>
<div style="color:#8b8d91;margin-bottom:10px">the menu</div>
<div style="width:176px;padding:6px;border-radius:14px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.09)">
${row
  .map(
    one =>
      `<div style="display:flex;align-items:center;gap:10px;height:30px;padding:0 9px;border-radius:9px;color:rgba(245,245,245,0.7)"><span style="display:flex">${one.svg}</span><span>${one.label}</span></div>`
  )
  .join('')}
</div>
</div>

<div>
<div style="color:#8b8d91;margin-bottom:10px">worn</div>
<table style="border-collapse:collapse">
<tr><th></th>${[48, 24, 20, 16].map(s => `<th style="padding:6px 20px;font-weight:400;color:#5a5c60">${s}</th>`).join('')}</tr>
${ladder
  .map(
    one =>
      `<tr><td style="padding:12px 18px 12px 0;color:#8b8d91">${one.label}</td>` +
      one.sizes
        .map(
          svg => `<td style="padding:12px 20px"><span style="display:flex;justify-content:center">${svg}</span></td>`
        )
        .join('') +
      '</tr>'
  )
  .join('')}
</table>
</div>

<div>
<div style="color:#8b8d91;margin-bottom:10px">was / now</div>
<table style="border-collapse:collapse">
${versus
  .map(
    one =>
      `<tr><td style="padding:12px 16px 12px 0;color:#5a5c60">${one.px}</td>` +
      `<td style="padding:12px 20px"><span style="display:flex;justify-content:center">${one.was}</span></td>` +
      `<td style="padding:12px 20px"><span style="display:flex;justify-content:center">${one.now}</span></td></tr>`
  )
  .join('')}
</table>
</div>

</body></html>`

await writeFile(path.join(dir, 'look.html'), page)

const MAIN = `
const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 900, height: 400, show: false, backgroundColor: '#0c0d0e' })
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
