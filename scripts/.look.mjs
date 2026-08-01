import { spawn } from 'node:child_process'
import { mkdtemp, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import electron from 'electron'

const root = '/Users/jamel/Documents/Repositories/crew'
const OUT = '/tmp/feedback-card.png'
const OUT2 = '/tmp/feedback-card-stuck.png'

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><script type="module" src="./probe.jsx"></script></head>
<body class="bg-ink-900 text-fg font-sans"><div id="root" class="w-full"></div></body></html>`

const ENTRY = `import './probe.css'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import About from ${JSON.stringify(path.join(root, 'src/renderer/src/components/settings/About.tsx'))}

window.opens = false
window.crew = {
  appVersion: () => Promise.resolve('0.1.0'),
  systemInfo: () => Promise.resolve({ version: '0.1.0', platform: 'darwin', release: '25.5.0', arch: 'arm64' }),
  openExternal: () => Promise.resolve(window.opens)
}
createRoot(document.getElementById('root')).render(
  createElement('div', { className: 'mx-auto max-w-2xl' }, createElement(About))
)`

const MAIN = `const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
app.disableHardwareAcceleration()
const wait = ms => new Promise(r => setTimeout(r, ms))

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 900, height: 760, show: true, backgroundColor: '#0b0b0d' })
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(700)
    await win.webContents.executeJavaScript(
      "[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Submit feedback').click()"
    )
    await wait(500)
    await win.webContents.executeJavaScript(\`(() => {
      const box = document.querySelector('textarea')
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
      set.call(box, 'The music panel came up as empty tiles after I switched projects. It came back when I reopened the panel.')
      box.dispatchEvent(new Event('input', { bubbles: true }))
    })()\`)
    await wait(300)
    fs.writeFileSync(${JSON.stringify(OUT)}, (await win.webContents.capturePage()).toPNG())

    await win.webContents.executeJavaScript(
      "[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Send').click()"
    )
    await wait(500)
    fs.writeFileSync(${JSON.stringify(OUT2)}, (await win.webContents.capturePage()).toPNG())
    console.log('SEEN ok')
  } catch (e) {
    console.log('SEEN ' + String(e && e.message))
  }
  app.exit(0)
})`

const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'report-look-')))
await writeFile(path.join(dir, 'index.html'), PAGE)
await writeFile(
  path.join(dir, 'probe.css'),
  `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\n`
)
await writeFile(path.join(dir, 'probe.jsx'), ENTRY)
await writeFile(path.join(dir, 'main.cjs'), MAIN)

const { build } = await import(path.join(root, 'node_modules/vite/dist/node/index.js'))
const tailwind = (await import(path.join(root, 'node_modules/@tailwindcss/vite/dist/index.mjs'))).default
await build({
  root: dir,
  base: './',
  logLevel: 'silent',
  plugins: [tailwind()],
  resolve: { alias: { react: path.join(root, 'node_modules/react'), 'react-dom': path.join(root, 'node_modules/react-dom') } },
  build: { outDir: path.join(dir, 'dist'), emptyOutDir: true }
})
console.log('built', (await readdir(path.join(dir, 'dist/assets'))).join(' '))

await new Promise((resolve, reject) => {
  const child = spawn(electron, [path.join(dir, 'main.cjs')], { stdio: ['ignore', 'pipe', 'pipe'] })
  let out = ''
  child.stdout.on('data', c => (out += c))
  child.stderr.on('data', c => (out += c))
  child.on('exit', () => {
    console.log(out.split('\n').filter(l => l.startsWith('SEEN')).join('\n') || out.slice(-800))
    resolve()
  })
  child.on('error', reject)
})
await rm(dir, { recursive: true, force: true })
