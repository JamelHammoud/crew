import { spawn } from 'node:child_process'
import { mkdtemp, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const destination = process.argv[2] ? path.resolve(process.argv[2]) : path.join(tmpdir(), 'crew-provider-look.png')

const probe = `
import { createRoot } from 'react-dom/client'
import ProviderMark from ${JSON.stringify(path.join(root, 'src/renderer/src/components/ProviderMark'))}

const ROW = ['claude', 'codex', 'gemini', 'kimi', 'grok', 'local', 'server:http://llm.example.com/v1']
const NAMES = ['Bubbles', 'Codex', 'Gemma', 'Kimi', 'Grok', 'Ollama Qwen3', 'Deepseek v4']

function Agents() {
  return (
    <div className="list">
      {ROW.map((provider, i) => (
        <div key={provider} className="row" data-row={provider}>
          <span className="face" />
          <span className="who">
            <span className="name">{NAMES[i]}<ProviderMark provider={provider} /></span>
            <span className="owner">Jamel</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function App() {
  return (
    <main>
      <section className="panel">
        <h2>The agents list, worn at 16</h2>
        <Agents />
      </section>
      <section className="panel light-theme light">
        <h2>Light</h2>
        <Agents />
      </section>
      <section className="panel">
        <h2>Worn at 48, the way the maker wears it</h2>
        <div className="big">
          {ROW.map(provider => (
            <ProviderMark key={provider} provider={provider} className="w-12 h-12 rounded-2xl" />
          ))}
        </div>
        <div className="big" style={{ marginTop: '18px' }}>
          {ROW.map(provider => (
            <ProviderMark key={provider} provider={provider} className="w-6 h-6" />
          ))}
        </div>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
`

const main = `
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1080, height: 760, show: false, backgroundColor: '#0b0b0d' })
  await win.loadFile(path.join(__dirname, 'dist', 'index.html'))
  await new Promise(resolve => setTimeout(resolve, 400))
  fs.writeFileSync(${JSON.stringify(destination)}, (await win.webContents.capturePage()).toPNG())
  const evidence = await win.webContents.executeJavaScript(
    "Array.from(document.querySelectorAll('[data-row]')).map(row => { const mark = row.querySelector('svg, img'); const box = mark.getBoundingClientRect(); return { provider: row.dataset.row, drew: mark.tagName.toLowerCase(), width: Math.round(box.width), height: Math.round(box.height), stroke: mark.getAttribute('stroke-width'), color: getComputedStyle(mark).color } })"
  )
  console.log(JSON.stringify(evidence, null, 1))
  app.quit()
})
`

const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-provider-look-')))
await writeFile(
  path.join(directory, 'index.html'),
  '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/probe.css"><script type="module" src="/probe.jsx"></script></head><body><div id="root"></div></body></html>'
)
await writeFile(path.join(directory, 'probe.jsx'), probe)
await writeFile(
  path.join(directory, 'probe.css'),
  `@import "${path.join(root, 'src/renderer/src/styles.css')}";
@source "${path.join(root, 'src/renderer/src')}";
html, body { margin: 0; background: #0b0b0d; font-family: -apple-system, system-ui, sans-serif; }
main { padding: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.panel { border-radius: 20px; padding: 18px 20px 22px; background: #17171a; color: #f5f5f5; }
.panel.light { background: #f2f2f4; color: #111; }
h2 { margin: 0 0 14px; font-size: 12px; opacity: .5; font-weight: 500; }
.list { display: flex; flex-direction: column; }
.row { display: flex; align-items: center; gap: 12px; padding: 8px 0; }
.face { width: 34px; height: 34px; border-radius: 999px; background: rgba(255,255,255,.12); flex: none; }
.who { display: flex; flex-direction: column; }
.name { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; }
.owner { font-size: 13px; opacity: .45; }
.big { display: flex; align-items: center; gap: 16px; }
`
)
await writeFile(path.join(directory, 'main.cjs'), main)

const { build } = await import('vite')
const tailwind = (await import('@tailwindcss/vite')).default
await build({
  root: directory,
  base: './',
  logLevel: 'silent',
  plugins: [tailwind()],
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: { react: path.join(root, 'node_modules/react'), 'react-dom': path.join(root, 'node_modules/react-dom') }
  },
  build: { outDir: path.join(directory, 'dist'), emptyOutDir: true }
})

await new Promise((accept, reject) => {
  const child = spawn(electron, [path.join(directory, 'main.cjs')], { stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout.on('data', chunk => (output += chunk))
  child.stderr.on('data', () => {})
  child.on('exit', code => {
    if (code !== 0 || !output.trim()) return reject(new Error(output || `Electron exited ${code}`))
    process.stdout.write(output)
    accept()
  })
  child.on('error', reject)
})

console.log(destination)
