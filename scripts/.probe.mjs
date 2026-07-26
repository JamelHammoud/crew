import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const source = path.join(here, process.argv[2] ?? '.probe.tsx')
const shot = path.join(root, process.argv[3] ?? 'probe.png')

const ENTRY = `
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import Probe from ${JSON.stringify(source)}
export function draw() {
  return renderToStaticMarkup(createElement(Probe, {}))
}
`

const PAGE = body => `<!doctype html><html><head><style>
* { box-sizing: border-box; }
body { margin: 0; background: #0d0d0f; color: #fff;
  font: 13px -apple-system, BlinkMacSystemFont, sans-serif; padding: 24px; }
.row { display: flex; align-items: center; gap: 20px; margin-bottom: 20px; }
.cap { color: #ffffff66; font-size: 11px; width: 120px; }
svg[class~="w-3"] { width: 12px; height: 12px; }
svg[class~="w-4"] { width: 16px; height: 16px; }
svg[class~="w-5"] { width: 20px; height: 20px; }
svg[class~="w-6"] { width: 24px; height: 24px; }
svg[class~="w-12"] { width: 48px; height: 48px; }
svg[class~="w-[16px]"] { width: 16px; height: 16px; }
svg[class~="w-[17px]"] { width: 17px; height: 17px; }
svg[class~="w-[18px]"] { width: 18px; height: 18px; }
svg[class~="w-[20px]"] { width: 20px; height: 20px; }
svg[class~="w-[22px]"] { width: 22px; height: 22px; }
</style></head><body>${body}</body></html>`

const MAIN = page => `import { app, BrowserWindow } from 'electron'
import { writeFile } from 'node:fs/promises'
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 980, height: 1100, show: false, backgroundColor: '#0d0d0f' })
  await win.loadFile(${JSON.stringify(page)})
  const image = await win.webContents.capturePage()
  await writeFile(${JSON.stringify(shot)}, image.toPNG())
  app.quit()
})
`

const dir = await mkdtemp(path.join(root, 'node_modules', '.crew-probe-'))
try {
  const entry = path.join(dir, 'entry.jsx')
  await writeFile(entry, ENTRY)
  const bundle = path.join(dir, 'bundle.mjs')
  await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: bundle,
    jsx: 'automatic',
    loader: { '.ts': 'ts', '.tsx': 'tsx' },
    external: ['react', 'react-dom', 'react/jsx-runtime'],
    absWorkingDir: root,
    logLevel: 'silent'
  })
  const { draw } = await import(`file://${bundle}`)
  const page = path.join(dir, 'probe.html')
  await writeFile(page, PAGE(draw()))
  const main = path.join(dir, 'main.mjs')
  await writeFile(main, MAIN(page))
  await new Promise((done, fail) => {
    const child = spawn(electron, [main], { stdio: 'inherit' })
    child.on('exit', code => (code === 0 ? done() : fail(new Error(`electron ${code}`))))
  })
  console.log(shot)
} finally {
  await rm(dir, { recursive: true, force: true })
}
