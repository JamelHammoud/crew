import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const out = path.join(root, 'scribe-beside.png')

const NAMES = [
  ['ScribeGlyph', 'Scribe'],
  ['MicGlyph', 'Voice'],
  ['PeopleGlyph', 'Huddle'],
  ['TerminalGlyph', 'Terminal'],
  ['FolderGlyph', 'Files'],
  ['MusicGlyph', 'Music'],
  ['GameGlyph', 'Games'],
  ['GlobeGlyph', 'Page']
]

const ENTRY = `
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import * as set from ${JSON.stringify(path.join(root, 'src/renderer/src/icons/index.ts'))}
export function draw(names) {
  return names.map(([key, label]) => ({
    label,
    tile: renderToStaticMarkup(createElement(set[key], { className: 'w-5 h-5' })),
    row: renderToStaticMarkup(createElement(set[key], { className: 'w-4 h-4' }))
  }))
}
`

const dir = await mkdtemp(path.join(root, 'node_modules', '.crew-beside-'))
await writeFile(path.join(dir, 'entry.jsx'), ENTRY)
const bundle = path.join(dir, 'bundle.mjs')
await build({
  entryPoints: [path.join(dir, 'entry.jsx')],
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
const drawn = draw(NAMES)

const page = `<!doctype html><meta charset="utf8"><style>
  * { box-sizing: border-box }
  body { margin: 0; padding: 24px; background: #141414; color: #fff;
         font: 13px -apple-system, system-ui, sans-serif; display: flex; gap: 24px; align-items: flex-start }
  .panel { background: #222; border-radius: 20px; padding: 12px }
  .tiles { display: grid; grid-template-columns: repeat(3, 84px); gap: 8px }
  .tile { background: rgba(255,255,255,0.06); border-radius: 14px; height: 76px; display: flex;
          flex-direction: column; align-items: center; justify-content: center; gap: 8px }
  .tile b { font-size: 11px; font-weight: 500; color: #b3b3b3 }
  .rail { background: #222; border-radius: 20px; padding: 10px; width: 190px;
          display: flex; flex-direction: column; gap: 2px }
  .row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 999px;
         font-size: 13px; color: #b3b3b3 }
  .row.on { background: rgba(255,255,255,0.1); color: #fff }
  svg { display: block }
  .w-5 { width: 20px; height: 20px }
  .w-4 { width: 16px; height: 16px }
</style>
<div class="panel"><div class="tiles">${drawn
  .map(one => `<div class="tile">${one.tile}<b>${one.label}</b></div>`)
  .join('')}</div></div>
<div class="rail">${drawn
  .map((one, i) => `<div class="row${i ? '' : ' on'}">${one.row}${one.label}</div>`)
  .join('')}</div>`

await writeFile(path.join(dir, 'index.html'), page)
await writeFile(
  path.join(dir, 'main.cjs'),
  `
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
app.commandLine.appendSwitch('force-device-scale-factor', '3')
app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 560, height: 340, show: false, backgroundColor: '#141414',
    webPreferences: { nodeIntegration: true, contextIsolation: false } })
  win.webContents.on('did-finish-load', () => setTimeout(async () => {
    fs.writeFileSync(${JSON.stringify(out)}, (await win.webContents.capturePage()).toPNG())
    app.exit(0)
  }, 400))
  win.loadFile(${JSON.stringify(path.join(dir, 'index.html'))})
  setTimeout(() => app.exit(1), 20000)
})
`
)

const child = spawn(electron, [path.join(dir, 'main.cjs')], { stdio: 'inherit' })
child.on('exit', async code => {
  await rm(dir, { recursive: true, force: true })
  console.log(code === 0 ? 'wrote ' + out : 'failed')
  process.exit(code ?? 1)
})
