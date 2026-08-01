import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const PICK = ['CopyGlyph', 'PasteGlyph', 'DownloadGlyph', 'UploadGlyph', 'ChecklistGlyph', 'TrashGlyph']

const ENTRY = `
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import * as set from ${JSON.stringify(path.join(root, 'src/renderer/src/icons/index.ts'))}
export function draw() {
  const names = ${JSON.stringify(PICK)}
  return names.map(name => {
    const Icon = set[name]
    const at = size => renderToStaticMarkup(createElement(Icon, { className: 'w-' + size + ' h-' + size }))
      .replace(/class="[^"]*"/, 'style="width:' + size * 4 + 'px;height:' + size * 4 + 'px"')
    return { name, sizes: [12, 8, 6, 5, 4].map(at) }
  })
}
`

const dir = await mkdtemp(path.join(os.tmpdir(), 'copy-look-'))
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

const page = `<!doctype html><html><body style="margin:0;background:#0b0b0d;color:#f5f5f7;font:13px -apple-system,system-ui,sans-serif;padding:32px">
<table style="border-collapse:collapse">
<tr><th></th>${[48, 32, 24, 20, 16].map(s => `<th style="padding:12px 20px;font-weight:400;color:#8a8a92">${s}</th>`).join('')}</tr>
${rows
  .map(
    row =>
      `<tr><td style="padding:12px 24px 12px 0;color:#8a8a92">${row.name.replace('Glyph', '')}</td>` +
      row.sizes.map(svg => `<td style="padding:12px 20px;text-align:center">${svg}</td>`).join('') +
      '</tr>'
  )
  .join('')}
</table></body></html>`

const file = path.join(dir, 'look.html')
await writeFile(file, page)

const { app, BrowserWindow } = await import('electron')
await app.whenReady()
const win = new BrowserWindow({ width: 720, height: 560, show: false, backgroundColor: '#0b0b0d' })
await win.loadFile(file)
const shot = await win.capturePage()
await writeFile(path.join(root, 'copy-look.png'), shot.toPNG())
await rm(dir, { recursive: true, force: true })
app.quit()
