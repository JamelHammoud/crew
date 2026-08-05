import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const ENTRY = `
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { TABS, MORE_TABS, MoreIcon } from ${JSON.stringify(path.join(root, 'src/renderer/src/components/navTabs.tsx'))}
export function draw() {
  const rows = [...TABS, ...MORE_TABS, { id: 'more', label: 'More', Icon: MoreIcon }]
  return rows.map(row => ({
    label: row.label,
    at: [24, 18, 16, 14].map(px => {
      const markup = renderToStaticMarkup(createElement(row.Icon, { className: 'w-[' + px + 'px] h-[' + px + 'px]' }))
      return markup.replace(/class="[^"]*"/, 'style="width:' + px + 'px;height:' + px + 'px;display:block"')
    })
  }))
}
`

const dir = await mkdtemp(path.join(os.tmpdir(), 'navmark-'))
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
const rows = createRequire(import.meta.url)(bundle).draw()

const rail = (fg, surface, litBg) =>
  `<div style="width:212px;background:${surface};border-radius:16px;padding:8px;display:flex;flex-direction:column;gap:2px">
    ${rows
      .map(
        (row, i) =>
          `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:12px;font:500 13px -apple-system,system-ui,sans-serif;color:${fg};${
            i === 0 ? `background:${litBg}` : ''
          }"><span style="display:flex;opacity:${i === 0 ? 0.7 : 0.45}">${row.at[1]}</span><span style="opacity:${i === 0 ? 1 : 0.7}">${row.label}</span></div>`
      )
      .join('')}
  </div>`

const ramp = fg =>
  `<table style="border-collapse:collapse;font:400 12px -apple-system,system-ui,sans-serif;color:${fg}">
    <tr><th></th>${[24, 18, 16, 14]
      .map(s => `<th style="padding:6px 14px;font-weight:400;opacity:.5">${s}</th>`)
      .join('')}</tr>
    ${rows
      .map(
        row =>
          `<tr><td style="padding:9px 16px 9px 0;opacity:.5">${row.label}</td>` +
          row.at
            .map(
              svg =>
                `<td style="padding:9px 14px"><span style="display:flex;justify-content:center">${svg}</span></td>`
            )
            .join('') +
          '</tr>'
      )
      .join('')}
  </table>`

const page = `<!doctype html><html><body style="margin:0;display:flex;gap:24px;padding:24px;align-items:flex-start;font-family:-apple-system,system-ui,sans-serif;background:#0b0b0d">
  <div style="background:#141414;padding:18px;border-radius:20px">${rail('#ffffff', '#222222', 'rgba(255,255,255,0.08)')}</div>
  <div style="background:#ffffff;padding:18px;border-radius:20px">${rail('#141414', '#f2f2f2', 'rgba(20,20,20,0.08)')}</div>
  <div style="background:#141414;padding:18px 22px;border-radius:20px">${ramp('#ffffff')}</div>
</body></html>`

const file = path.join(dir, 'look.html')
await writeFile(file, page)

const MAIN = `
const { app, BrowserWindow } = require('electron')
const { writeFileSync } = require('fs')
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1000, height: 380, show: false, backgroundColor: '#0b0b0d' })
  await win.loadFile(${JSON.stringify(file)})
  const shot = await win.capturePage()
  writeFileSync(${JSON.stringify(path.join(root, 'navmark-look.png'))}, shot.toPNG())
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
console.log('navmark-look.png')
