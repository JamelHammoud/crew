export const DMG = {
  width: 660,
  height: 400,
  iconSize: 128,
  line: 210,
  app: 172,
  applications: 488,
  headline: 84,
  at: 27.4
}

const INK = '#141414'

export const TRAVEL = { from: 262, to: 400, radius: 12, glide: 3.8, wake: 96 }

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

export const HEADLINE = `<text x="${DMG.width / 2}" y="${DMG.headline}" text-anchor="middle" xml:space="preserve" font-family="ui-sans-serif, system-ui, -apple-system, &quot;SF Pro Text&quot;, sans-serif" font-size="16" font-weight="500" fill="${INK}" fill-opacity="0.78">Drag <tspan dy="1" font-family="&quot;SF Mono&quot;, Menlo, ui-monospace, monospace" font-size="14.5" font-weight="600">Crew</tspan><tspan dy="-1"> into Applications</tspan></text>`

export const DMG_DEFS = `    <radialGradient id="pool" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.16" />
      <stop offset="0.44" stop-color="#ffffff" stop-opacity="0.06" />
      <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="wake" x1="${TRAVEL.from - 40}" y1="0" x2="${TRAVEL.to}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0" />
      <stop offset="0.55" stop-color="#ffffff" stop-opacity="0.16" />
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.34" />
    </linearGradient>
    <filter id="haze" x="-45%" y="-200%" width="190%" height="500%" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation="9" />
    </filter>`

export const DMG_WASH = `  <circle cx="${DMG.app}" cy="${DMG.line - 6}" r="132" fill="url(#pool)" />`

export function trailAt(geometry, where) {
  const { mark } = markGroup(geometry, 'measure')
  const run = TRAVEL.to - TRAVEL.from
  const head = TRAVEL.from + run * where
  return { mark, head, run }
}

export function dmgOverlay(geometry, where = 0.62) {
  const { discs } = markGroup(geometry, 'mark')
  const { head } = trailAt(geometry, where)
  const ghosts = Array.from({ length: TRAVEL.ghosts }, (_, index) => {
    const back = (index + 1) / (TRAVEL.ghosts + 1)
    const at = head - back * 78
    const fade = round(0.2 * (1 - back) ** 1.5)
    return `  <g transform="translate(${round(at)} ${DMG.line}) scale(${round(1 - back * 0.26)})" fill="${INK}" fill-opacity="${fade}">
${discs}
  </g>`
  }).join('\n')
  return `  <ellipse cx="${round((TRAVEL.from + head) / 2)}" cy="${DMG.line}" rx="${round((head - TRAVEL.from) / 2 + 26)}" ry="13" fill="url(#wake)" filter="url(#haze)" />
${ghosts}
  <g transform="translate(${round(head)} ${DMG.line})" fill="${INK}" fill-opacity="0.94">
${discs}
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
