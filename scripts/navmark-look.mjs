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

const rail = (rows, fg, surface, lit, litBg) =>
  `<div style="width:212px;background:${surface};border-radius:16px;padding:8px;display:flex;flex-direction:column;gap:2px">
    ${rows
      .map(
        (row, i) =>
          `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:12px;font:500 13px -apple-system,system-ui,sans-serif;${
            i === 0 ? `background:${litBg};color:${lit}` : `color:${fg}`
          }"><span style="color:${i === 0 ? lit : fg};opacity:${i === 0 ? 0.7 : 0.45};display:flex">${row.at[1]}</span><span style="opacity:${i === 0 ? 1 : 0.7}">${row.label}</span></div>`
      )
      .join('')}
  </div>`

const ramp = (rows, fg) =>
  `<table style="border-collapse:collapse;font:400 12px -apple-system,system-ui,sans-serif;color:${fg}">
    <tr><th></th>${[24, 18, 16, 14].map(s => `<th style="padding:6px 14px;font-weight:400;opacity:.5">${s}</th>`).join('')}</tr>
    ${rows
      .map(
        row =>
          `<tr><td style="padding:8px 16px 8px 0;opacity:.5">${row.label}</td>` +
          row.at
            .map(svg => `<td style="padding:8px 14px"><span style="display:flex;justify-content:center">${svg}</span></td>`)
            .join('') +
          '</tr>'
      )
      .join('')}
  </table>`

const page = `<!doctype html><html><body style="margin:0;display:flex;gap:28px;padding:28px;font-family:-apple-system,system-ui,sans-serif;background:#0b0b0d">
  <div style="background:#141414;padding:20px;border-radius:20px">${rail(rows, '#ffffff', '#222222', '#ffffff', 'rgba(255,255,255,0.08)')}</div>
  <div style="background:#ffffff;padding:20px;border-radius:20px">${rail(rows, '#141414', '#f2f2f2', '#141414', 'rgba(20,20,20,0.08)')}</div>
  <div style="background:#141414;padding:20px 24px;border-radius:20px">${ramp(rows, '#ffffff')}</div>
</body></html>`

const file = path.join(dir, 'look.html')
await writeFile(file, page)

const { app, BrowserWindow } = await import('electron')
await app.whenReady()
const win = new BrowserWindow({ width: 1020, height: 400, show: false, backgroundColor: '#0b0b0d' })
await win.loadFile(file)
const shot = await win.capturePage()
await writeFile(path.join(root, 'navmark-look.png'), shot.toPNG())
await rm(dir, { recursive: true, force: true })
app.quit()
