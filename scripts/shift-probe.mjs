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
const from = file => JSON.stringify(path.join(root, 'src/renderer/src', file))

const PROBE = `import React from ${JSON.stringify(resolve('react'))}
import { createRoot } from ${JSON.stringify(resolve('react-dom/client'))}
import MessageReactions from ${from('components/MessageReactions.tsx')}
import { watchShift } from ${from('state/shift.ts')}
import './probe.css'

watchShift()

createRoot(document.getElementById('root')).render(
  React.createElement('div', { className: 'group/message relative p-16', id: 'msg' },
    React.createElement('p', { className: 'text-sm' }, 'a message somebody wrote'),
    React.createElement(MessageReactions, {
      targetId: 'm1',
      reactions: [],
      deletable: true,
      onDelete: () => {},
      onEdit: () => {},
      onReply: () => {}
    })
  )
)
`

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><script type="module" src="./probe.js"></script></head>
<body class="bg-ink-900 text-fg font-sans"><div id="root"></div></body></html>`

const MAIN = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')
app.disableHardwareAcceleration()
const wait = ms => new Promise(r => setTimeout(r, ms))
const read = win => win.webContents.executeJavaScript(\`(() => {
  const del = document.querySelector('[aria-label="Delete message"]')
  const tray = document.querySelector('[aria-label="More"]')?.closest('div')
  const box = del && del.getBoundingClientRect()
  return JSON.stringify({
    attr: document.documentElement.hasAttribute('data-shift'),
    found: !!del,
    display: del && getComputedStyle(del).display,
    w: box && Math.round(box.width),
    trayOpacity: tray && getComputedStyle(tray).opacity
  })
})()\`)
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 700, height: 400, show: true })
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(900)
    const before = await read(win)
    win.webContents.sendInputEvent({ type: 'mouseMove', x: 120, y: 90 })
    await wait: 0
  } catch (e) {}
})`
