export const DMG = {
  width: 660,
  height: 400,
  iconSize: 128,
  line: 200,
  app: 172,
  applications: 488,
  headline: 80
}

const INK = '#141414'

const SKY = [
  { color: '#2dd4ff', x: 150, y: 104, r: 216, o: 0.95 },
  { color: '#a855f7', x: 246, y: 306, r: 226, o: 0.8 },
  { color: '#ff5d8f', x: 54, y: 226, r: 168, o: 0.62 },
  { color: '#ffb14a', x: 512, y: 58, r: 182, o: 0.5 }
]

const TRAVELLING = [
  { x: 250, r: 3.5, o: 0.2 },
  { x: 278, r: 5.5, o: 0.3 },
  { x: 306, r: 8, o: 0.42 },
  { x: 336, r: 11, o: 0.58 }
]

const SETTLED = { count: 3, r: 14, last: 400, o: [0.72, 0.85, 0.97] }

const round = value => Number(value.toFixed(3))

function discs({ bite, step }) {
  const arriving = Array.from({ length: SETTLED.count }, (_, index) => ({
    x: round(SETTLED.last - (SETTLED.count - 1 - index) * SETTLED.r * step),
    r: SETTLED.r,
    o: SETTLED.o[index]
  }))
  const all = [...TRAVELLING, ...arriving]
  return all.map((disc, index) => ({ ...disc, cut: all[index + 1], bite }))
}

function trail(geometry) {
  const all = discs(geometry)
  const masks = all
    .filter(disc => disc.cut)
    .map(
      (disc, index) => `    <mask id="bite-${index}" maskUnits="userSpaceOnUse" x="0" y="0" width="${DMG.width}" height="${DMG.height}">
      <rect x="0" y="0" width="${DMG.width}" height="${DMG.height}" fill="#ffffff" />
      <circle cx="${disc.cut.x}" cy="${DMG.line}" r="${round(disc.cut.r * (1 + disc.bite))}" fill="#000000" />
    </mask>`
    )
    .join('\n')
  const drawn = all
    .map(
      (disc, index) =>
        `    <circle cx="${disc.x}" cy="${DMG.line}" r="${disc.r}" fill="#ffffff" fill-opacity="${disc.o}"${disc.cut ? ` mask="url(#bite-${index})"` : ''} />`
    )
    .join('\n')
  return { masks, drawn }
}

export function dmgBackground(geometry) {
  const { masks, drawn } = trail(geometry)
  const sky = SKY.map(
    (blob, index) => `    <radialGradient id="sky-${index}" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${blob.color}" stop-opacity="${blob.o}" />
      <stop offset="0.55" stop-color="${blob.color}" stop-opacity="${round(blob.o * 0.34)}" />
      <stop offset="1" stop-color="${blob.color}" stop-opacity="0" />
    </radialGradient>`
  ).join('\n')
  const blobs = SKY.map(
    (blob, index) =>
      `    <circle cx="${blob.x}" cy="${blob.y}" r="${blob.r}" fill="url(#sky-${index})" />`
  ).join('\n')
  const headline = `<text x="${DMG.width / 2}" y="${DMG.headline}" text-anchor="middle" xml:space="preserve" font-family="ui-sans-serif, system-ui, -apple-system, &quot;SF Pro Text&quot;, sans-serif" font-size="16" font-weight="500" fill="#ffffff" fill-opacity="0.66">Drag <tspan dy="1" font-family="ui-monospace, &quot;SF Mono&quot;, Menlo, monospace" font-size="15">Crew</tspan><tspan dy="-1"> into Applications</tspan></text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${DMG.width}" height="${DMG.height}" viewBox="0 0 ${DMG.width} ${DMG.height}">
  <defs>
${sky}
    <filter id="drift" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.0055 0.0092" numOctaves="4" seed="7" result="field" />
      <feDisplacementMap in="SourceGraphic" in2="field" scale="178" xChannelSelector="R" yChannelSelector="G" />
      <feGaussianBlur stdDeviation="13" />
    </filter>
    <radialGradient id="vignette" cx="0.448" cy="0.44" r="0.78">
      <stop offset="0" stop-color="#0a0a0b" stop-opacity="0" />
      <stop offset="0.52" stop-color="#0a0a0b" stop-opacity="0.3" />
      <stop offset="1" stop-color="#08080a" stop-opacity="0.94" />
    </radialGradient>
    <linearGradient id="settle" x1="${DMG.width * 0.4}" y1="0" x2="${DMG.width}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0b0b0c" stop-opacity="0" />
      <stop offset="1" stop-color="#0b0b0c" stop-opacity="0.42" />
    </linearGradient>
    <radialGradient id="pool" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.11" />
      <stop offset="0.46" stop-color="#ffffff" stop-opacity="0.035" />
      <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="run" x1="248" y1="0" x2="432" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0" />
      <stop offset="0.58" stop-color="#ffffff" stop-opacity="0.05" />
      <stop offset="0.9" stop-color="#ffffff" stop-opacity="0.19" />
      <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
    </linearGradient>
    <radialGradient id="landing" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.17" />
      <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
    </radialGradient>
    <filter id="soften" x="-40%" y="-160%" width="180%" height="420%" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation="11" />
    </filter>
    <filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.86" numOctaves="3" stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
${masks}
  </defs>
  <rect x="0" y="0" width="${DMG.width}" height="${DMG.height}" fill="${INK}" />
  <g filter="url(#drift)" opacity="0.32">
${blobs}
  </g>
  <rect x="0" y="0" width="${DMG.width}" height="${DMG.height}" fill="url(#vignette)" />
  <rect x="0" y="0" width="${DMG.width}" height="${DMG.height}" fill="url(#settle)" />
  <circle cx="${DMG.app}" cy="${DMG.line - 8}" r="152" fill="url(#pool)" />
  <ellipse cx="340" cy="${DMG.line}" rx="96" ry="15" fill="url(#run)" filter="url(#soften)" />
  <circle cx="${SETTLED.last}" cy="${DMG.line}" r="46" fill="url(#landing)" />
${drawn}
  ${headline}
  <rect x="0" y="0" width="${DMG.width}" height="${DMG.height}" filter="url(#grain)" opacity="0.038" />
</svg>
`
}
