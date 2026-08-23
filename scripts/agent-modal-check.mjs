import { spawn } from 'node:child_process'
import { mkdtemp, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const shot = path.join(tmpdir(), 'crew-agent-modal-check.png')

const fields = Array.from({ length: 18 }, (_, index) => ({
  key: `setting${index}`,
  label: `Setting ${index + 1}`,
  kind: index % 3 === 0 ? 'switch' : index % 3 === 1 ? 'number' : 'text',
  default: '',
  advanced: true,
  section: index < 6 ? 'Tools' : index < 12 ? 'Limits' : 'On this computer'
}))

const probe = `
import { createRoot } from 'react-dom/client'
import AgentSettingsModal from ${JSON.stringify(path.join(root, 'src/renderer/src/components/agent/AgentSettingsModal'))}

const fields = ${JSON.stringify(fields)}

createRoot(document.getElementById('root')).render(
  <AgentSettingsModal
    open
    label="Grok"
    fields={fields}
    settings={{}}
    onChange={() => {}}
    onClose={() => {}}
  />
)
`

const main = `
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 900, height: 640, frame: false, show: false, backgroundColor: '#0b0b0d' })
  await win.loadFile(path.join(__dirname, 'dist', 'index.html'))
  await new Promise(resolve => setTimeout(resolve, 500))
  const result = await win.webContents.executeJavaScript(\`(async () => {
    const dialog = document.querySelector('[role="dialog"]')
    const page = dialog.querySelector('.overflow-y-auto')
    const before = page.getBoundingClientRect()
    const dialogBox = dialog.getBoundingClientRect()
    const scrolls = page.scrollHeight > page.clientHeight
    page.scrollTop = page.scrollHeight
    await new Promise(resolve => requestAnimationFrame(resolve))
    const done = [...page.querySelectorAll('button')].find(button => button.textContent.trim() === 'Done').getBoundingClientRect()
    return {
      viewport: innerHeight,
      dialogTop: dialogBox.top,
      dialogBottom: dialogBox.bottom,
      pageHeight: before.height,
      scrollHeight: page.scrollHeight,
      scrolls,
      doneTop: done.top,
      doneBottom: done.bottom
    }
  })()\`)
  const image = await win.webContents.capturePage()
  fs.writeFileSync(${JSON.stringify(shot)}, image.toPNG())
  const fits = result.dialogTop === 24 && result.dialogBottom === result.viewport - 24
  const doneFits = result.doneTop >= result.dialogTop && result.doneBottom <= result.dialogBottom
  console.log('CHECK ' + JSON.stringify({ ...result, fits, doneFits }))
  app.exit(fits && result.scrolls && doneFits ? 0 : 1)
})
`

const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-agent-modal-check-')))
await writeFile(
  path.join(dir, 'index.html'),
  '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/probe.css"><script type="module" src="/probe.jsx"></script></head><body><div id="root"></div></body></html>'
)
await writeFile(path.join(dir, 'probe.jsx'), probe)
await writeFile(
  path.join(dir, 'probe.css'),
  `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\nhtml, body { margin: 0; background: #0b0b0d; }\n`
)
await writeFile(path.join(dir, 'main.cjs'), main)

const { build } = await import('vite')
const tailwind = (await import('@tailwindcss/vite')).default
await build({
  root: dir,
  base: './',
  logLevel: 'silent',
  plugins: [tailwind()],
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: { react: path.join(root, 'node_modules/react'), 'react-dom': path.join(root, 'node_modules/react-dom') }
  },
  build: { outDir: path.join(dir, 'dist'), emptyOutDir: true }
})

await new Promise((accept, reject) => {
  const child = spawn(electron, [path.join(dir, 'main.cjs')], { stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout.on('data', chunk => (output += chunk))
  child.stderr.on('data', chunk => (output += chunk))
  child.on('exit', code => {
    process.stdout.write(output)
    return code === 0 ? accept() : reject(new Error(output || 'The modal check failed'))
  })
  child.on('error', reject)
})

console.log(shot)
