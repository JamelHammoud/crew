import { spawn } from 'node:child_process'
import { mkdtemp, readdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const out = process.argv[2] ?? path.join(root, 'pill.png')

const ROOM = 32

const bars = Array.from({ length: 17 }, (_, i) => {
  const h = [30, 55, 80, 45, 95, 70, 100, 60, 85, 40, 75, 90, 50, 65, 35, 55, 25][i]
  return `<span class="w-[3px] rounded-full bg-current" style="height:${h}%"></span>`
}).join('')

// A transparent window has no page behind it, so a backdrop filter samples
// nothing. Turning it off here is the only way to see what the pill really looks
// like over somebody else's application.
const pill = state => `
<div class="pointer-events-none" style="padding:${ROOM}px">
  <div class="pointer-events-auto relative glass glass-pill rounded-full min-h-[52px] px-2 py-2 flex items-center gap-2" style="backdrop-filter:none;${state.bg ? `background:${state.bg}` : ''}">
    <span class="pointer-events-none absolute inset-0 rounded-[inherit] border border-fg/10"></span>
    <button class="w-8 h-8 shrink-0 rounded-full flex items-center justify-center bg-fg/10 text-fg/70">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${state.weight}" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="m6.5 6.5 11 11M17.5 6.5 6.5 17.5"/></svg>
    </button>
    <span class="flex-1 min-w-0 h-6 px-1 text-fg/70 justify-between flex items-center gap-[3px]">${bars}</span>
    <button class="w-8 h-8 shrink-0 rounded-full flex items-center justify-center bg-fg text-ink-900">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${state.weight}" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="m5 12.5 4.5 4.5L19 7"/></svg>
    </button>
  </div>
</div>`

const SCENES = [
  ['a white page', '#ffffff', '#111'],
  ['a warm page', '#f5f2e4', '#333'],
  ['a photo', 'linear-gradient(120deg,#2b6cb0,#c05621 45%,#276749)', '#fff'],
  ['a dark editor', '#101014', '#8b8b96']
]

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><script type="module" src="./probe.js"></script></head>
<body class="font-sans">
  <div id="root" class="bare">
    ${SCENES.map(
      ([say, back, ink]) => `
    <div style="background:${back};color:${ink}" class="p-6">
      <div class="text-sm opacity-70 mb-1">${say}</div>
      <div class="text-sm opacity-45 leading-6">The quick brown fox jumps over the lazy dog, and the words underneath keep running so there is something for the pill to sit on top of and hide.</div>
      <div class="flex items-center gap-4">
        <div style="margin-left:-${ROOM}px">${pill({ weight: 2 })}</div>
        <div class="text-xs opacity-40">weight 2</div>
        ${pill({ weight: 2.5 })}
        <div class="text-xs opacity-40">weight 2.5</div>
      </div>
    </div>`
    ).join('\n')}
  </div>
</body></html>`

const MAIN = `const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
app.disableHardwareAcceleration()
const wait = ms => new Promise(r => setTimeout(r, ms))
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 820, height: 1000, show: false, webPreferences: { deviceScaleFactor: 2 } })
  await win.loadFile(path.join(__dirname, 'dist/index.html'))
  await wait(700)
  const shot = await win.webContents.capturePage()
  fs.writeFileSync(process.env.SHOT, shot.toPNG())
  console.log('SHOT ok')
  app.quit()
})`

const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-pill-')))
await writeFile(path.join(dir, 'index.html'), PAGE)
await writeFile(
  path.join(dir, 'probe.css'),
  `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\n`
)
await writeFile(path.join(dir, 'probe.js'), `import './probe.css'\n`)
await writeFile(path.join(dir, 'main.cjs'), MAIN)

const { build } = await import('vite')
const tailwind = (await import('@tailwindcss/vite')).default
await build({
  root: dir,
  base: './',
  logLevel: 'silent',
  plugins: [tailwind()],
  build: { outDir: path.join(dir, 'dist'), emptyOutDir: true }
})

const assets = path.join(dir, 'dist/assets')
const sheet = (await readdir(assets)).find(name => name.endsWith('.css'))
const css = await readFile(path.join(assets, sheet), 'utf8')
if (!css.includes('glass-pill')) throw new Error('the stylesheet came out with no glass-pill in it')

await new Promise((resolve, reject) => {
  const child = spawn(electron, [path.join(dir, 'main.cjs')], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, SHOT: out }
  })
  child.on('exit', code => (code === 0 ? resolve() : reject(new Error('the window said nothing back'))))
  child.on('error', reject)
})
console.log(out)
