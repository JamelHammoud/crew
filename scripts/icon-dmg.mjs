export const DMG = {
  width: 660,
  height: 400,
  iconSize: 128,
  line: 206,
  app: 172,
  applications: 488,
  headline: 78,
  chrome: 48,
  iconTextRoom: 22,
  at: 118
}

const INK = '#ffffff'

export const ARROW = { from: 252, to: 410, head: 13, sweep: 0.62, weight: 3.4, glide: 3.4 }

const round = value => Number(value.toFixed(3))

export const HEADLINE = `<text x="${DMG.width / 2}" y="${DMG.headline}" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system, &quot;SF Pro Display&quot;, &quot;SF Pro Text&quot;, sans-serif" font-size="27" font-weight="600" letter-spacing="-0.62" fill="${INK}" fill-opacity="0.96">Drag Crew into Applications</text>`

export const DMG_DEFS = `    <radialGradient id="clearing" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.06" />
      <stop offset="0.46" stop-color="#ffffff" stop-opacity="0.03" />
      <stop offset="0.78" stop-color="#ffffff" stop-opacity="0.01" />
      <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="shaft" x1="${ARROW.from}" y1="0" x2="${ARROW.to}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${INK}" stop-opacity="0" />
      <stop offset="0.34" stop-color="${INK}" stop-opacity="0.42" />
      <stop offset="1" stop-color="${INK}" stop-opacity="0.82" />
    </linearGradient>`

export const DMG_WASH = `  <ellipse cx="${DMG.width / 2}" cy="${DMG.line - 26}" rx="368" ry="196" fill="url(#clearing)" />`

export function arrowAt(where) {
  return round(ARROW.from + (ARROW.to - ARROW.from) * where)
}

export function dmgArrow(where = 1) {
  const tip = arrowAt(where)
  const back = round(ARROW.head * ARROW.sweep)
  return `  <g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="${ARROW.weight}">
    <line x1="${ARROW.from}" y1="${DMG.line}" x2="${round(tip - ARROW.weight / 2)}" y2="${DMG.line}" stroke="url(#shaft)" />
    <path d="M ${round(tip - ARROW.head)} ${round(DMG.line - back)} L ${tip} ${DMG.line} L ${round(tip - ARROW.head)} ${round(DMG.line + back)}" stroke="${INK}" stroke-opacity="0.82" />
  </g>`
}

export function dmgDefs() {
  return DMG_DEFS
}

export function dmgBackground(picture) {
  const ground = picture
    ? `  <image x="0" y="0" width="${DMG.width}" height="${DMG.height}" preserveAspectRatio="xMidYMid slice" href="data:image/png;base64,${picture}" />`
    : `  <rect x="0" y="0" width="${DMG.width}" height="${DMG.height}" fill="#d0d9ee" />`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${DMG.width}" height="${DMG.height}" viewBox="0 0 ${DMG.width} ${DMG.height}">
  <defs>
${dmgDefs()}
  </defs>
${ground}
${DMG_WASH}
${dmgArrow()}
  ${HEADLINE}
</svg>
`
}
