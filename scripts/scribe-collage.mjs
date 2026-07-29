import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import electron from 'electron'
import { measure } from './icon-geometry.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const out = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'scribe-icons.png')

const NOTES = {
  AWaveRule: 'a spoken line settling into a written one',
  BWaveAngle: 'the same, cut in strokes rather than curves',
  CWaveStop: 'and it comes to rest on a full stop',
  DWaveCaret: 'and it lands where the cursor is',
  ELevelRule: 'a voice standing on the line it is written to',
  FLevels: 'a voice on its own',
  GTranscript: 'said across the top, written underneath',
  HField: 'a voice inside the box you are typing in',
  INib: 'what is there now'
}
const LABEL = name => name.slice(1)

const ENTRY = `
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import * as set from ${JSON.stringify(path.join(root, 'scripts/scribe-candidates.tsx'))}
export function draw() {
  return Object.entries(set)
    .filter(([name]) => name.endsWith('Glyph'))
    .map(([name, Icon]) => ({
      name: name.replace(/Glyph$/, ''),
      art: renderToStaticMarkup(createElement(Icon, { className: 'w-12 h-12' })),
      big: renderToStaticMarkup(createElement(Icon, { className: 'w-[64px] h-[64px]' })),
      mid: renderToStaticMarkup(createElement(Icon, { className: 'w-6 h-6' })),
      tile: renderToStaticMarkup(createElement(Icon, { className: 'w-5 h-5' })),
      small: renderToStaticMarkup(createElement(Icon, { className: 'w-4 h-4' }))
    }))
}
`

const dir = await mkdtemp(path.join(root, 'node_modules', '.crew-scribe-'))
const entry = path.join(dir, 'entry.jsx')
await writeFile(entry, ENTRY)
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
const drawn = draw()

for (const one of drawn) {
  const box = measure(one.art, 2)
  const off = Math.hypot(box.cx - 12, box.cy - 12)
  one.numbers = `${box.width.toFixed(1)} × ${box.height.toFixed(1)}  ·  off centre ${off.toFixed(2)}`
}

const card = one => `
  <div class="card">
    <div class="head">${LABEL(one.name)}<em>${NOTES[one.name] ?? ''}</em></div>
    <div class="hero">${one.big}</div>
    <div class="sizes">
      <span class="s">${one.art}</span>
      <span class="s">${one.mid}</span>
      <span class="s">${one.small}</span>
    </div>
    <div class="worn">
      <div class="tile">${one.tile}<b>Scribe</b></div>
      <div class="rail"><span class="row on">${one.small}Scribe</span><span class="row">${one.small}Scribe</span></div>
    </div>
    <div class="numbers">${one.numbers}</div>
  </div>`

const page = `<!doctype html><meta charset="utf8"><style>
  * { box-sizing: border-box }
  body { margin: 0; padding: 26px; background: #141414; color: #ffffff;
         font: 13px -apple-system, system-ui, sans-serif }
  h1 { font-size: 13px; font-weight: 600; margin: 0 0 4px }
  h1 + p { margin: 0 0 22px; color: #707070; font-size: 12px }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px }
  .card { background: #222222; border-radius: 20px; padding: 16px 16px 13px;
          display: flex; flex-direction: column; gap: 13px }
  .head { font-size: 12px; font-weight: 600; display: flex; flex-direction: column; gap: 3px }
  .head em { font-style: normal; font-weight: 400; color: #707070; font-size: 11px; line-height: 1.35 }
  .hero { display: flex; justify-content: center; padding: 10px 0 4px }
  .sizes { display: flex; align-items: center; justify-content: center; gap: 22px;
           padding: 12px 0; background: #141414; border-radius: 14px }
  .s { display: inline-flex }
  .worn { display: flex; gap: 10px; align-items: stretch }
  .tile { width: 84px; background: #141414; border-radius: 14px; display: flex;
          flex-direction: column; align-items: center; justify-content: center; gap: 7px; padding: 12px 0 }
  .tile b { font-size: 10px; font-weight: 500; color: #b3b3b3 }
  .rail { flex: 1; background: #141414; border-radius: 14px; padding: 8px;
          display: flex; flex-direction: column; gap: 2px; justify-content: center }
  .row { display: flex; align-items: center; gap: 9px; padding: 6px 9px; border-radius: 999px;
         font-size: 12px; color: #707070 }
  .row.on { background: rgba(255,255,255,0.1); color: #ffffff }
  .numbers { color: #4a4a4a; font-size: 10px; text-align: center }
  svg { display: block }
  .w-\\[64px\\] { width: 64px; height: 64px }
  .w-12 { width: 48px; height: 48px }
  .w-6 { width: 24px; height: 24px }
  .w-5 { width: 20px; height: 20px }
  .w-4 { width: 16px; height: 16px }
</style>
<h1>Scribe</h1>
<p>Nine marks, at 64, 48, 24 and 16, on a tile and in the settings rail.</p>
<div class="grid">${drawn.map(card).join('')}</div>`

await writeFile(path.join(dir, 'index.html'), page)

const main = `
const { app, BrowserWindow, ipcMain } = require('electron')
const fs = require('fs')
app.commandLine.appendSwitch('force-device-scale-factor', '2')
app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1000, height: 1420, show: false, backgroundColor: '#141414',
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  })
  win.webContents.on('did-finish-load', () => setTimeout(async () => {
    const image = await win.webContents.capturePage()
    fs.writeFileSync(${JSON.stringify(out)}, image.toPNG())
    app.exit(0)
  }, 500))
  win.loadFile(${JSON.stringify(path.join(dir, 'index.html'))})
  setTimeout(() => app.exit(1), 20000)
})
`
await writeFile(path.join(dir, 'main.cjs'), main)

const child = spawn(electron, [path.join(dir, 'main.cjs')], { stdio: 'inherit' })
child.on('exit', async code => {
  await rm(dir, { recursive: true, force: true })
  console.log(code === 0 ? 'wrote ' + out : 'failed')
  process.exit(code ?? 1)
})
