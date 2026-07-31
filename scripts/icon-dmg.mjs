export const DMG = {
  width: 660,
  height: 400,
  iconSize: 128,
  line: 210,
  app: 172,
  applications: 488,
  headline: 84,
  chrome: 48,
  at: 61
}

const INK = '#141414'

export const TRAVEL = { from: 214, to: 446, radius: 12, glide: 3.8, wake: 96, still: 0.66 }

const round = value => Number(value.toFixed(3))

export function dmgMark({ bite, step }, radius = TRAVEL.radius) {
  const gap = radius * step
  const centres = [-gap, 0, gap]
  return {
    radius,
    cut: round(radius * (1 + bite)),
    centres: centres.map(round),
    width: round(gap * 2 + radius * 2)
  }
}

export function markGroup(geometry, id, radius = TRAVEL.radius) {
  const mark = dmgMark(geometry, radius)
  const masks = mark.centres
    .slice(0, -1)
    .map(
      (_, index) => `    <mask id="${id}-cut-${index}" maskUnits="userSpaceOnUse" x="-80" y="-40" width="160" height="80">
      <rect x="-80" y="-40" width="160" height="80" fill="#ffffff" />
      <circle cx="${mark.centres[index + 1]}" cy="0" r="${mark.cut}" fill="#000000" />
    </mask>`
    )
    .join('\n')
  const discs = mark.centres
    .map(
      (cx, index) =>
        `    <circle cx="${cx}" cy="0" r="${mark.radius}"${index < mark.centres.length - 1 ? ` mask="url(#${id}-cut-${index})"` : ''} />`
    )
    .join('\n')
  return { mark, masks, discs }
}

export const HEADLINE = `<text x="${DMG.width / 2}" y="${DMG.headline}" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system, &quot;SF Pro Text&quot;, sans-serif" font-size="21" font-weight="500" letter-spacing="-0.2" fill="${INK}" fill-opacity="0.8">Drag Crew into Applications</text>`

export const DMG_DEFS = `    <radialGradient id="pool" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.16" />
      <stop offset="0.44" stop-color="#ffffff" stop-opacity="0.06" />
      <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="wake" x1="${-TRAVEL.wake}" y1="0" x2="0" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${INK}" stop-opacity="0" />
      <stop offset="0.62" stop-color="${INK}" stop-opacity="0.07" />
      <stop offset="1" stop-color="${INK}" stop-opacity="0.2" />
    </linearGradient>
    <filter id="haze" x="-30%" y="-180%" width="160%" height="460%" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation="3.4" />
    </filter>`

export const DMG_WASH = `  <circle cx="${DMG.app}" cy="${DMG.line - 6}" r="132" fill="url(#pool)" />`

export function wakePath(geometry) {
  const { mark } = markGroup(geometry, 'measure')
  const nose = -mark.width / 2 + mark.radius * 0.4
  const tail = -TRAVEL.wake
  const lift = round(mark.radius * 0.92)
  const bend = round(tail * 0.34)
  return `M ${tail} 0 C ${round(bend)} ${-lift * 0.72} ${round(nose * 1.5)} ${-lift} ${round(nose)} ${-lift} L ${round(nose)} ${lift} C ${round(nose * 1.5)} ${lift} ${round(bend)} ${lift * 0.72} ${tail} 0 Z`
}

export function markAt(where) {
  return round(TRAVEL.from + (TRAVEL.to - TRAVEL.from) * where)
}

export function dmgOverlay(geometry, where = TRAVEL.still) {
  const { discs } = markGroup(geometry, 'mark')
  const head = markAt(where)
  return `  <g transform="translate(${head} ${DMG.line})">
    <path d="${wakePath(geometry)}" fill="url(#wake)" filter="url(#haze)" />
    <g fill="${INK}" fill-opacity="0.93">
${discs}
    </g>
  </g>`
}

export function dmgDefs(geometry) {
  return `${DMG_DEFS}\n${markGroup(geometry, 'mark').masks}`
}

export function dmgBackground(geometry, picture) {
  const ground = picture
    ? `  <image x="0" y="0" width="${DMG.width}" height="${DMG.height}" preserveAspectRatio="xMidYMid slice" href="data:image/png;base64,${picture}" />`
    : `  <rect x="0" y="0" width="${DMG.width}" height="${DMG.height}" fill="#d0d9ee" />`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${DMG.width}" height="${DMG.height}" viewBox="0 0 ${DMG.width} ${DMG.height}">
  <defs>
${dmgDefs(geometry)}
  </defs>
${ground}
${DMG_WASH}
${dmgOverlay(geometry)}
  ${HEADLINE}
</svg>
`
}
