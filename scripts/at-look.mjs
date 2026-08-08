import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const ROW = ['AtGlyph', 'ClockGlyph', 'CompassGlyph', 'ToolboxGlyph']
const LADDER = ['AtGlyph', 'PlugGlyph', 'GlobeGlyph', 'ChatGlyph']

const ENTRY = `
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import * as set from ${JSON.stringify(path.join(root, 'src/renderer/src/icons/index.ts'))}
const at = (name, px) =>
  renderToStaticMarkup(createElement(set[name], { className: 'w-[' + px + 'px] h-[' + px + 'px]' }))
    .replace(/class="[^"]*"/, 'style="width:' + px + 'px;height:' + px + 'px"')
export function draw() {
  return {
    row: ${JSON.stringify(ROW)}.map(name => ({ name, svg: at(name, 16) })),
    ladder: ${JSON.stringify(LADDER)}.map(name => ({
      name,
      sizes: [48, 24, 20, 16].map(px => at(name, px))
    }))
  }
}
`

const dir = await mkdtemp(path.join(os.tmpdir(), 'at-look-'))
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
const { row, ladder } = createRequire(import.meta.url)(bundle).draw()

const LABELS = { AtGlyph: 'Plugins', ClockGlyph: 'Scheduled', CompassGlyph: 'Browser', ToolboxGlyph: 'Toolbox' }

const page = `<!doctype html><html><body style="margin:0;background:#0b0b0d;color:#f5f5f7;font:13px -apple-system,system-ui,sans-serif;padding:32px;display:flex;gap:48px;align-items:flex-start">
<div style="width:176px;padding:6px;border-radius:14px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.08)">
${row
  .map(
    one =>
      `<div style="display:flex;align-items:center;gap:10px;height:32px;padding:0 10px;border-radius:9px;color:rgba(245,245,247,0.7)"><span style="display:flex">${one.svg}</span><span>${LABELS[one.name]}</span></div>`
  )
  .join('')}
</div>
<table style="border-collapse:collapse">
<tr><th></th>${[48, 24, 20, 16].map(s => `<th style="padding:10px 22px;font-weight:400;color:#8a8a92">${s}</th>`).join('')}</tr>
${ladder
  .map(
    one =>
      `<tr><td style="padding:14px 24px 14px 0;color:#8a8a92">${one.name.replace('Glyph', '')}</td>` +
      one.sizes
        .map(svg => `<td style="padding:14px 22px;text-align:center"><span style="display:inline-flex">${svg}</span></td>`)
        .join('') +
      '</tr>'
  )
  .join('')}
</table>
</body></html>`

const file = path.join(dir, 'look.html')
await writeFile(file, page)

const { app, BrowserWindow } = await import('electron')
await app.whenReady()
const win = new BrowserWindow({ width: 760, height: 420, show: false, backgroundColor: '#0b0b0d' })
await win.loadFile(file)
const shot = await win.capturePage()
await writeFile(path.join(root, 'at-look.png'), shot.toPNG())
await rm(dir, { recursive: true, force: true })
app.quit()
