import { spawn } from 'node:child_process'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import electron from 'electron'

const root = '/Users/jamel/Documents/Repositories/crew'
const ROWS = ['Add a "Clone Git repo" as an option', 'How could we make a mobile version', 'Add support for MCP + custom tools', 'Test 2', 'crew-website']

const rail = () => `<div style="width:257px;padding:8px" class="sidebar-glass">
  <div style="padding:0 8px 6px;font-size:11px" class="text-fg/45">Projects</div>
  ${ROWS.map(r => `<div style="padding:6px 8px;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" class="text-fg/70">${r}</div>`).join('')}
</div>`

const menu = at => `<div class="glass fixed rounded-2xl p-1.5 min-w-44" style="left:${at}px;top:96px;--glass-bg:rgb(28 28 28 / var(--a))">
  ${['Open a folder', 'Clone Git repo', 'Join with a link'].map(l => `<div class="text-fg/70" style="padding:8px 12px;font-size:13px;white-space:nowrap">${l}</div>`).join('')}
</div>`

const PAGE = `<!doctype html><html class="mac"><head><meta charset="utf-8"><script type="module" src="./probe.js"></script></head>
<body class="bg-ink-900 text-fg font-sans">
 <div id="root" style="display:flex;gap:0">
   <div style="width:360px;position:relative">${rail()}</div>
   <div style="width:360px;position:relative">${rail()}</div>
 </div>
 <div style="--a:0.78">${menu(60)}</div>
 <div style="--a:0.92">${menu(420)}</div>
 <div class="fixed text-fg/45" style="left:60px;top:60px;font-size:12px">before &nbsp;0.78</div>
 <div class="fixed text-fg/45" style="left:420px;top:60px;font-size:12px">after &nbsp;0.92</div>
</body></html>`

const MAIN = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 740, height: 300, show: false, backgroundColor: '#141414' })
  await win.loadFile(path.join(__dirname, 'dist/index.html'))
  await new Promise(r => setTimeout(r, 900))
  fs.writeFileSync('/tmp/glass-look.png', (await win.webContents.capturePage()).toPNG())
  console.log('SEEN ok'); app.exit(0)
})`

const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-look-')))
await writeFile(path.join(dir, 'index.html'), PAGE)
await writeFile(path.join(dir, 'probe.css'), `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\n`)
await writeFile(path.join(dir, 'probe.js'), `import './probe.css'\n`)
await writeFile(path.join(dir, 'main.cjs'), MAIN)
const { build } = await import('vite')
const tailwind = (await import('@tailwindcss/vite')).default
await build({ root: dir, base: './', logLevel: 'silent', plugins: [tailwind()], build: { outDir: path.join(dir, 'dist'), emptyOutDir: true } })
await new Promise((res, rej) => {
  const c = spawn(electron, [path.join(dir, 'main.cjs')], { stdio: ['ignore', 'pipe', 'pipe'] })
  let out = ''; c.stdout.on('data', d => (out += d)); c.stderr.on('data', () => {})
  c.on('exit', () => (out.includes('SEEN ok') ? res() : rej(new Error('nothing back')))); c.on('error', rej)
})
await rm(dir, { recursive: true, force: true })
console.log('wrote /tmp/glass-look.png')
