import { spawn } from 'node:child_process'
import { mkdtemp, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const shot = path.join(tmpdir(), 'crew-agent-look.png')

const PROBE = `
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import ProviderMark from ${JSON.stringify(path.join(root, 'src/renderer/src/components/ProviderMark'))}
import TextField from ${JSON.stringify(path.join(root, 'src/renderer/src/components/TextField'))}
import Select from ${JSON.stringify(path.join(root, 'src/renderer/src/components/Select'))}
import SettingRows, { SettingSections } from ${JSON.stringify(
  path.join(root, 'src/renderer/src/components/agent/SettingRows')
)}
import OpenRow from ${JSON.stringify(path.join(root, 'src/renderer/src/components/agent/OpenRow'))}
import { Row } from ${JSON.stringify(path.join(root, 'src/renderer/src/components/settings/parts'))}

const PLAIN = [
  { key: 'model', label: 'Model', options: [{ value: 'opus', label: 'Opus' }], default: 'opus' },
  { key: 'opusModel', label: 'Version', options: [{ value: 'claude-opus-5', label: 'Opus 5' }], default: 'claude-opus-5' },
  { key: 'effort', label: 'Thinking', options: [{ value: 'high', label: 'high' }], default: 'high' }
]

const DEEP = [
  { key: 'instructions', label: 'Instructions', kind: 'paragraph', default: '', placeholder: 'None', line: 'Read before every message.' },
  { key: 'fallbackModel', label: 'If the model is busy', options: [{ value: '', label: 'None' }], default: '', section: 'Model' },
  { key: 'dirs', label: 'Other folders it can read', kind: 'text', default: '', section: 'On this computer', placeholder: 'None', line: 'Separated by commas.' },
  { key: 'crewOnly', label: 'Same on every machine', kind: 'switch', default: '', section: 'On this computer', line: 'Leaves out whatever each person set up in Claude for themselves.' },
  { key: 'commandSeconds', label: 'Longest a command may run', kind: 'number', default: '', section: 'On this computer', min: 1, max: 3600, unit: 'seconds' }
]

function Card({ children }) {
  return (
    <div className="glass glass-strong w-[460px] rounded-card overflow-hidden">{children}</div>
  )
}

function App() {
  const [settings, setSettings] = useState({ model: 'opus', opusModel: 'claude-opus-5', effort: 'high', commandSeconds: '240', crewOnly: 'on' })
  const set = (key, value) => setSettings(s => ({ ...s, [key]: value }))
  return (
    <div className="flex items-start gap-8 p-10">
      <Card>
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3.5">
            <ProviderMark provider="claude" className="w-12 h-12 rounded-2xl" />
            <TextField glass value="Claude Opus 5" onChange={() => {}} className="h-10 text-base" />
          </div>
          <div>
            <Row label="Provider">
              <Select value="claude" options={[{ value: 'claude', label: 'Claude', mark: <ProviderMark provider="claude" /> }]} onChange={() => {}} />
            </Row>
            <SettingRows fields={PLAIN} settings={settings} onChange={set} />
            <OpenRow label="Advanced" hint="2 changed" onOpen={() => {}} />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button className="h-10 px-4 rounded-full text-sm font-semibold text-fg/45">Cancel</button>
            <button className="h-10 px-5 rounded-full bg-fg text-ink-900 text-sm font-semibold">Create</button>
          </div>
        </div>
      </Card>
      <Card>
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 -ml-1.5 rounded-full flex items-center justify-center text-fg/45">‹</span>
            <h3 className="text-base font-semibold text-fg">Claude</h3>
            <button className="ml-auto text-sm font-semibold text-fg/45">Put back</button>
          </div>
          <div className="-mt-2">
            <SettingSections fields={DEEP} settings={settings} onChange={set} />
          </div>
          <div className="flex items-center justify-end">
            <button className="h-10 px-5 rounded-full bg-fg text-ink-900 text-sm font-semibold">Done</button>
          </div>
        </div>
      </Card>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
`

const MAIN = `
const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1120, height: 900, show: false, backgroundColor: '#0b0b0d' })
  win.webContents.on('console-message', (_e, _l, message) => console.log('LOG ' + message))
  win.webContents.on('render-process-gone', () => console.log('LOG gone'))
  await win.loadFile(path.join(__dirname, 'dist', 'index.html'))
  await new Promise(r => setTimeout(r, 700))
  const image = await win.webContents.capturePage()
  fs.writeFileSync(${JSON.stringify(shot)}, image.toPNG())
  console.log('SHOT ok')
  app.quit()
})
`

const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-agent-look-')))
await writeFile(
  path.join(dir, 'index.html'),
  '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/probe.css"><script type="module" src="/probe.jsx"></script></head><body class="mac"><div id="root"></div></body></html>'
)
await writeFile(path.join(dir, 'probe.jsx'), PROBE)
await writeFile(
  path.join(dir, 'probe.css'),
  `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\nhtml, body { margin: 0; background: #0b0b0d; }\n`
)
await writeFile(path.join(dir, 'main.cjs'), MAIN)

const { build } = await import('vite')
const tailwind = (await import('@tailwindcss/vite')).default
await build({
  root: dir,
  base: './',
  logLevel: 'silent',
  plugins: [tailwind()],
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { react: path.join(root, 'node_modules/react'), 'react-dom': path.join(root, 'node_modules/react-dom') } },
  build: { outDir: path.join(dir, 'dist'), emptyOutDir: true }
})

await new Promise((accept, reject) => {
  const child = spawn(electron, [path.join(dir, 'main.cjs')], { stdio: ['ignore', 'pipe', 'pipe'] })
  let out = ''
  child.stdout.on('data', chunk => (out += chunk))
  child.stderr.on('data', () => {})
  child.on('exit', () => {
    process.stdout.write(out.split('\n').filter(l => l.startsWith('LOG ')).join('\n'))
    return out.includes('SHOT ok') ? accept() : reject(new Error(out || 'nothing came back'))
  })
  child.on('error', reject)
})

console.log(shot)
