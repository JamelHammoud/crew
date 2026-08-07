import { spawn } from 'node:child_process'
import { mkdtemp, realpath, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const resolve = createRequire(path.join(root, 'package.json')).resolve

const TEXT = [
  'A paragraph of ordinary writing above the block.',
  '',
  '```typescript',
  'export function greet(name: string) {',
  '  return `Hello, ${name}`',
  '}',
  '```',
  '',
  'And a line under it.'
].join('\n')

function probeSource() {
  const from = file => JSON.stringify(path.join(root, 'src/renderer/src', file))
  return `import React from ${JSON.stringify(resolve('react'))}
import { createRoot } from ${JSON.stringify(resolve('react-dom/client'))}
import DocEditor from ${from('components/DocEditor.tsx')}
import './probe.css'

function Look() {
  return React.createElement(
    'div',
    { className: 'h-full bg-ink-900 pt-16 flex justify-center' },
    React.createElement(
      'div',
      { className: 'w-[680px]' },
      React.createElement(DocEditor, { text: ${JSON.stringify(TEXT)}, onChange: () => {} })
    )
  )
}

createRoot(document.getElementById('root')).render(React.createElement(Look))
`
}

const shots = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-code-shots-')))

const MAIN = `const { app, BrowserWindow } = require('electron')
const { writeFile } = require('node:fs/promises')
const path = require('node:path')
app.disableHardwareAcceleration()
const wait = ms => new Promise(r => setTimeout(r, ms))
const OUT = ${JSON.stringify(path.join(shots, 'code'))}

const READ = \`(() => {
  const box = el => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) }
  }
  const block = document.querySelector('[data-content-type="codeBlock"]')
  const row = block && block.querySelector('div')
  const copy = block && block.querySelector('.doc-code-copy')
  const pick = block && block.querySelector('select')
  const paint = el => el ? getComputedStyle(el) : null
  return {
    block: box(block),
    row: box(row),
    copy: box(copy),
    pick: box(pick),
    copyText: copy && copy.textContent,
    rowOpacity: paint(row) && paint(row).opacity,
    copyBg: paint(copy) && paint(copy).backgroundColor,
    pickBg: paint(pick) && paint(pick).backgroundColor,
    copyFont: paint(copy) && paint(copy).fontSize,
    pickFont: paint(pick) && paint(pick).fontSize,
    root: document.documentElement.className,
    blockBg: paint(block) && paint(block).backgroundColor,
    inkSaid: getComputedStyle(document.documentElement).getPropertyValue('--color-ink-850'),
    preBg: block && block.querySelector('pre') ? getComputedStyle(block.querySelector('pre')).backgroundColor : null,
    preStyle: block && block.querySelector('pre') ? block.querySelector('pre').getAttribute('style') : null,
    pickText: pick && pick.value,
    pickColor: paint(pick) && paint(pick).color,
    inkAtBlock: getComputedStyle(block).getPropertyValue('--color-ink-850'),
    fgAtBlock: getComputedStyle(block).getPropertyValue('--color-fg-secondary'),
    chain: (() => {
      const seen = []
      let at = block
      while (at) {
        seen.push(at.tagName + '.' + (at.className || '').toString())
        at = at.parentElement
      }
      return seen
    })()
  }
})()\`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1000, height: 620, show: true, backgroundColor: '#141414' })
  const seen = {}
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(0)
  } catch (e) {}
  try {
    await wait(1600)
    seen.rest = await win.webContents.executeJavaScript(READ)
    await writeFile(OUT + '-rest.png', (await win.webContents.capturePage()).toPNG())
    const at = seen.rest.block
    const x = Math.round(at.left + at.width / 2)
    const y = Math.round(at.top + at.height / 2)
    win.webContents.sendInputEvent({ type: 'mouseMove', x, y })
    await wait(900)
    seen.hover = await win.webContents.executeJavaScript(READ)
    await writeFile(OUT + '-hover.png', (await win.webContents.capturePage()).toPNG())
    const copy = seen.hover.copy
    win.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(copy.left + copy.width / 2), y: Math.round(copy.top + copy.height / 2) })
    await wait(400)
    await writeFile(OUT + '-on-copy.png', (await win.webContents.capturePage()).toPNG())
    await win.webContents.executeJavaScript('document.querySelector(".doc-code-copy").click()')
    await wait(300)
    seen.said = await win.webContents.executeJavaScript(READ)
    await writeFile(OUT + '-copied.png', (await win.webContents.capturePage()).toPNG())
    console.log('SEEN ' + JSON.stringify(seen))
  } catch (e) {
    console.log('SEEN ' + JSON.stringify({ failed: String(e && e.stack) }))
  }
  app.exit(0)
})`

async function stage() {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-code-look-')))
  await writeFile(
    path.join(dir, 'index.html'),
    '<!doctype html><html><head><meta charset="utf-8"><script type="module" src="/probe.tsx"></script></head><body class="mac"><div id="root"></div></body></html>'
  )
  await writeFile(path.join(dir, 'probe.tsx'), probeSource())
  await writeFile(
    path.join(dir, 'probe.css'),
    `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\nhtml, body, #root { width: 100%; height: 100%; margin: 0; }\n`
  )
  await writeFile(path.join(dir, 'main.cjs'), MAIN)
  return dir
}

async function compile(dir) {
  const { build } = await import('vite')
  const tailwind = (await import('@tailwindcss/vite')).default
  await build({
    root: dir,
    base: './',
    logLevel: 'silent',
    plugins: [tailwind()],
    build: { outDir: path.join(dir, 'dist'), emptyOutDir: true }
  })
}

function run(dir) {
  return new Promise(accept => {
    const child = spawn(electron, [path.join(dir, 'main.cjs')], { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', chunk => (out += chunk))
    child.stderr.on('data', () => {})
    child.on('exit', () => {
      const line = out.split('\n').find(one => one.startsWith('SEEN '))
      accept(line ? JSON.parse(line.slice(5)) : { failed: out })
    })
  })
}

const dir = await stage()
await compile(dir)
const seen = await run(dir)
console.log(JSON.stringify(seen, null, 2))
console.log('shots in ' + shots)
