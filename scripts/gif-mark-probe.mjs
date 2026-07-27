import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const out = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'gif-mark.png')

const NAMES = ['GifGlyph', 'FilmGlyph', 'PhotoGlyph', 'WindowGlyph', 'UploadGlyph']

const ENTRY = `
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import * as icons from '${root}/src/renderer/src/icons/index.ts'
export function draw(name, size) {
  return renderToStaticMarkup(createElement(icons[name], { className: 'w-[' + size + 'px]' }))
    .replace('<svg', '<svg width="' + size + '" height="' + size + '"')
}
`

const page = draw => {
  const row = (label, name) =>
    `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:12px;color:rgba(237,237,237,0.7)">
      <span style="display:flex;width:16px;height:16px">${draw(name, 16)}</span><span>${label}</span></div>`
  const stack = name =>
    `<div style="display:flex;flex-direction:column;align-items:center;gap:14px">
      ${[16, 20, 24, 48].map(size => `<span style="display:flex">${draw(name, size)}</span>`).join('')}
      <span style="font-size:11px;color:#888">${name.replace('Glyph', '')}</span></div>`
  return `<!doctype html><html><body style="margin:0;background:#161616;font:14px -apple-system,system-ui,sans-serif;color:#ededed">
    <div style="padding:28px;display:flex;gap:40px;align-items:flex-start">
      <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:6px;width:190px">
        ${row('Upload a file', 'UploadGlyph')}${row('Pick a GIF', 'GifGlyph')}
      </div>
      ${NAMES.map(stack).join('')}
    </div></body></html>`
}

const MAIN = `import { app, BrowserWindow } from 'electron'
import { writeFileSync } from 'node:fs'
import path from 'node:path'

app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 760, height: 250, webPreferences: { nodeIntegration: true, contextIsolation: false } })
  await window.loadFile(path.join(import.meta.dirname, 'marks.html'))
  writeFileSync(process.env.MARK_OUT, (await window.webContents.capturePage()).toPNG())
  console.log('MARKS ok')
  app.exit(0)
}).catch(error => {
  console.log('MARKS_FAILED ' + String(error && error.stack || error))
  app.exit(1)
})
`

const dir = await mkdtemp(path.join(root, 'node_modules', '.crew-marks-'))
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
  await writeFile(path.join(dir, 'marks.html'), page(draw))
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
  console.log(`drawn to ${out}`)
} finally {
  await rm(dir, { recursive: true, force: true })
}
