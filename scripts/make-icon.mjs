import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const resources = path.join(root, 'resources')

const CANVAS = 1024
const TILE = { x: 100, y: 100, size: 824, radius: 185 }
const RIM = 4
const RADIUS = 130
const STEP = 186
const GAP = 28
const GRID = TILE.size / 5
const RULES = [-1.5, -0.5, 0.5, 1.5]

const THEMES = {
  dark: {
    ink: '#ffffff',
    tile: [
      ['#26262b', 1],
      ['#141417', 1],
      ['#08080a', 1]
    ],
    rim: [
      ['#ffffff', 0.62],
      ['#ffffff', 0.06],
      ['#ffffff', 0.3]
    ],
    sheen: 0.1
  },
  light: {
    ink: '#0d0d0d',
    tile: [
      ['#ffffff', 1],
      ['#f5f5f7', 1],
      ['#e2e2e7', 1]
    ],
    rim: [
      ['#ffffff', 0.95],
      ['#000000', 0.05],
      ['#000000', 0.16]
    ],
    sheen: 0.35
  },
  devDark: {
    tile: [
      ['#15181f', 1],
      ['#0a0c12', 1],
      ['#040508', 1]
    ],
    rim: [
      ['#9ac8f5', 0.42],
      ['#9ac8f5', 0.05],
      ['#9ac8f5', 0.22]
    ],
    sheen: 0.07,
    grid: ['#4d94db', 0.3],
    glow: ['#1d4d84', 0.5],
    body: [
      [0, '#c7ecff', 1],
      [0.26, '#63b6f8', 1],
      [0.58, '#2078db', 1],
      [0.84, '#0b4099', 1],
      [1, '#05265c', 1]
    ],
    shade: ['#02102e', 0.55],
    bounce: ['#a6dcff', 0.9],
    gloss: 0.9
  },
  devLight: {
    tile: [
      ['#a9e2fb', 1],
      ['#6dbdf3', 1],
      ['#3b95e9', 1]
    ],
    rim: [
      ['#ffffff', 0.85],
      ['#ffffff', 0.08],
      ['#0b3d70', 0.16]
    ],
    sheen: 0.24,
    grid: ['#ffffff', 0.42],
    glow: ['#ffffff', 0.28],
    body: [
      [0, '#ffffff', 1],
      [0.3, '#f6fbff', 1],
      [0.62, '#dbedfc', 1],
      [0.86, '#adcfef', 1],
      [1, '#7fa9d4', 1]
    ],
    shade: ['#14406e', 0.35],
    bounce: ['#ffffff', 0.95],
    gloss: 0.95
  }
}

const stops = ([top, middle, bottom]) =>
  [
    [0, top],
    [0.5, middle],
    [1, bottom]
  ]
    .map(
      ([offset, [colour, opacity]]) =>
        `      <stop offset="${offset}" stop-color="${colour}" stop-opacity="${opacity}" />`
    )
    .join('\n')

const CENTRE = CANVAS / 2
const BACK_TO_FRONT = [CENTRE + STEP, CENTRE, CENTRE - STEP]
const round = value => Number(value.toFixed(3))

// Each disc is masked only by the discs standing in front of it, so a gap can
// never be reopened by whatever is drawn next. One flat mask reopened it, and
// the outlines crossed like rings instead of stacking.
const cutMasks = () =>
  BACK_TO_FRONT.map((_, index) => {
    const infront = BACK_TO_FRONT.slice(index + 1).map(
      x => `\n      <circle cx="${x}" cy="${CENTRE}" r="${RADIUS + GAP}" fill="#000000" />`
    )
    return `    <mask id="cut-${index}" maskUnits="userSpaceOnUse" x="0" y="0" width="${CANVAS}" height="${CANVAS}">
      <rect x="0" y="0" width="${CANVAS}" height="${CANVAS}" fill="#ffffff" />${infront.join('')}
    </mask>`
  }).join('\n')

const discs = () =>
  BACK_TO_FRONT.map(
    (x, index) =>
      `    <circle cx="${x}" cy="${CENTRE}" r="${RADIUS}" mask="url(#cut-${index})" />`
  ).join('\n')

// The specular sits where the light is, up and to the left, and is an ellipse
// because a round one on a round body reads as a hole rather than a shine.
const speculars = () =>
  BACK_TO_FRONT.map(
    (x, index) =>
      `    <ellipse cx="${round(x - RADIUS * 0.26)}" cy="${round(CENTRE - RADIUS * 0.46)}" rx="${round(RADIUS * 0.46)}" ry="${round(RADIUS * 0.3)}" mask="url(#cut-${index})" />`
  ).join('\n')

// Ruled paper: one square grid over the whole tile, centred on the middle cell
// so the stack sits in the middle of a square rather than on a line.
const gridLines = () =>
  RULES.map(step => round(CENTRE + step * GRID))
    .flatMap(at => [
      `    <line x1="${at}" y1="${TILE.y}" x2="${at}" y2="${TILE.y + TILE.size}" />`,
      `    <line x1="${TILE.x}" y1="${at}" x2="${TILE.x + TILE.size}" y2="${at}" />`
    ])
    .join('\n')

// A disc is lit from the upper left: a body that falls away to the far edge, a
// shade drawn in all round it, one bounce of light along the lower edge where
// the tile throws it back, and a specular where the light lands. Every gradient
// is in bounding box units, so one definition shades all three the same way.
function svg({ ink, tile, rim, sheen, grid, glow, body, shade, bounce, gloss }, blueprint = false) {
  const paper = blueprint
    ? `    <radialGradient id="glow" cx="${CENTRE}" cy="${round(CENTRE - GRID * 0.3)}" r="${round(TILE.size * 0.46)}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${glow[0]}" stop-opacity="${glow[1]}" />
      <stop offset="1" stop-color="${glow[0]}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="body" cx="0.34" cy="0.27" r="0.94">
${ramp(body)}
    </radialGradient>
    <radialGradient id="shade" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0.72" stop-color="${shade[0]}" stop-opacity="0" />
      <stop offset="0.93" stop-color="${shade[0]}" stop-opacity="${round(shade[1] * 0.35)}" />
      <stop offset="1" stop-color="${shade[0]}" stop-opacity="${shade[1]}" />
    </radialGradient>
    <radialGradient id="bounce" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0.8" stop-color="${bounce[0]}" stop-opacity="0" />
      <stop offset="0.95" stop-color="${bounce[0]}" stop-opacity="${bounce[1]}" />
      <stop offset="1" stop-color="${bounce[0]}" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="lower" x1="0" y1="${round(CENTRE + RADIUS * 0.1)}" x2="0" y2="${CENTRE + RADIUS}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#000000" />
      <stop offset="1" stop-color="#ffffff" />
    </linearGradient>
    <mask id="under" maskUnits="userSpaceOnUse" x="0" y="0" width="${CANVAS}" height="${CANVAS}">
      <rect x="0" y="0" width="${CANVAS}" height="${CANVAS}" fill="url(#lower)" />
    </mask>
    <radialGradient id="gloss" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffffff" stop-opacity="${gloss}" />
      <stop offset="0.45" stop-color="#ffffff" stop-opacity="${round(gloss * 0.5)}" />
      <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
    </radialGradient>
    <filter id="cast" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="12" stdDeviation="18" flood-color="#02102c" flood-opacity="0.5" />
    </filter>
`
    : ''
  const ruled = blueprint
    ? `  <g clip-path="url(#tile-clip)">
    <rect x="${TILE.x}" y="${TILE.y}" width="${TILE.size}" height="${TILE.size}" fill="url(#glow)" />
    <g fill="none" stroke="${grid[0]}" stroke-opacity="${grid[1]}" stroke-width="3">
${gridLines()}
    </g>
  </g>
`
    : ''
  const drawing = blueprint
    ? `  <g fill="url(#mark)" filter="url(#cast)">
${discs()}
  </g>
  <g fill="url(#bounce)">
${discs()}
  </g>
  <g fill="url(#gloss)">
${discs()}
  </g>`
    : `  <g fill="${ink}">
${discs()}
  </g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <defs>
    <linearGradient id="tile" x1="0" y1="${TILE.y}" x2="0" y2="${TILE.y + TILE.size}" gradientUnits="userSpaceOnUse">
${stops(tile)}
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="${TILE.y}" x2="0" y2="${TILE.y + TILE.size * 0.55}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff" stop-opacity="${sheen}" />
      <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="rim" x1="0" y1="${TILE.y}" x2="0" y2="${TILE.y + TILE.size}" gradientUnits="userSpaceOnUse">
${stops(rim)}
    </linearGradient>
${paper}    <clipPath id="tile-clip">
      <rect x="${TILE.x}" y="${TILE.y}" width="${TILE.size}" height="${TILE.size}" rx="${TILE.radius}" />
    </clipPath>
${cutMasks()}
  </defs>
  <rect x="${TILE.x}" y="${TILE.y}" width="${TILE.size}" height="${TILE.size}" rx="${TILE.radius}" fill="url(#tile)" />
${ruled}  <rect x="${TILE.x}" y="${TILE.y}" width="${TILE.size}" height="${TILE.size}" rx="${TILE.radius}" fill="url(#sheen)" />
  <rect x="${TILE.x + RIM / 2}" y="${TILE.y + RIM / 2}" width="${TILE.size - RIM}" height="${TILE.size - RIM}" rx="${TILE.radius - RIM / 2}" fill="none" stroke="url(#rim)" stroke-width="${RIM}" />
${drawing}
</svg>
`
}

const MARK = { width: 2 * (STEP + RADIUS), height: 2 * RADIUS }
const MARK_DISCS = [STEP + RADIUS + STEP, STEP + RADIUS, RADIUS]

function mark() {
  const cuts = MARK_DISCS.flatMap((x, index) => [
    ...(index === 0
      ? []
      : [`    <circle cx="${x}" cy="${RADIUS}" r="${RADIUS + GAP}" fill="#000000" />`]),
    `    <circle cx="${x}" cy="${RADIUS}" r="${RADIUS}" fill="#ffffff" />`
  ])
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARK.width} ${MARK.height}" width="${MARK.width}" height="${MARK.height}">
  <mask id="crew-mark" maskUnits="userSpaceOnUse" x="0" y="0" width="${MARK.width}" height="${MARK.height}">
    <rect x="0" y="0" width="${MARK.width}" height="${MARK.height}" fill="#000000" />
${cuts.join('\n')}
  </mask>
  <rect x="0" y="0" width="${MARK.width}" height="${MARK.height}" fill="currentColor" mask="url(#crew-mark)" />
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

const dark = svg(THEMES.dark)
const light = svg(THEMES.light)
const devDark = svg(THEMES.devDark, true)
const devLight = svg(THEMES.devLight, true)

mkdirSync(resources, { recursive: true })
writeFileSync(path.join(resources, 'icon.svg'), dark)
writeFileSync(path.join(resources, 'icon-light.svg'), light)
writeFileSync(path.join(resources, 'icon-dev.svg'), devDark)
writeFileSync(path.join(resources, 'icon-dev-light.svg'), devLight)
writeFileSync(path.join(resources, 'crew-logo.svg'), mark())

writeFileSync(
  path.join(root, 'src/renderer/src/components/crew-mark.ts'),
  `export const MARK_WIDTH = ${MARK.width}\n\nexport const MARK_HEIGHT = ${MARK.height}\n\nexport const MARK_RADIUS = ${RADIUS}\n\nexport const MARK_CUT = ${RADIUS + GAP}\n\nexport const MARK_DISCS = [${MARK_DISCS.join(', ')}]\n`
)

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
  ['DARK_ICON', dark],
  ['LIGHT_ICON', light],
  ['DEV_DARK_ICON', devDark],
  ['DEV_LIGHT_ICON', devLight]
]) {
  const out = path.join(tmpdir(), `crew-icon-${key}.png`)
  raster(source, 512, out)
  embedded[key] = readFileSync(out).toString('base64')
  rmSync(out, { force: true })
}

writeFileSync(
  path.join(root, 'src/main/icon-png.ts'),
  Object.entries(embedded)
    .map(([name, data]) => `export const ${name} = '${data}'\n`)
    .join('\n')
)

console.log(
  'wrote resources/icon.svg, icon-light.svg, icon-dev.svg, icon-dev-light.svg, crew-logo.svg, icon.icns, icon.png, src/main/icon-png.ts and src/renderer/src/components/crew-mark.ts'
)
