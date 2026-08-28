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
const menuImage = path.join(tmpdir(), 'crew-file-search-menu.png')
const stickyImage = path.join(tmpdir(), 'crew-file-tree-sticky.png')

const source = () => {
  const from = file => JSON.stringify(path.join(root, 'src/renderer/src', file))
  return `import React from ${JSON.stringify(resolve('react'))}
import { createRoot } from ${JSON.stringify(resolve('react-dom/client'))}
import FileTree from ${from('components/FileTree.tsx')}
import { useBrowser } from ${from('state/browser.ts')}
import './probe.css'

const entries = (prefix, count) => Array.from({ length: count }, (_, index) => ({ name: prefix + String(index).padStart(2, '0') + '.ts', dir: false }))
const repo = {
  '': { kind: 'dir', path: '', entries: [{ name: 'src', dir: true }, ...entries('root-', 24)] },
  src: { kind: 'dir', path: 'src', entries: [{ name: 'renderer', dir: true }, ...entries('source-', 18)] },
  'src/renderer': { kind: 'dir', path: 'src/renderer', entries: entries('view-', 60) }
}
const listed = [
  ...entries('root-', 24).map(entry => entry.name),
  ...entries('source-', 18).map(entry => 'src/' + entry.name),
  ...entries('view-', 60).map(entry => 'src/renderer/' + entry.name)
]
window.crew = {
  readFile: async path => repo[path] ?? { kind: 'file', path, text: '', truncated: false },
  listFiles: async () => listed,
  searchFiles: async () => ({ matches: [], limited: false, error: null }),
  replaceFiles: async () => ({ files: 0, replacements: 0, failed: [], error: null }),
  copyPaths: async path => ({ absolute: path, relative: path }),
  writeFile: async () => null,
  revealFile: async () => undefined,
  openExternal: async () => undefined,
  warmTerminal: () => undefined
}
useBrowser.getState().openFiles()
const initial = useBrowser.getState().tabs.find(tab => tab.id === useBrowser.getState().activeTabId)
useBrowser.getState().updateTab(initial.id, { open: ['src', 'src/renderer'] })

function Probe() {
  const tab = useBrowser(state => state.tabs.find(one => one.id === state.activeTabId))
  return React.createElement('main', { className: 'flex h-full w-full justify-end bg-ink-900' }, React.createElement(FileTree, { tab }))
}
createRoot(document.getElementById('root')).render(React.createElement(Probe))
`
}

const main = `const { app, BrowserWindow } = require('electron')
const { writeFile } = require('node:fs/promises')
const path = require('node:path')
app.setPath('userData', path.join(__dirname, 'profile'))
app.disableHardwareAcceleration()
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 900, height: 620, show: true, backgroundColor: '#141414' })
  const js = value => win.webContents.executeJavaScript(value)
  const logs = []
  win.webContents.on('console-message', (_event, _level, message) => logs.push(message))
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    for (let at = 0; at < 50; at += 1) {
      if (await js('Boolean(document.querySelector("[data-file-tree-width] [data-file=\\"src/renderer/view-59.ts\\"]"))')) break
      await wait(50)
    }
    const before = await js(\`(() => ({
      width: Number(document.querySelector('[data-file-tree-width]').getAttribute('data-file-tree-width')),
      more: Boolean(document.querySelector('[aria-label="More search options"]')),
      matchCase: document.body.textContent.includes('Match case'),
      replace: Boolean(document.querySelector('[aria-label="Replace"]')),
      include: Boolean(document.querySelector('[aria-label="Files to include"]'))
    }))()\`)
    await js('document.querySelector(\'[aria-label="More search options"]\').click()')
    await wait(150)
    const menu = await js(\`(() => {
      const button = [...document.querySelectorAll('button')].find(one => one.textContent.trim() === 'Use regular expression')
      return {
        matchCase: document.body.textContent.includes('Match case'),
        wholeWord: document.body.textContent.includes('Match whole word'),
        regex: Boolean(button),
        regexMark: Boolean(button && button.querySelector('svg path, svg circle')),
        filters: document.body.textContent.includes('File filters')
      }
    })()\`)
    await writeFile(${JSON.stringify(menuImage)}, (await win.capturePage()).toPNG())
    await js('document.querySelector(\'[aria-label="More search options"]\').click()')
    await wait(100)
    await js(\`(() => {
      const scroller = document.querySelector('[data-file-tree-width] .overflow-auto')
      scroller.scrollTop = 520
      scroller.dispatchEvent(new Event('scroll', { bubbles: true }))
    })()\`)
    await wait(150)
    const sticky = await js(\`(() => {
      const scroller = document.querySelector('[data-file-tree-width] .overflow-auto')
      const src = document.querySelector('[data-sticky-folder="src"]')
      const renderer = document.querySelector('[data-sticky-folder="src/renderer"]')
      const round = value => Math.round(value * 10) / 10
      return {
        scrollTop: scroller.scrollTop,
        viewportTop: round(scroller.getBoundingClientRect().top),
        srcTop: round(src.getBoundingClientRect().top),
        rendererTop: round(renderer.getBoundingClientRect().top),
        rowHeight: round(src.getBoundingClientRect().height)
      }
    })()\`)
    await writeFile(${JSON.stringify(stickyImage)}, (await win.capturePage()).toPNG())
    const resized = await js(\`(async () => {
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
      const tree = document.querySelector('[data-file-tree-width]')
      const handle = document.querySelector('[aria-label="Resize files"]')
      const x = handle.getBoundingClientRect().left + 2
      handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x }))
      window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x - 56 }))
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x - 56 }))
      await wait(250)
      const dragged = Number(tree.getAttribute('data-file-tree-width'))
      const nextX = handle.getBoundingClientRect().left + 2
      handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: nextX }))
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: nextX }))
      await wait(40)
      handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: nextX }))
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: nextX }))
      await wait(250)
      return { dragged, reset: Number(tree.getAttribute('data-file-tree-width')) }
    })()\`)
    console.log('CHECK ' + JSON.stringify({ before, menu, sticky, resized }))
  } catch (error) {
    console.log('CHECK ' + JSON.stringify({ failed: String(error && error.stack), logs }))
  }
  app.exit(0)
})`

const stage = async () => {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-file-tree-')))
  await writeFile(
    path.join(dir, 'index.html'),
    '<!doctype html><html><head><meta charset="utf-8"><script type="module" src="/probe.tsx"></script></head><body class="mac"><div id="root"></div></body></html>'
  )
  await writeFile(path.join(dir, 'probe.tsx'), source())
  await writeFile(
    path.join(dir, 'probe.css'),
    `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\nhtml, body, #root { width: 100%; height: 100%; margin: 0; position: relative; }\n`
  )
  await writeFile(path.join(dir, 'main.cjs'), main)
  return dir
}

const compile = async dir => {
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

const run = dir =>
  new Promise((resolve, reject) => {
    const child = spawn(electron, [path.join(dir, 'main.cjs')], { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', chunk => (output += chunk))
    child.stderr.on('data', chunk => (output += chunk))
    child.on('error', reject)
    child.on('exit', () => {
      clearTimeout(timeout)
      const row = output.split('\n').find(value => value.startsWith('CHECK '))
      if (!row) reject(new Error(`the file tree check said nothing\n${output}`))
      else resolve(JSON.parse(row.slice(6)))
    })
    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`the file tree check timed out\n${output}`))
    }, 20000)
  })

const dir = await stage()
try {
  await compile(dir)
  const seen = await run(dir)
  if (seen.failed) throw new Error(`${seen.failed}\n${(seen.logs ?? []).join('\n')}`)
  const problems = []
  if (seen.before.width !== 288) problems.push('the Files column did not start at 288 pixels')
  if (!seen.before.more) problems.push('the More control was missing')
  if (seen.before.matchCase || seen.before.replace || seen.before.include) problems.push('advanced controls appeared in the default view')
  if (!seen.menu.matchCase || !seen.menu.wholeWord || !seen.menu.regex || !seen.menu.regexMark || !seen.menu.filters)
    problems.push('the More menu did not hold every advanced control')
  if (seen.sticky.scrollTop < 500) problems.push('the tree did not scroll far enough')
  if (Math.abs(seen.sticky.srcTop - seen.sticky.viewportTop) > 1) problems.push('the first folder did not stick to the viewport')
  if (Math.abs(seen.sticky.rendererTop - seen.sticky.viewportTop - 29) > 1) problems.push('the nested folder did not stack below its parent')
  if (seen.resized.dragged !== 344) problems.push('dragging did not resize the Files column by 56 pixels')
  if (seen.resized.reset !== 288) problems.push('the double press did not reset the Files column')
  if (problems.length) throw new Error(`${problems.join('\n')}\n${JSON.stringify(seen, null, 2)}`)
  console.log(JSON.stringify({ ...seen, menuImage, stickyImage }, null, 2))
} finally {
  await rm(dir, { recursive: true, force: true })
}
