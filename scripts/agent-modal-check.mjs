import { spawn } from 'node:child_process'
import { mkdtemp, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const shot = path.join(tmpdir(), 'crew-agent-modal-check.png')

const fields = [
  {
    key: 'model',
    label: 'Model',
    options: [
      { value: '', label: 'Default' },
      { value: 'grok-4.6', label: 'Grok 4.6' },
      { value: 'grok-4.5', label: 'Grok 4.5' }
    ],
    default: ''
  },
  {
    key: 'effort',
    label: 'Thinking',
    options: [
      { value: '', label: 'Default' },
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
      { value: 'xhigh', label: 'Extra high' }
    ],
    default: ''
  },
  {
    key: 'instructions',
    label: 'Instructions',
    kind: 'paragraph',
    default: '',
    advanced: true,
    placeholder: 'None',
    line: 'Read before every message.'
  },
  {
    key: 'mode',
    label: 'What it may do',
    options: [
      { value: 'anything', label: 'Anything' },
      { value: 'safe', label: 'Safe changes' },
      { value: 'plan', label: 'Read only' }
    ],
    default: 'anything',
    advanced: true,
    section: 'On this computer'
  },
  {
    key: 'sandbox',
    label: 'Sandbox',
    options: [
      { value: '', label: 'Default' },
      { value: 'off', label: 'Off' },
      { value: 'workspace', label: 'Project only' },
      { value: 'read-only', label: 'Read only' },
      { value: 'strict', label: 'Strict' }
    ],
    default: '',
    advanced: true,
    section: 'On this computer'
  },
  ...['Web access', 'Planning', 'Subagents'].map((label, index) => ({
    key: ['web', 'planning', 'subagents'][index],
    label,
    kind: 'switch',
    default: 'on',
    advanced: true,
    section: 'Tools'
  })),
  {
    key: 'memory',
    label: 'Grok memory',
    options: [
      { value: '', label: 'Default' },
      { value: 'on', label: 'On' },
      { value: 'off', label: 'Off' }
    ],
    default: '',
    advanced: true,
    section: 'Tools'
  },
  ...[
    ['tools', 'Only these tools', 'All'],
    ['disallowedTools', 'Tools it cannot use', 'None']
  ].map(([key, label, placeholder]) => ({
    key,
    label,
    kind: 'text',
    default: '',
    advanced: true,
    section: 'Tools',
    placeholder,
    line: 'Separated by commas.'
  })),
  {
    key: 'maxTurns',
    label: 'Most turns per message',
    kind: 'number',
    default: '',
    advanced: true,
    section: 'Limits',
    min: 1,
    unit: 'turns'
  }
]

const probe = `
import { createRoot } from 'react-dom/client'
import CreateAgent from ${JSON.stringify(path.join(root, 'src/renderer/src/components/CreateAgent'))}

const fields = ${JSON.stringify(fields)}
window.crew = {
  agentCapabilities: async () => [{
    provider: 'grok',
    label: 'Grok',
    fields,
    installed: true,
    installable: true
  }],
  modelServers: async () => []
}

createRoot(document.getElementById('root')).render(
  <CreateAgent />
)
`

const main = `
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 955, height: 657, frame: false, show: false, backgroundColor: '#0b0b0d' })
  await win.loadFile(path.join(__dirname, 'dist', 'index.html'))
  win.webContents.setZoomFactor(0.8)
  await new Promise(resolve => setTimeout(resolve, 300))
  const result = await win.webContents.executeJavaScript(\`(async () => {
    const buttons = () => [...document.querySelectorAll('button')]
    const named = text => buttons().find(button => button.textContent.trim() === text)
    const until = async (label, read) => {
      for (let attempt = 0; attempt < 100; attempt++) {
        const value = read()
        if (value) return value
        await new Promise(resolve => setTimeout(resolve, 20))
      }
      throw new Error(label + ' did not appear; buttons: ' + buttons().map(button => button.textContent.trim()).join(', '))
    }
    const add = await until('Add an agent', () => named('Add an agent')?.disabled === false && named('Add an agent'))
    add.click()
    ;(await until('Provider', () => named('Provider'))).click()
    ;(await until('Grok', () => named('Grok'))).click()
    ;(await until('Advanced', () => named('Advanced'))).click()
    await until('Advanced dialog', () => document.querySelector('[role="dialog"][aria-label="Advanced"]'))
    await new Promise(resolve => setTimeout(resolve, 300))
    const dialog = document.querySelector('[role="dialog"]')
    const page = dialog.querySelector(':scope > [data-modal-body]')
    const before = page.getBoundingClientRect()
    const dialogBox = dialog.getBoundingClientRect()
    const scrolls = page.scrollHeight > page.clientHeight
    const backButton = buttons().find(button => button.getAttribute('aria-label') === 'Back')
    const doneButton = buttons().find(button => button.textContent.trim() === 'Done')
    const controlsFixed = !page.contains(backButton) && !page.contains(doneButton)
    const fadesBottom = page.hasAttribute('data-fade-bottom')
    page.scrollTop = page.scrollHeight
    page.dispatchEvent(new Event('scroll'))
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const fadesTop = page.hasAttribute('data-fade-top')
    const done = doneButton.getBoundingClientRect()
    return {
      viewport: innerHeight,
      dialogTop: dialogBox.top,
      dialogBottom: dialogBox.bottom,
      pageHeight: before.height,
      scrollHeight: page.scrollHeight,
      scrolls,
      controlsFixed,
      fadesBottom,
      fadesTop,
      doneTop: done.top,
      doneBottom: done.bottom
    }
  })()\`)
  const image = await win.webContents.capturePage()
  fs.writeFileSync(${JSON.stringify(shot)}, image.toPNG())
  const fits = result.dialogTop >= 23 && result.viewport - result.dialogBottom >= 23
  const doneFits = result.doneTop >= result.dialogTop && result.doneBottom <= result.dialogBottom
  console.log('CHECK ' + JSON.stringify({ ...result, fits, doneFits }))
  app.exit(fits && result.scrolls && result.controlsFixed && result.fadesBottom && result.fadesTop && doneFits ? 0 : 1)
}).catch(error => {
  console.error(error)
  app.exit(1)
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
