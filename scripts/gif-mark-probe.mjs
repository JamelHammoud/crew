import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const out = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'gif-mark.png')

const entry = (where) => `
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import * as icons from '${where}/src/renderer/src/icons/index.ts'
window.CrewMarks = (name, size) =>
  renderToStaticMarkup(createElement(icons[name], { className: 'w-[' + size + 'px]' }))
    .replace('<svg', '<svg width="' + size + '" height="' + size + '"')
`

const PAGE = `<!doctype html><html><body style="margin:0;background:#161616;font:14px -apple-system,system-ui,sans-serif;color:#ededed">
<script src="marks.js"></script>
<div id="page" style="padding:28px"></div>
<script>
const draw = window.CrewMarks
const row = (label, mark) =>
  '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:12px;color:rgba(237,237,237,0.7)">' +
  '<span style="display:flex;width:16px;height:16px">' + mark + '</span><span>' + label + '</span></div>'

document.getElementById('page').innerHTML =
  '<div style="display:flex;gap:40px;align-items:flex-start">' +
    '<div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:6px;width:190px">' +
      row('Upload a file', draw('UploadGlyph', 16)) + row('Pick a GIF', draw('GifGlyph', 16)) +
    '</div>' +
    ['GifGlyph', 'FilmGlyph', 'PhotoGlyph', 'WindowGlyph', 'UploadGlyph'].map(name =>
      '<div style="display:flex;flex-direction:column;align-items:center;gap:14px">' +
      [16, 20, 24, 48].map(size => '<span style="display:flex">' + draw(name, size) + '</span>').join('') +
      '<span style="font-size:11px;color:#888">' + name.replace('Glyph','') + '</span></div>').join('') +
  '</div>'
</script></body></html>`

const MAIN = `import { app, BrowserWindow } from 'electron'
import { writeFileSync } from 'node:fs'
import path from 'node:path'

app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 700, height: 260, webPreferences: { nodeIntegration: true, contextIsolation: false } })
  await window.loadFile(path.join(import.meta.dirname, 'marks.html'))
  const shot = await window.webContents.capturePage()
  writeFileSync(process.env.MARK_OUT, shot.toPNG())
  console.log('MARKS ok')
  app.exit(0)
}).catch(error => {
  console.log('MARKS_FAILED ' + String(error && error.stack || error))
  app.exit(1)
})
`

const dir = await mkdtemp(path.join(tmpdir(), 'crew-marks-'))
try {
  await writeFile(path.join(dir, 'entry.ts'), entry(root))
  await build({
    entryPoints: [path.join(dir, 'entry.ts')],
    bundle: true,
    format: 'iife',
    outfile: path.join(dir, 'marks.js'),
    logLevel: 'error'
  })
  await writeFile(path.join(dir, 'marks.html'), PAGE)
  await writeFile(path.join(dir, 'main.mjs'), MAIN)

  await new Promise((resolve, reject) => {
    const child = spawn(electron, [path.join(dir, 'main.mjs')], {
      env: { ...process.env, MARK_OUT: out, ELECTRON_ENABLE_LOGGING: '0' },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let text = ''
    child.stdout.on('data', chunk => (text += chunk))
    child.stderr.on('data', chunk => (text += chunk))
    child.on('exit', () => {
      const failed = text.split('\n').find(line => line.startsWith('MARKS_FAILED '))
      if (failed) return reject(new Error(failed.slice(13)))
      if (!text.includes('MARKS ok')) return reject(new Error(text))
      resolve()
    })
  })
  console.log(`drawn to ${path.relative(root, out)}`)
} finally {
  await rm(dir, { recursive: true, force: true })
}
