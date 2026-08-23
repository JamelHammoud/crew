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
const line = `const long = '${'x'.repeat(500)}'`

const source = () => {
  const from = file => JSON.stringify(path.join(root, 'src/renderer/src', file))
  return `import React from ${JSON.stringify(resolve('react'))}
import { createRoot } from ${JSON.stringify(resolve('react-dom/client'))}
import FileView from ${from('components/FileView.tsx')}
import './probe.css'

const text = ${JSON.stringify(line)}
window.crew = {
  readFile: async path => ({ kind: 'file', path, text, truncated: false }),
  writeFile: async (path, next) => ({ kind: 'file', path, text: next, truncated: false }),
  copyPaths: async path => ({ absolute: path, relative: path })
}
const tab = {
  id: 'file', kind: 'file', initialUrl: '', url: '', title: '', favicon: null,
  loading: false, error: '', canGoBack: false, canGoForward: false,
  path: 'src/long.ts', line: null, diff: null, command: null, folder: '', mime: '', size: 0,
  game: null, threadId: '', parentThreadId: '', back: [], forward: [], tree: false,
  open: [], preview: false, generation: 0, plugin: null, pluginLabel: ''
}
createRoot(document.getElementById('root')).render(React.createElement(FileView, { tab, active: true }))
`
}

const read = `(() => {
  const scroller = document.querySelector('.overflow-auto')
  const gutter = document.querySelector('[data-code-gutter]')
  const code = document.querySelector('[data-code-text]')
  const area = document.querySelector('textarea[aria-label="File contents"]')
  const box = element => {
    const rect = element.getBoundingClientRect()
    return { left: Math.round(rect.left * 10) / 10, width: Math.round(rect.width * 10) / 10 }
  }
  return {
    scrollLeft: scroller.scrollLeft,
    scrollWidth: scroller.scrollWidth,
    clientWidth: scroller.clientWidth,
    gutter: box(gutter),
    code: box(code),
    paddingLeft: getComputedStyle(area).paddingLeft,
    value: area.value,
    selection: [area.selectionStart, area.selectionEnd]
  }
})()`

const focusEnd = `(() => {
  const area = document.querySelector('textarea[aria-label="File contents"]')
  area.focus()
  area.setSelectionRange(area.value.length, area.value.length)
})()`

const main = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')
app.disableHardwareAcceleration()
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const read = ${JSON.stringify(read)}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 720, height: 460, show: true, backgroundColor: '#141414' })
  const js = value => win.webContents.executeJavaScript(value)
  const logs = []
  win.webContents.on('console-message', (_event, _level, message) => logs.push(message))
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    for (let at = 0; at < 40; at += 1) {
      if (await js('Boolean(document.querySelector("textarea[aria-label=\\"File contents\\"]"))')) break
      await wait(50)
    }
    if (!(await js('Boolean(document.querySelector("textarea[aria-label=\\"File contents\\"]"))')))
      throw new Error('no editor: ' + logs.join(' | '))
    await wait(300)
    const before = await js(read)
    await js('document.querySelector(".overflow-auto").scrollLeft = 900')
    await wait(80)
    const scrolled = await js(read)
    await js(${JSON.stringify(focusEnd)})
    await win.webContents.insertText('a')
    await win.webContents.insertText('b')
    await win.webContents.insertText('c')
    await wait(100)
    const typed = await js(read)
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Z', modifiers: ['meta'] })
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Z', modifiers: ['meta'] })
    await wait(100)
    const undone = await js(read)
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Z', modifiers: ['meta', 'shift'] })
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Z', modifiers: ['meta', 'shift'] })
    await wait(100)
    const redone = await js(read)
    console.log('CHECK ' + JSON.stringify({ before, scrolled, typed, undone, redone }))
  } catch (error) {
    console.log('CHECK ' + JSON.stringify({ failed: String(error && error.stack) }))
  }
  app.exit(0)
})`

const stage = async () => {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-file-editor-')))
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
    child.on('error', reject)
    child.on('exit', () => {
      const row = output.split('\n').find(value => value.startsWith('CHECK '))
      if (!row) reject(new Error('the editor check said nothing'))
      else resolve(JSON.parse(row.slice(6)))
    })
  })

const dir = await stage()
try {
  await compile(dir)
  const seen = await run(dir)
  if (seen.failed) throw new Error(seen.failed)
  const problems = []
  if (seen.before.scrollWidth <= seen.before.clientWidth) problems.push('the sample did not overflow')
  if (seen.scrolled.scrollLeft < 800) problems.push('the file did not scroll horizontally')
  if (seen.scrolled.gutter.left !== seen.before.gutter.left) problems.push('the line numbers moved with the file')
  if (seen.scrolled.code.left >= seen.before.code.left - 800) problems.push('the code did not move under the line numbers')
  if (!seen.typed.value.endsWith('abc')) problems.push('typing did not reach the file')
  if (seen.typed.scrollLeft !== seen.scrolled.scrollLeft) problems.push('typing moved the horizontal scroll')
  if (seen.undone.value !== line) problems.push('one undo did not remove the typing run')
  if (!seen.redone.value.endsWith('abc')) problems.push('redo did not restore the typing run')
  if (problems.length) throw new Error(problems.join('\n'))
  console.log(`File editor works in Electron. Gutter stayed at ${seen.before.gutter.left}px while code moved ${Math.round(seen.before.code.left - seen.scrolled.code.left)}px.`)
  console.log('Typing stayed in place, one undo removed the run, and redo restored it.')
} finally {
  await rm(dir, { recursive: true, force: true })
}
