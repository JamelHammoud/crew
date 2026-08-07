import { spawn } from 'node:child_process'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const resolve = createRequire(path.join(root, 'package.json')).resolve

const WIDTH = 1440
const HEIGHT = 980

const TEXT = [
  '# Reading a room',
  '',
  'The gate opens on whatever stands well above the floor for long enough.',
  '',
  '```typescript',
  'export function openOn(level: number, floor: number, held: number, room: number) {',
  '  const over = level - floor',
  '  if (over < MIN_RISE) return false',
  '  return held > MIN_HOLD',
  '}',
  '```',
  '',
  'A line after it, so the room underneath can be read.',
  '',
  '```bash',
  'yarn test tests/voice-listening.test.ts',
  '```',
  '',
  '```text',
  'no language on this one at all',
  '```',
  ''
].join('\n')

const DOCS = { reading: { title: 'Reading a room', text: TEXT } }

function probeSource() {
  const from = file => JSON.stringify(path.join(root, 'src/renderer/src', file))
  return `import React from ${JSON.stringify(resolve('react'))}
import { createRoot } from ${JSON.stringify(resolve('react-dom/client'))}
import Docs from ${from('views/Docs.tsx')}
import { useDocs } from ${from('state/docs.ts')}
import { useCrew } from ${from('state/store.ts')}
import './probe.css'

useCrew.setState({
  docs: ${JSON.stringify(DOCS)},
  selfId: 'self',
  selfName: 'Jamel',
  connection: 'online',
  members: [{ id: 'self', name: 'Jamel', connected: true }]
})

function Page() {
  React.useEffect(() => {
    useDocs.getState().open('reading')
  }, [])
  return React.createElement(
    'div',
    { className: 'h-full relative isolate bg-ink-900' },
    React.createElement('main', { className: 'absolute inset-0' }, React.createElement(Docs))
  )
}

createRoot(document.getElementById('root')).render(React.createElement(Page))
`
}

const shots = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-code-shots-')))

const MAIN = `const { app, BrowserWindow } = require('electron')
const { writeFile } = require('node:fs/promises')
const path = require('node:path')
app.disableHardwareAcceleration()

const wait = ms => new Promise(r => setTimeout(r, ms))
const OUT = ${JSON.stringify(path.join(shots, 'code'))}
const THEMES = ['dark', 'light']
const WHERE = ['at rest', 'hovered', 'copy hovered']

const AIM = where => \`(() => {
  const block = document.querySelector('.bn-block-content[data-content-type="codeBlock"]')
  if (!block) return null
  const where = \` + JSON.stringify(where) + \`
  const middle = el => {
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
  }
  if (where === 'at rest') return { x: 40, y: 900 }
  if (where === 'copy hovered') {
    const copy = block.querySelector('.doc-code-copy')
    return copy ? middle(copy) : null
  }
  const box = block.getBoundingClientRect()
  return { x: Math.round(box.left + 40), y: Math.round(box.bottom - 12) }
})()\`

const READ = \`(() => {
  const round = n => Math.round(n * 100) / 100
  const box = el => {
    const r = el.getBoundingClientRect()
    return { x: round(r.left), y: round(r.top), w: round(r.width), h: round(r.height) }
  }
  const blocks = [...document.querySelectorAll('.bn-block-content[data-content-type="codeBlock"]')]
  const block = blocks[0]
  if (!block) return { failed: 'no code block on the page' }
  const row = block.querySelector(':scope > div')
  const select = block.querySelector('select')
  const copy = block.querySelector('.doc-code-copy')
  const pre = block.querySelector('pre')
  const read = el => {
    if (!el) return null
    const style = getComputedStyle(el)
    return {
      box: box(el),
      pad: style.padding,
      paint: style.backgroundColor,
      ink: style.color,
      font: style.fontFamily.split(',')[0] + ' ' + style.fontSize + '/' + style.lineHeight,
      weight: style.fontWeight,
      radius: style.borderTopLeftRadius,
      border: style.borderTopWidth + ' ' + style.borderTopColor,
      shows: style.opacity,
      appearance: style.appearance + ' / ' + style.webkitAppearance,
      scrollW: round(el.scrollWidth),
      clientW: round(el.clientWidth),
      clipped: el.scrollWidth > el.clientWidth + 1,
      text: (el.value !== undefined ? String(el.value) : (el.textContent || '')).slice(0, 40)
    }
  }
  return {
    block: { box: box(block), paint: getComputedStyle(block).backgroundColor, radius: getComputedStyle(block).borderTopLeftRadius },
    pre: { box: box(pre), pad: getComputedStyle(pre).padding, font: getComputedStyle(pre).fontSize + '/' + getComputedStyle(pre).lineHeight },
    row: row ? { box: box(row), shows: getComputedStyle(row).opacity, gap: getComputedStyle(row).gap, at: getComputedStyle(row).top + ' / ' + getComputedStyle(row).right } : null,
    select: read(select),
    copy: read(copy),
    options: select ? select.options.length : 0,
    picked: select ? select.options[select.selectedIndex]?.text : null,
    others: blocks.slice(1).map(b => {
      const s = b.querySelector('select')
      return { lang: s ? s.value : null, shown: s ? s.options[s.selectedIndex]?.text : null, w: s ? round(s.getBoundingClientRect().width) : null }
    })
  }
})()\`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: ${WIDTH}, height: ${HEIGHT}, show: true, backgroundColor: '#141414' })
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(1800)
    const out = {}
    for (const theme of THEMES) {
      await win.webContents.executeJavaScript(
        'document.documentElement.classList.toggle("light", ' + JSON.stringify(theme === 'light') + '), true'
      )
      await wait(400)
      for (const where of WHERE) {
        const at = await win.webContents.executeJavaScript(AIM(where))
        if (at) {
          win.webContents.sendInputEvent({ type: 'mouseMove', x: at.x, y: at.y })
          await wait(60)
          win.webContents.sendInputEvent({ type: 'mouseMove', x: at.x + 1, y: at.y })
        }
        await wait(900)
        out[theme + ' / ' + where] = await win.webContents.executeJavaScript(READ)
        const shot = await win.webContents.capturePage()
        await writeFile(OUT + '-' + theme + '-' + where.replace(/ /g, '-') + '.png', shot.toPNG())
      }
    }
    console.log('SEEN ' + JSON.stringify(out))
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
    `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\nhtml, body, #root { width: 100%; height: 100%; margin: 0; }\n#root { position: relative; }\n`
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
      accept(JSON.parse(line.slice(5)))
    })
    child.on('error', reject)
  })
}

const say = (what, read) => {
  if (!read) return console.log(`  ${what}: not there`)
  console.log(
    `  ${what}: ${read.box.w}x${read.box.h} at ${read.box.x},${read.box.y}, pad ${read.pad}, radius ${read.radius}`
  )
  console.log(
    `        ${read.font} weight ${read.weight}, ink ${read.ink}, paint ${read.paint}, shows ${read.shows}`
  )
  console.log(
    `        appearance ${read.appearance}, holds "${read.text}", scrolls ${read.scrollW} in ${read.clientW}${read.clipped ? '  <-- CLIPPED' : ''}`
  )
}

const dir = await stage()
try {
  await compile(dir)
  const seen = await run(dir)
  if (seen.failed) throw new Error(seen.failed)
  for (const [where, read] of Object.entries(seen)) {
    if (read.failed) throw new Error(read.failed)
    console.log(`\n${where}`)
    console.log(`  block ${read.block.box.w}x${read.block.box.h}, paint ${read.block.paint}, radius ${read.block.radius}`)
    console.log(`  pre ${read.pre.box.w}x${read.pre.box.h}, pad ${read.pre.pad}, ${read.pre.font}`)
    if (read.row)
      console.log(
        `  row ${read.row.box.w}x${read.row.box.h} at ${read.row.box.x},${read.row.box.y}, shows ${read.row.shows}, gap ${read.row.gap}, placed ${read.row.at}`
      )
    say('select', read.select)
    say('copy', read.copy)
    console.log(`  ${read.options} languages, picked "${read.picked}"`)
    for (const other of read.others) console.log(`  another: ${other.lang} reads "${other.shown}" at ${other.w} across`)
  }
  console.log(`\nwrote the shots to ${shots}`)
} finally {
  await rm(dir, { recursive: true, force: true })
}
