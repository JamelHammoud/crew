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
const HEIGHT = 900

const LIST = [
  '- One, the first level',
  '  - Two, a level in',
  '    - Three, two levels in',
  '      - Four, where it starts over',
  '        - Five',
  '          - Six',
  ''
].join('\n')

const DOCS = { ideas: { title: 'Ideas', text: LIST } }

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
    useDocs.getState().open('ideas')
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

const shots = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-bullet-shots-')))

const MAIN = `const { app, BrowserWindow } = require('electron')
const { writeFile } = require('node:fs/promises')
const path = require('node:path')
app.disableHardwareAcceleration()

const wait = ms => new Promise(r => setTimeout(r, ms))
const OUT = ${JSON.stringify(path.join(shots, 'bullets'))}

const READ = \`(() => {
  const depthOf = el => {
    let at = el.parentElement
    let deep = 0
    while (at) {
      if (at.classList.contains('bn-block-group')) deep += 1
      if (at.classList.contains('bn-editor')) break
      at = at.parentElement
    }
    return deep
  }
  const rows = [...document.querySelectorAll('.bn-block-content[data-content-type="bulletListItem"]')]
  if (!rows.length) return { failed: 'no bullets on the page' }
  return rows.map(row => {
    const mark = getComputedStyle(row, '::before')
    const own = getComputedStyle(row)
    const line = parseFloat(own.lineHeight)
    const pad = parseFloat(own.paddingTop)
    const size = parseFloat(mark.width)
    const up = parseFloat(mark.marginTop)
    const left = parseFloat(mark.marginLeft)
    return {
      depth: depthOf(row),
      says: (row.textContent || '').trim().slice(0, 24),
      content: mark.content,
      size: Math.round(size * 100) / 100,
      tall: Math.round(parseFloat(mark.height) * 100) / 100,
      stroke: Math.round(parseFloat(mark.borderTopWidth) * 100) / 100,
      radius: mark.borderTopLeftRadius,
      paint: mark.backgroundColor,
      ink: mark.color,
      middle: Math.round((left + size / 2) * 100) / 100,
      gutter: Math.round((left + size + parseFloat(mark.marginRight)) * 100) / 100,
      offLine: Math.round((pad + up + size / 2 - (pad + line / 2)) * 100) / 100,
      rule: (() => {
        const outer = row.closest('.bn-block-outer')
        const edge = outer ? getComputedStyle(outer, '::before') : null
        return edge ? edge.borderLeftWidth + ' ' + edge.borderLeftStyle : 'none'
      })()
    }
  })
})()\`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: ${WIDTH}, height: ${HEIGHT}, show: true, backgroundColor: '#141414' })
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(1600)
    const seen = await win.webContents.executeJavaScript(READ)
    const shot = await win.webContents.capturePage()
    await writeFile(OUT + '.png', shot.toPNG())
    console.log('SEEN ' + JSON.stringify(seen))
  } catch (e) {
    console.log('SEEN ' + JSON.stringify({ failed: String(e && e.stack) }))
  }
  app.exit(0)
})`

async function stage() {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-bullet-look-')))
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

const dir = await stage()
try {
  await compile(dir)
  const seen = await run(dir)
  if (seen.failed) throw new Error(seen.failed)
  const shape = read =>
    read.stroke > 0 ? 'ring' : read.radius === '50%' ? 'disc' : `square (${read.radius})`
  seen.forEach(read => {
    console.log(`\nlevel ${read.depth}  ${read.says}`)
    console.log(`  ${shape(read)}, ${read.size} across, stroke ${read.stroke}`)
    console.log(`  paint ${read.paint}, glyph ${read.content} in ${read.ink}`)
    console.log(`  centre ${read.middle} in, gutter ${read.gutter}, ${read.offLine} off the line`)
    console.log(`  nesting rule ${read.rule}`)
  })
  console.log(`\nwrote the shot to ${shots}`)
} finally {
  await rm(dir, { recursive: true, force: true })
}
