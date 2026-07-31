export const DMG = {
  width: 660,
  height: 400,
  iconSize: 128,
  line: 210,
  app: 172,
  applications: 488,
  headline: 84,
  cover: 'crew dmg 31'
}

export const DMG_COVERS = [
  'crew dmg 31',
  'crew dmg 19',
  'crew dmg 7',
  'crew dmg 24',
  'crew dmg 12',
  'crew dmg 3',
  'crew dmg 44',
  'crew dmg 58'
]

const INK = '#141414'

const TRAVELLING = [
  { x: 250, r: 3.5, o: 0.18 },
  { x: 278, r: 5.5, o: 0.27 },
  { x: 306, r: 8, o: 0.38 },
  { x: 336, r: 11, o: 0.54 }
]

const SETTLED = { count: 3, r: 14, last: 400, o: [0.7, 0.83, 0.95] }

const round = value => Number(value.toFixed(3))

export function dmgDiscs({ bite, step }) {
  const arriving = Array.from({ length: SETTLED.count }, (_, index) => ({
    x: round(SETTLED.last - (SETTLED.count - 1 - index) * SETTLED.r * step),
    r: SETTLED.r,
    o: SETTLED.o[index]
  }))
  const all = [...TRAVELLING, ...arriving]
  return all.map((disc, index) => ({
    ...disc,
    y: DMG.line,
    cut: all[index + 1] ? { x: all[index + 1].x, r: round(all[index + 1].r * (1 + bite)) } : null
  }))
}

export const HEADLINE = `<text x="${DMG.width / 2}" y="${DMG.headline}" text-anchor="middle" xml:space="preserve" font-family="ui-sans-serif, system-ui, -apple-system, &quot;SF Pro Text&quot;, sans-serif" font-size="16" font-weight="500" fill="${INK}" fill-opacity="0.8">Drag <tspan dy="1" font-family="&quot;SF Mono&quot;, Menlo, ui-monospace, monospace" font-size="14.5" font-weight="600">Crew</tspan><tspan dy="-1"> into Applications</tspan></text>`

export function dmgOverlay(geometry, prefix = 'bite') {
  const all = dmgDiscs(geometry)
  const masks = all
    .filter(disc => disc.cut)
    .map(
      (disc, index) => `    <mask id="${prefix}-${index}" maskUnits="userSpaceOnUse" x="0" y="0" width="${DMG.width}" height="${DMG.height}">
      <rect x="0" y="0" width="${DMG.width}" height="${DMG.height}" fill="#ffffff" />
      <circle cx="${disc.cut.x}" cy="${DMG.line}" r="${disc.cut.r}" fill="#000000" />
    </mask>`
    )
    .join('\n')
  const drawn = all
    .map(
      (disc, index) =>
        `  <circle cx="${disc.x}" cy="${disc.y}" r="${disc.r}" fill="${INK}" fill-opacity="${disc.o}"${disc.cut ? ` mask="url(#${prefix}-${index})"` : ''} />`
    )
    .join('\n')
  return { masks, drawn }
}

export const DMG_DEFS = `    <radialGradient id="clearing" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.17" />
      <stop offset="0.5" stop-color="#ffffff" stop-opacity="0.08" />
      <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="pool" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.14" />
      <stop offset="0.44" stop-color="#ffffff" stop-opacity="0.05" />
      <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
    </radialGradient>
    <filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.86" numOctaves="3" stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>`

export const DMG_WASH = `  <ellipse cx="${DMG.width / 2}" cy="196" rx="430" ry="168" fill="url(#clearing)" />
  <circle cx="${DMG.app}" cy="${DMG.line - 6}" r="132" fill="url(#pool)" />`

export const DMG_GRAIN = `  <rect x="0" y="0" width="${DMG.width}" height="${DMG.height}" filter="url(#grain)" opacity="0.05" />`

export function dmgBackground(geometry, cover) {
  const { masks, drawn } = dmgOverlay(geometry)
  const picture = cover
    ? `  <image x="0" y="0" width="${DMG.width}" height="${DMG.height}" preserveAspectRatio="xMidYMid slice" href="data:image/png;base64,${cover}" />`
    : `  <rect x="0" y="0" width="${DMG.width}" height="${DMG.height}" fill="#c9c3e4" />`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${DMG.width}" height="${DMG.height}" viewBox="0 0 ${DMG.width} ${DMG.height}">
  <defs>
${DMG_DEFS}
${masks}
  </defs>
${picture}
${DMG_WASH}
${drawn}
  ${HEADLINE}
${DMG_GRAIN}
</svg>
`
}
