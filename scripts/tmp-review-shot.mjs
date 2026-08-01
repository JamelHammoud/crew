import { spawn } from 'node:child_process'
import { mkdtemp, readdir, realpath, rm, writeFile, copyFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = '/Users/jamel/Documents/Repositories/crew'
const out = process.argv[2] ?? path.join(here, 'review.png')

const ENTRY = `
import { createRoot } from 'react-dom/client'
import { createElement } from 'react'
import './shot.css'
import ReviewView from '${root}/src/renderer/src/components/review/ReviewView'
import { useCrew } from '${root}/src/renderer/src/state/store'
import { useReviewed } from '${root}/src/renderer/src/state/reviewed'

const hunks = [
  '@@ -12,6 +12,7 @@ export function threadState(thread, events) {',
  '   const promptId = threadPrompts[thread.id]',
  '   const working = threadWorking(thread.id, threadPrompts, queues)',
  '-  if (!working) return "ready"',
  '+  if (!working && thread.status === "open") return "ready"',
  '+  if (thread.parentThreadId) return "helper"',
  '   return "working"',
  ' }',
  '@@ -84,3 +85,3 @@ const byRecency = (a, b) =>',
  '   (lastMessageAt[b.thread.id] ?? 0) - (lastMessageAt[a.thread.id] ?? 0)',
  '-const inProgress = visible.filter(r => r.state === "working")',
  '+const inProgress = visible.filter(r => r.state === "working" && !r.thread.archived)',
].join('\\n')

const changes = [
  { path: 'src/renderer/src/components/thread.ts', kind: 'modified', staged: true, added: 3, removed: 2, diff: hunks, binary: false, truncated: false },
  { path: 'src/shared/alerts.ts', kind: 'modified', staged: true, added: 12, removed: 1, diff: '@@ -1,3 +1,4 @@\\n import type { AgentAlert } from "./alerts"\\n+import { threadWorking } from "./thread"\\n \\n export interface ReviewState {', binary: false, truncated: false },
  { path: 'src/renderer/src/components/review/ReviewRow.tsx', kind: 'added', staged: false, added: 74, removed: 0, diff: '@@ -0,0 +1,3 @@\\n+export default function ReviewRow() {\\n+  return null\\n+}', binary: false, truncated: false },
  { path: 'src/renderer/src/components/review/OldPanel.tsx', kind: 'deleted', staged: false, added: 0, removed: 61, diff: '@@ -1,3 +0,0 @@\\n-export default function OldPanel() {\\n-  return null\\n-}', binary: false, truncated: false },
  { path: 'src/renderer/src/state/reviewed.ts', kind: 'modified', staged: false, added: 8, removed: 4, diff: '@@ -30,4 +30,4 @@ const KEY = "crew.reviewed"\\n const PLACE_LIMIT = 20\\n-const FILE_LIMIT = 200\\n+const FILE_LIMIT = 400', binary: false, truncated: false },
  { path: 'tests/review-panel.test.ts', kind: 'modified', staged: false, added: 41, removed: 9, diff: '@@ -5,3 +5,3 @@\\n import { describe, it } from "vitest"\\n-const change = (path, staged) => ({ path })\\n+const change = (path, staged, diff) => ({ path, diff })', binary: false, truncated: false },
  { path: 'package.json', kind: 'modified', staged: false, added: 1, removed: 1, diff: '@@ -14,3 +14,3 @@\\n   "scripts": {\\n-    "test": "vitest"\\n+    "test": "vitest run"', binary: false, truncated: false },
]

window.crew = {
  repoWork: async () => ({
    status: { available: true, remote: true, branch: 'review-pass', changed: 7, ahead: 2, behind: 1, stashes: 1 },
    changes,
    stashes: [{ ref: 'stash@{0}', message: 'Half of the keyboard work', branch: 'review-pass' }],
  }),
  runRepo: async () => ({ ok: true, updated: true, message: 'Done', status: {} }),
}

useCrew.setState({ place: 'project:/demo' })
useReviewed.setState({
  read: { 'project:/demo': {} },
})

createRoot(document.getElementById('root')).render(createElement(ReviewView))

window.markRead = (key, digest) => useReviewed.getState().markRead('project:/demo', key, digest)
`

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body class="bg-ink-900 text-fg font-sans" style="margin:0">
  <div id="root" style="height:100vh"></div>
  <script type="module" src="./shot.tsx"></script>
</body></html>`

const MAIN = `const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
app.disableHardwareAcceleration()
const wait = ms => new Promise(r => setTimeout(r, ms))

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 480, height: 900, show: false, backgroundColor: '#000000' })
  await win.loadFile(path.join(__dirname, 'dist/index.html'))
  await wait(1200)
  // open two files so the reading is on screen, and mark one row read
  await win.webContents.executeJavaScript(\`
    const rows = [...document.querySelectorAll('[aria-expanded]')]
    rows[0]?.click()
    const marks = [...document.querySelectorAll('[aria-label="Mark as read"]')]
    marks[2]?.click()
    marks[5]?.click()
  \`)
  await wait(900)
  const shot = await win.webContents.capturePage()
  fs.writeFileSync(process.env.SHOT_OUT, shot.toPNG())
  console.log('SHOT ' + JSON.stringify({ ok: true }))
  app.quit()
}).catch(e => { console.log('SHOT ' + JSON.stringify({ failed: String(e) })); app.quit() })
`

const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-review-')))
await writeFile(path.join(dir, 'index.html'), PAGE)
await writeFile(
  path.join(dir, 'shot.css'),
  `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\n`
)
await writeFile(path.join(dir, 'shot.tsx'), ENTRY)
await writeFile(path.join(dir, 'main.cjs'), MAIN)

const { build } = await import('vite')
const react = (await import('@vitejs/plugin-react')).default
const tailwind = (await import('@tailwindcss/vite')).default
await build({
  root: dir,
  base: './',
  logLevel: 'silent',
  plugins: [react(), tailwind()],
  build: { outDir: path.join(dir, 'dist'), emptyOutDir: true },
})

await new Promise((resolve, reject) => {
  const child = spawn(electron, [path.join(dir, 'main.cjs')], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, SHOT_OUT: out },
  })
  let text = ''
  child.stdout.on('data', c => (text += c))
  child.stderr.on('data', c => (text += c))
  child.on('exit', () => {
    const line = text.split('\n').find(r => r.startsWith('SHOT '))
    if (!line) return reject(new Error('window said nothing: ' + text.slice(-800)))
    const seen = JSON.parse(line.slice(5))
    if (seen.failed) return reject(new Error(seen.failed))
    resolve()
  })
  child.on('error', reject)
})

console.log('wrote ' + out)
await rm(dir, { recursive: true, force: true })
