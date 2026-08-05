import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const FRAMES = {
  'frame now 15': ['M8.25 4.5v15M15.75 4.5v15', 'M4.5 8.25h15M4.5 15.75h15'],
  'frame tick 15': ['M9.5 4.5v15M14.5 4.5v15', 'M4.5 9.5h15M4.5 14.5h15'],
  'frame mid 15': ['M9 4.5v15M15 4.5v15', 'M4.5 9h15M4.5 15h15'],
  'frame was 18': ['M8.25 3v18M15.75 3v18', 'M3 8.25h18M3 15.75h18']
}

const PLUGS = {
  'plug now': [
    'M5.9 7.75H18.1A1.5 1.5 0 0 1 19.6 9.25V13.25A4 4 0 0 1 15.6 17.25H8.4A4 4 0 0 1 4.4 13.25V9.25A1.5 1.5 0 0 1 5.9 7.75Z',
    'M8.5 7.75V2.5M15.5 7.75V2.5',
    'M12 17.25v4.25'
  ],
  'plug deep': [
    'M5.9 6.5H18.1A1.5 1.5 0 0 1 19.6 8V12.5A5 5 0 0 1 14.6 17.5H9.4A5 5 0 0 1 4.4 12.5V8A1.5 1.5 0 0 1 5.9 6.5Z',
    'M8.5 6.5V2.5M15.5 6.5V2.5',
    'M12 17.5v4'
  ],
  'plug bell': [
    'M4.4 7.25H19.6V12A7.6 7.6 0 0 1 4.4 12Z',
    'M8.5 7.25V2.5M15.5 7.25V2.5',
    'M12 19.6v1.9'
  ],
  'plug round': [
    'M5.9 6.5H18.1A1.5 1.5 0 0 1 19.6 8V11.5A6.5 6.5 0 0 1 4.4 11.5V8A1.5 1.5 0 0 1 5.9 6.5Z',
    'M8.5 6.5V2.5M15.5 6.5V2.5',
    'M12 18v3.5'
  ]
}

const svg = (paths, px) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:${px}px;height:${px}px;display:block">${paths
    .map(d => `<path d="${d}"></path>`)
    .join('')}</svg>`

const ENTRY = `
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { ChatGlyph, DocGlyph } from ${JSON.stringify(path.join(root, 'src/renderer/src/icons/index.ts'))}
export function draw(px) {
  return [['Chat', ChatGlyph], ['Docs', DocGlyph]].map(([label, Icon]) => ({
    label,
    markup: renderToStaticMarkup(createElement(Icon, { className: 'w-[' + px + 'px] h-[' + px + 'px]' }))
      .replace(/class="[^"]*"/, 'style="width:' + px + 'px;height:' + px + 'px;display:block"')
  }))
}
`

const dir = await mkdtemp(path.join(os.tmpdir(), 'navtry-'))
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
  nodePaths: [path.join(root, 'node_modules')],
  absWorkingDir: root,
  logLevel: 'error'
})
const { createRequire } = await import('node:module')
const { draw } = createRequire(import.meta.url)(bundle)

const row = (label, markup, dim) =>
  `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:12px;font:500 13px -apple-system,system-ui,sans-serif;color:#fff">
    <span style="display:flex;opacity:${dim}">${markup}</span><span style="opacity:.7">${label}</span></div>`

const rail = (name, paths, px) =>
  `<div style="display:flex;flex-direction:column;gap:6px;align-items:center">
    <div style="width:190px;background:#222;border-radius:16px;padding:8px;display:flex;flex-direction:column;gap:2px">
      ${draw(px)
        .map(one => row(one.label, one.markup, 0.45))
        .join('')}
      ${row(name.startsWith('frame') ? 'Design' : 'Plugins', svg(paths, px), 0.45)}
    </div>
    <div style="font:400 11px -apple-system,system-ui,sans-serif;color:#8a8a92">${name}</div>
  </div>`

const band = (title, set, px) =>
  `<div style="margin-bottom:6px">
    <div style="font:400 11px -apple-system,system-ui,sans-serif;color:#8a8a92;padding:0 0 10px 4px">${title} at ${px}</div>
    <div style="display:flex;gap:14px">${Object.entries(set)
      .map(([name, paths]) => rail(name, paths, px))
      .join('')}</div>
  </div>`

const page = `<!doctype html><html><body style="margin:0;padding:22px;background:#141414;font-family:-apple-system,system-ui,sans-serif">
  ${band('Design', FRAMES, 18)}
  ${band('Design', FRAMES, 15)}
  ${band('Plugins', PLUGS, 18)}
  ${band('Plugins', PLUGS, 15)}
</body></html>`

const file = path.join(dir, 'try.html')
await writeFile(file, page)

const MAIN = `
const { app, BrowserWindow } = require('electron')
const { writeFileSync } = require('fs')
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 900, height: 900, show: false, backgroundColor: '#141414' })
  await win.loadFile(${JSON.stringify(file)})
  const shot = await win.capturePage()
  writeFileSync(${JSON.stringify(path.join(root, 'navmark-try.png'))}, shot.toPNG())
  app.quit()
})
`
const main = path.join(dir, 'main.cjs')
await writeFile(main, MAIN)

await new Promise((resolve, reject) => {
  const child = spawn(electron, [main], { stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', () => {})
  child.stderr.on('data', () => {})
  child.on('exit', code => (code === 0 ? resolve() : reject(new Error('electron exited ' + code))))
})

await rm(dir, { recursive: true, force: true })
console.log('navmark-try.png')
