import { spawn } from 'node:child_process'
import { mkdtemp, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const destination = process.argv[2] ? path.resolve(process.argv[2]) : path.join(tmpdir(), 'crew-avatar-look.png')
const transition = destination.replace(/\.png$/, '-transition.png')

const probe = `
import { createRoot } from 'react-dom/client'
import AgentIcon from ${JSON.stringify(path.join(root, 'src/renderer/src/components/AgentIcon'))}

const activities = ['idle', 'thinking', 'reading', 'searching', 'editing', 'designing', 'running', 'planning', 'communicating', 'acting']
const seeds = ['jamel/claude', 'ali/codex', 'jamel/kimi']

function App() {
  return (
    <main>
      <h1>Agent forms</h1>
      <div className="grid">
        {activities.map((activity, index) => (
          <section key={activity} data-cell={activity}>
            <AgentIcon seed={seeds[index % seeds.length]} px={64} activity={activity} />
            <div className="small">
              <AgentIcon seed={seeds[index % seeds.length]} size="sm" activity={activity} />
              <AgentIcon seed={seeds[index % seeds.length]} size="xs" activity={activity} />
            </div>
            <span>{activity}</span>
          </section>
        ))}
      </div>
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
  const win = new BrowserWindow({ width: 1180, height: 580, show: false, backgroundColor: '#0b0b0d' })
  await win.loadFile(path.join(__dirname, 'dist', 'index.html'))
  await new Promise(resolve => setTimeout(resolve, 190))
  fs.writeFileSync(${JSON.stringify(transition)}, (await win.webContents.capturePage()).toPNG())
  await new Promise(resolve => setTimeout(resolve, 850))
  fs.writeFileSync(${JSON.stringify(destination)}, (await win.webContents.capturePage()).toPNG())
  const evidence = await win.webContents.executeJavaScript(
    "Array.from(document.querySelectorAll('[data-cell]')).map(cell => ({ activity: cell.dataset.cell, object: !!cell.querySelector('.agent-activity-object'), eyes: cell.querySelectorAll('.agent-pet-eyes rect').length, masks: cell.querySelectorAll('mask').length, transform: getComputedStyle(cell.querySelector('.agent-activity-object') || cell.querySelector('.agent-pet-body')).transform }))"
  )
  console.log(JSON.stringify(evidence))
  app.quit()
})
`

const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-avatar-look-')))
await writeFile(
  path.join(directory, 'index.html'),
  '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/probe.css"><script type="module" src="/probe.jsx"></script></head><body><div id="root"></div></body></html>'
)
await writeFile(path.join(directory, 'probe.jsx'), probe)
await writeFile(
  path.join(directory, 'probe.css'),
  `@import "${path.join(root, 'src/renderer/src/styles.css')}";
@source "${path.join(root, 'src/renderer/src')}";
html, body { margin: 0; background: #0b0b0d; color: #f5f5f5; font-family: -apple-system, system-ui, sans-serif; }
main { padding: 34px; }
h1 { margin: 0 0 26px; font-size: 18px; }
.grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 24px 18px; }
section { height: 188px; border-radius: 20px; background: #17171a; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; }
.small { display: flex; align-items: center; gap: 9px; height: 28px; }
section > span { color: rgba(255,255,255,.58); font-size: 12px; }
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
console.log(transition)
