import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, realpath } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import electron from 'electron'

const root = '/Users/jamel/Documents/Repositories/crew'
const resolve = createRequire(path.join(root, 'package.json')).resolve

const WIDTH = 700
const HEIGHT = 420

const SIZES = [
  ['8', 'w-2 h-2', ''],
  ['10 with 4', 'w-2.5 h-2.5', 'w-1 h-1'],
  ['12 with 4', 'w-3 h-3', 'w-1 h-1'],
  ['14 with 6', 'w-3.5 h-3.5', 'w-1.5 h-1.5']
]

function probeSource() {
  const from = file => JSON.stringify(path.join(root, 'src/renderer/src', file))
  return `import React from ${JSON.stringify(resolve('react'))}
import { createRoot } from ${JSON.stringify(resolve('react-dom/client'))}
import { PanelRightGlyph } from ${from('icons/index.ts')}
import './probe.css'

const SIZES = ${JSON.stringify(SIZES)}

function Button({ outer, inner }) {
  return React.createElement(
    'button',
    {
      className:
        'relative w-10 h-10 rounded-full flex items-center justify-center text-fg-muted'
    },
    React.createElement(PanelRightGlyph, { className: 'w-[18px] h-[18px]' }),
    React.createElement(
      'span',
      {
        className:
          'absolute top-0.5 right-0.5 rounded-full bg-fg ring-2 ring-ink-900 flex items-center justify-center ' + outer
      },
      inner ? React.createElement('span', { className: 'rounded-full bg-ink-900 ' + inner }) : null
    )
  )
}

createRoot(document.getElementById('root')).render(
  React.createElement(
    'div',
    { className: 'h-full bg-ink-900 flex flex-col justify-center gap-8 px-8' },
    React.createElement(
      'div',
      { className: 'flex items-center gap-10' },
      ...SIZES.map(([say, outer, inner]) =>
        React.createElement(
          'div',
          { key: say, className: 'flex flex-col items-center gap-2' },
          React.createElement(Button, { outer, inner }),
          React.createElement('span', { className: 'text-fg-muted text-xs' }, say)
        )
      )
    ),
    React.createElement(
      'div',
      { className: 'flex items-center gap-10', style: { zoom: 4 } },
      ...SIZES.map(([say, outer, inner]) =>
        React.createElement(Button, { key: say, outer, inner })
      )
    )
  )
)
`
}

const shots = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-toggle-shots-')))

const MAIN = `const { app, BrowserWindow } = require('electron')
const { writeFile } = require('node:fs/promises')
const path = require('node:path')
app.disableHardwareAcceleration()
const wait = ms => new Promise(r => setTimeout(r, ms))
const OUT = ${JSON.stringify(path.join(shots, 'toggle.png'))}
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: ${WIDTH}, height: ${HEIGHT}, show: true, backgroundColor: '#141414' })
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(900)
    const shot = await win.webContents.capturePage()
    await writeFile(OUT, shot.toPNG())
    console.log('SEEN ' + OUT)
  } catch (e) {
    console.log('SEEN failed ' + String(e && e.stack))
  }
  app.exit(0)
})`

async function stage() {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-toggle-')))
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
  return new Promise((accept, reject) => {
    const child = spawn(electron, [path.join(dir, 'main.cjs')], { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', chunk => (out += chunk))
    child.stderr.on('data', () => {})
    child.on('exit', () => {
      const line = out.split('\n').find(row => row.startsWith('SEEN '))
      if (!line) return reject(new Error('the window said nothing back'))
      accept(line.slice(5))
    })
    child.on('error', reject)
  })
}

const dir = await stage()
await compile(dir)
console.log(await run(dir))
