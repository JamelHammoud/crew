import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const ENTRY = `
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import TabIcon from ${JSON.stringify(path.join(root, 'src/renderer/src/components/TabIcon.tsx'))}
import { FolderGlyph, GlobeGlyph, PlusGlyph } from ${JSON.stringify(path.join(root, 'src/renderer/src/icons/index.ts'))}
export function draw() {
  const tab = (id, size) => renderToStaticMarkup(createElement(TabIcon, { tab: id, size }))
  return {
    chat: tab('chat', 18),
    docs: tab('docs', 18),
    design: tab('design', 18),
    folder: renderToStaticMarkup(createElement(FolderGlyph, { className: 'w-4 h-4' })),
    globe: renderToStaticMarkup(createElement(GlobeGlyph, { className: 'w-4 h-4' })),
    plus: renderToStaticMarkup(createElement(PlusGlyph, { className: 'w-4 h-4' }))
  }
}
`

const dir = await mkdtemp(path.join(os.tmpdir(), 'sidebar-look-'))
const entry = path.join(dir, 'entry.jsx')
await writeFile(entry, ENTRY)
const bundle = path.join(dir, 'bundle.cjs')
await build({
  entryPoints: [entry],
  bundle: true,
  outfile: bundle,
  format: 'cjs',
  platform: 'node',
  jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  logLevel: 'error'
})
const { createRequire } = await import('node:module')
const marks = createRequire(import.meta.url)(bundle).draw()

const ROW = 'w-full rounded-xl px-2 py-1.5 flex items-center gap-2 text-left text-sm font-medium'
const QUIET = 'text-fg/70'

const tabRow = (mark, label, state) =>
  `<button class="${ROW} ${
    state === 'on' ? 'bg-fg/[0.08] text-fg' : state === 'hover' ? 'bg-fg/[0.06] text-fg' : QUIET
  }"><span class="${state === 'on' ? 'text-fg/70' : 'text-fg/45'}">${mark}</span>${label}</button>`

const placeRow = (mark, label, on) =>
  `<button class="w-full rounded-xl px-2 py-1.5 flex items-center gap-2 text-left ${
    on ? 'text-fg' : 'text-fg/70'
  }"><span class="${on ? 'text-fg/70' : 'text-fg/45'}">${mark}</span><span class="min-w-0 flex-1 truncate text-sm font-medium">${label}</span></button>`

const threadRow = (label, state) =>
  `<button class="w-full rounded-xl pl-8 pr-2 py-1.5 flex items-center gap-2 text-left text-sm ${
    state === 'on' ? 'bg-fg/[0.10] text-fg' : state === 'hover' ? 'bg-fg/[0.06] text-fg' : QUIET
  }"><span class="min-w-0 flex-1 truncate">${label}</span></button>`

const sidebar = `
<aside style="width:264px" class="h-full flex flex-col sidebar-pinned bg-ink-800 border-r border-[var(--glass-line)]">
  <div class="h-[70px] shrink-0"></div>
  <nav class="shrink-0 px-2 flex flex-col gap-0.5">
    ${tabRow(marks.chat, 'Chat', 'on')}
    ${tabRow(marks.docs, 'Docs', 'hover')}
    ${tabRow(marks.design, 'Design', 'off')}
  </nav>
  <h2 class="shrink-0 px-4 pt-5 pb-1 text-xs font-medium text-fg/45">Projects</h2>
  <div class="scroll-fade flex-1 min-h-0 overflow-y-auto px-2 pt-1" data-fade-bottom>
    <div class="pb-4 flex flex-col gap-0.5">
      ${placeRow(marks.globe, 'crew', true)}
      ${threadRow('When the sidebar is clicked open', 'on')}
      ${threadRow('Completely replace tl-draw in Design', 'hover')}
      ${threadRow('I want you to see if there is anything', 'off')}
      ${threadRow('What is the best way to add usage', 'off')}
      ${threadRow('When clicking on an older thread', 'off')}
    </div>
    <div class="pb-4 flex flex-col gap-0.5 opacity-45">
      ${placeRow(marks.folder, 'roam', false)}
    </div>
    <div class="pb-4 flex flex-col gap-0.5 opacity-45">
      ${placeRow(marks.folder, 'wheeled-robot', false)}
    </div>
  </div>
  <div class="shrink-0 px-4 pb-4 pt-2">
    <button class="w-full h-9 rounded-full flex items-center justify-center gap-2 text-sm font-medium bg-fg/[0.10] text-fg/70">${marks.plus}Open a folder</button>
  </div>
</aside>`

const css = path.join(dir, 'in.css')
await writeFile(css, `@import ${JSON.stringify(path.join(root, 'src/renderer/src/styles.css'))};\n@source ${JSON.stringify(root)};\n`)
const out = path.join(dir, 'out.css')
const { execFile } = await import('node:child_process')
const { promisify } = await import('node:util')
await promisify(execFile)(path.join(root, 'node_modules/.bin/tailwindcss'), ['-i', css, '-o', out], { cwd: root })
const { readFile } = await import('node:fs/promises')
const sheet = await readFile(out, 'utf8')

const page = `<!doctype html><html class="dark"><head><style>${sheet}</style></head>
<body class="mac"><div id="root" class="dark" style="height:100vh;background:#0f0f0f">
<div style="height:100%;display:flex">${sidebar}<div style="flex:1;background:var(--color-ink-900)"></div></div>
</div></body></html>`

const file = path.join(dir, 'look.html')
await writeFile(file, page)

const { app, BrowserWindow } = await import('electron')
await app.whenReady()
const win = new BrowserWindow({ width: 560, height: 720, show: false, backgroundColor: '#0f0f0f' })
await win.loadFile(file)
await new Promise(done => setTimeout(done, 400))
const shot = await win.capturePage()
await writeFile(path.join(root, 'sidebar-look.png'), shot.toPNG())
await rm(dir, { recursive: true, force: true })
app.quit()
