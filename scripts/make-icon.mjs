import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const resources = path.join(root, 'resources')

const CANVAS = 1024
const TILE = { x: 100, y: 100, size: 824, radius: 185 }
const RADIUS = 145
const STEP = 190
const GAP = 42

function svg({ background, ink }) {
  const centre = CANVAS / 2
  const discs = [centre + STEP, centre, centre - STEP]
    .map(
      (x, index) =>
        `    <circle cx="${x}" cy="${centre}" r="${RADIUS}"${index === 0 ? '' : ` stroke="${background}" stroke-width="${GAP}"`} />`
    )
    .join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <rect x="${TILE.x}" y="${TILE.y}" width="${TILE.size}" height="${TILE.size}" rx="${TILE.radius}" fill="${background}" />
  <g fill="${ink}">
${discs}
  </g>
</svg>
`
}

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
].find(candidate => {
  try {
    readFileSync(candidate)
    return true
  } catch {
    return false
  }
})

function raster(source, size, out) {
  if (!CHROME) throw new Error('needs Chrome or Chromium to rasterise the icon')
  const work = mkdtempSync(path.join(tmpdir(), 'crew-icon-'))
  const page = path.join(work, 'icon.html')
  writeFileSync(
    page,
    `<html><body style="margin:0"><img src="data:image/svg+xml;base64,${Buffer.from(source).toString('base64')}" width="${size}" height="${size}"></body></html>`
  )
  execFileSync(CHROME, [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--default-background-color=00000000',
    `--window-size=${size},${size}`,
    `--screenshot=${out}`,
    page
  ])
  rmSync(work, { recursive: true, force: true })
}

const dark = svg({ background: '#0d0d0d', ink: '#ffffff' })
const light = svg({ background: '#ffffff', ink: '#0d0d0d' })

mkdirSync(resources, { recursive: true })
writeFileSync(path.join(resources, 'icon.svg'), dark)
writeFileSync(path.join(resources, 'icon-light.svg'), light)

const iconset = path.join(resources, 'icon.iconset')
rmSync(iconset, { recursive: true, force: true })
mkdirSync(iconset, { recursive: true })
for (const [name, size] of [
  ['icon_16x16', 16],
  ['icon_16x16@2x', 32],
  ['icon_32x32', 32],
  ['icon_32x32@2x', 64],
  ['icon_128x128', 128],
  ['icon_128x128@2x', 256],
  ['icon_256x256', 256],
  ['icon_256x256@2x', 512],
  ['icon_512x512', 512],
  ['icon_512x512@2x', 1024]
]) {
  raster(dark, size, path.join(iconset, `${name}.png`))
}
execFileSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(resources, 'icon.icns')])
rmSync(iconset, { recursive: true, force: true })

raster(dark, 1024, path.join(resources, 'icon.png'))

const embedded = {}
for (const [key, source] of [
  ['dark', dark],
  ['light', light]
]) {
  const out = path.join(tmpdir(), `crew-icon-${key}.png`)
  raster(source, 512, out)
  embedded[key] = readFileSync(out).toString('base64')
  rmSync(out, { force: true })
}

writeFileSync(
  path.join(root, 'src/main/icon-png.ts'),
  `export const DARK_ICON = '${embedded.dark}'\n\nexport const LIGHT_ICON = '${embedded.light}'\n`
)

console.log('wrote resources/icon.svg, icon-light.svg, icon.icns, icon.png and src/main/icon-png.ts')
