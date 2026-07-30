// The five pictures the app can wear behind its mark. The mark itself is the
// same three discs at the same size in every one of them, so a skin is a tile
// and nothing else: what it paints inside the tile, and the ink the discs take.
//
// Every scattered thing here is seeded rather than random. The generated files
// are committed, so a picture that came out differently on each run would churn
// the diff every time anybody touched the icon.

const rng = seed => {
  let state = 2166136261
  for (let at = 0; at < seed.length; at++) {
    state ^= seed.charCodeAt(at)
    state = Math.imul(state, 16777619)
  }
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return ((state >>> 0) % 100000) / 100000
  }
}

const round = value => Number(value.toFixed(2))

const between = (pick, low, high) => round(low + pick() * (high - low))

const ramp = list =>
  list
    .map(
      ([offset, colour, opacity]) =>
        `      <stop offset="${offset}" stop-color="${colour}" stop-opacity="${opacity}" />`
    )
    .join('\n')

const blur = (id, by) =>
  `    <filter id="${id}" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="${by}" />
    </filter>`

const glow = (id, colour, inner, outer = 0) =>
  `    <radialGradient id="${id}" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${colour}" stop-opacity="${inner}" />
      <stop offset="0.55" stop-color="${colour}" stop-opacity="${round(inner * 0.42)}" />
      <stop offset="1" stop-color="${colour}" stop-opacity="${outer}" />
    </radialGradient>`

const spot = ({ id, x, y, r, colour, at }) =>
  `    <radialGradient id="${id}" cx="${x}" cy="${y}" r="${r}" gradientUnits="userSpaceOnUse">
${ramp(at)}
    </radialGradient>`

// 8-BIT ----------------------------------------------------------------------
// A limited palette laid down one block at a time, and the ramp between two
// bands is dithered rather than blended: a smooth fade is the one thing a
// machine of that era could not draw, so it is the thing that would give it
// away. The frame is stepped for the same reason.

const BLOCKS = 12
const BIT_CORNER = 3
const BIT_BANDS = ['#7ff0ff', '#3fb4f5', '#2b6be0', '#2340b4', '#1a2478']
const BIT_SPARKS = ['#ff5fd0', '#ffe36b', '#ffffff']

const bitField = ({ TILE }) => {
  const block = TILE.size / BLOCKS
  const pick = rng('bit field')
  const rows = []
  for (let row = 0; row < BLOCKS; row++) {
    for (let col = 0; col < BLOCKS; col++) {
      // A diagonal ramp, so the light arrives from the upper left the way it
      // does on every other icon in the set.
      const depth = ((col + row) / (2 * (BLOCKS - 1))) * (BIT_BANDS.length - 1)
      const band = Math.floor(depth)
      const into = depth - band
      // On the boundary between two bands the checker decides which of the two
      // a block takes, which is what a dither is.
      const checker = (col + row) % 2 === 0 ? 0.34 : 0.66
      const index = Math.min(BIT_BANDS.length - 1, band + (into > checker ? 1 : 0))
      const spark = pick() > 0.965 ? BIT_SPARKS[Math.floor(pick() * BIT_SPARKS.length)] : null
      rows.push(
        `    <rect x="${round(TILE.x + col * block)}" y="${round(TILE.y + row * block)}" width="${round(block + 0.5)}" height="${round(block + 0.5)}" fill="${spark ?? BIT_BANDS[index]}"${spark ? ' opacity="0.9"' : ''} />`
      )
    }
  }
  return rows.join('\n')
}

// A frame one block wide, and its corners step rather than curve, which is the
// whole tell. It is the ring of blocks that are inside the stepped square with
// something outside next to them, worked out rather than listed: a list of
// insets closes the top and the bottom and leaves the two sides open.
const bitFrame = ({ TILE }) => {
  const block = TILE.size / BLOCKS
  const inside = (col, row) => {
    if (col < 0 || row < 0 || col >= BLOCKS || row >= BLOCKS) return false
    const across = Math.min(col, BLOCKS - 1 - col)
    const down = Math.min(row, BLOCKS - 1 - row)
    if (across >= BIT_CORNER || down >= BIT_CORNER) return true
    const out = BIT_CORNER - across - 0.5
    const up = BIT_CORNER - down - 0.5
    return out * out + up * up <= BIT_CORNER * BIT_CORNER
  }
  const runs = []
  for (let row = 0; row < BLOCKS; row++) {
    for (let col = 0; col < BLOCKS; col++) {
      const edge =
        inside(col, row) &&
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1]
        ].some(([dx, dy]) => !inside(col + dx, row + dy))
      if (!edge) continue
      runs.push(
        `    <rect x="${round(TILE.x + col * block)}" y="${round(TILE.y + row * block)}" width="${round(block + 0.5)}" height="${round(block + 0.5)}" />`
      )
    }
  }
  return runs.join('\n')
}

// SAKURA ---------------------------------------------------------------------
// A notched petal is what tells a cherry blossom from a daisy, and the twig is
// what tells a tree from a handful of pink dots.

const petalPath = r =>
  `M 0 0 C ${round(0.42 * r)} ${round(-0.14 * r)} ${round(0.54 * r)} ${round(-0.62 * r)} ${round(0.17 * r)} ${round(-0.95 * r)} L 0 ${round(-0.8 * r)} L ${round(-0.17 * r)} ${round(-0.95 * r)} C ${round(-0.54 * r)} ${round(-0.62 * r)} ${round(-0.42 * r)} ${round(-0.14 * r)} 0 0 Z`

const blossom = ({ x, y, r, turn, fill, edge, heart, soft }) => {
  const petals = [0, 1, 2, 3, 4]
    .map(
      index =>
        `      <path d="${petalPath(r)}" transform="rotate(${round(turn + index * 72)})" fill="${fill}" stroke="${edge}" stroke-width="${round(r * 0.045)}" />`
    )
    .join('\n')
  const stamen = [0, 1, 2, 3, 4]
    .map(index => {
      const angle = ((turn + 32 + index * 72) * Math.PI) / 180
      return `      <circle cx="${round(Math.sin(angle) * r * 0.3)}" cy="${round(-Math.cos(angle) * r * 0.3)}" r="${round(r * 0.055)}" fill="${heart}" />`
    })
    .join('\n')
  return `    <g transform="translate(${round(x)} ${round(y)})"${soft ? ` filter="url(#${soft})"` : ''}>
${petals}
      <circle cx="0" cy="0" r="${round(r * 0.13)}" fill="${heart}" />
${stamen}
    </g>`
}

const SAKURA_NEAR = { fill: '#ffb0cd', edge: '#ff8fb8', heart: '#ffdf8f' }
const SAKURA_MID = { fill: '#ffc6dc', edge: '#ffa8c6', heart: '#ffe6a8' }
// A thing further off is seen through more of whatever the sky is made of, so it
// takes the sky's colour on rather than carrying its own at full strength.
const SAKURA_FAR = { fill: '#dfcae6', edge: '#cfc0e0', heart: '#e8d6bf' }

const sakuraTwigs = () =>
  `    <g fill="none" stroke="#9a7360" stroke-linecap="round">
      <path d="M 100 806 C 236 774 300 700 352 612" stroke-width="17" />
      <path d="M 292 676 C 330 690 372 686 404 664" stroke-width="11" />
      <path d="M 924 246 C 846 258 792 300 758 352" stroke-width="14" />
    </g>`

const sakuraBlossoms = ({ CENTRE }) => {
  const pick = rng('sakura blossoms')
  const laid = [
    { x: 352, y: 606, r: 96, look: SAKURA_NEAR },
    { x: 404, y: 660, r: 66, look: SAKURA_MID },
    { x: 232, y: 772, r: 78, look: SAKURA_NEAR },
    { x: 754, y: 356, r: 100, look: SAKURA_NEAR },
    { x: 838, y: 256, r: 70, look: SAKURA_MID },
    { x: 214, y: 268, r: 112, look: SAKURA_FAR, soft: 'sakura-far' },
    { x: 806, y: 786, r: 122, look: SAKURA_FAR, soft: 'sakura-far' },
    { x: 560, y: 202, r: 58, look: SAKURA_MID, soft: 'sakura-mid' },
    { x: 470, y: 856, r: 62, look: SAKURA_MID, soft: 'sakura-mid' }
  ]
  const flowers = laid.map(({ x, y, r, look, soft }) =>
    blossom({ x, y, r, turn: between(pick, 0, 72), ...look, soft })
  )
  // Loose petals, which is what says the tree is dropping them.
  const drifting = [
    { x: 640, y: 760, r: 46, soft: null },
    { x: 316, y: 424, r: 38, soft: 'sakura-mid' },
    { x: 726, y: 606, r: 34, soft: null },
    { x: 452, y: 300, r: 42, soft: 'sakura-far' },
    { x: CENTRE + 44, y: 900, r: 30, soft: null }
  ].map(
    ({ x, y, r, soft }) =>
      `    <path d="${petalPath(r)}" transform="translate(${x} ${y}) rotate(${round(between(pick, -180, 180))})" fill="${soft ? SAKURA_MID.fill : SAKURA_NEAR.fill}" stroke="${SAKURA_NEAR.edge}" stroke-width="${round(r * 0.05)}"${soft ? ` filter="url(#${soft})"` : ''} />`
  )
  return [...flowers, ...drifting].join('\n')
}

// SPACE ----------------------------------------------------------------------

const SPACE_STARS = 46

const spaceStars = ({ TILE }) => {
  const pick = rng('space stars')
  const stars = []
  for (let index = 0; index < SPACE_STARS; index++) {
    const x = between(pick, TILE.x + 18, TILE.x + TILE.size - 18)
    const y = between(pick, TILE.y + 18, TILE.y + TILE.size - 18)
    const r = between(pick, 2.6, 7.4)
    stars.push(
      `    <circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" opacity="${between(pick, 0.28, 0.95)}" />`
    )
  }
  // A few carry the four points a bright one reads with, drawn rather than
  // blurred: a blurred dot is a smudge, and the points are the whole shape.
  const sparks = [
    { x: 268, y: 300, r: 46 },
    { x: 806, y: 402, r: 34 },
    { x: 342, y: 792, r: 38 },
    { x: 700, y: 828, r: 26 }
  ].map(
    ({ x, y, r }) =>
      `    <path d="M ${x} ${y - r} Q ${x + round(r * 0.14)} ${y - round(r * 0.14)} ${x + r} ${y} Q ${x + round(r * 0.14)} ${y + round(r * 0.14)} ${x} ${y + r} Q ${x - round(r * 0.14)} ${y + round(r * 0.14)} ${x - r} ${y} Q ${x - round(r * 0.14)} ${y - round(r * 0.14)} ${x} ${y - r} Z" fill="#ffffff" opacity="0.9" />`
  )
  return [...stars, ...sparks].join('\n')
}

// GRADIENT -------------------------------------------------------------------
// The mark's own mesh, laid out as a tile. Nothing here invents a palette: the
// colours are MESH_COLORS and the sky they stand on is the mark's own.

const MESH = [
  { colour: '#2dd4ff', x: 214, y: 236, r: 396 },
  { colour: '#a855f7', x: 706, y: 300, r: 372 },
  { colour: '#ff5d8f', x: 316, y: 806, r: 356 },
  { colour: '#ffb14a', x: 838, y: 810, r: 330 },
  { colour: '#ffffff', x: 880, y: 168, r: 176 }
]

// TERMINAL -------------------------------------------------------------------
// Phosphor on glass. The scanlines run over the mark rather than under it,
// because they are on the front of the tube and the mark is behind it.

const PHOSPHOR = '#4ade80'
const SCAN_STEP = 11
const SCAN_WEIGHT = 4

const scanlines = ({ TILE }) => {
  const lines = []
  for (let y = TILE.y; y < TILE.y + TILE.size; y += SCAN_STEP) {
    lines.push(
      `    <rect x="${TILE.x}" y="${round(y)}" width="${TILE.size}" height="${SCAN_WEIGHT}" />`
    )
  }
  return lines.join('\n')
}

// Nothing stands on the tube but the mark. A prompt and a run of code were drawn
// in behind it once, and they are the machinery of the joke rather than the joke:
// the phosphor, the scanlines and the bloom off the mark are what say terminal,
// and anything else in there is a second thing to read at 16 across.

export const SKINS = [
  {
    id: 'bit',
    ink: '#ffffff',
    tile: [
      ['#8f6dff', 1],
      ['#4a2bc4', 1],
      ['#231566', 1]
    ],
    rim: [
      ['#c9b4ff', 0.7],
      ['#ffffff', 0.06],
      ['#7f5bff', 0.34]
    ],
    sheen: 0.05,
    defs: () => glow('bit-lift', '#ffffff', 0.1),
    art: ctx => `${bitField(ctx)}
    <rect x="${ctx.TILE.x}" y="${ctx.TILE.y}" width="${ctx.TILE.size}" height="${ctx.TILE.size}" fill="url(#bit-lift)" />
    <g fill="#ffffff" opacity="0.13">
${bitFrame(ctx)}
    </g>`
  },
  {
    id: 'sakura',
    ink: '#ffffff',
    tile: [
      ['#9dc4ee', 1],
      ['#7ba2e0', 1],
      ['#5c81cf', 1]
    ],
    rim: [
      ['#ffffff', 0.82],
      ['#ffffff', 0.08],
      ['#4f70b8', 0.36]
    ],
    sheen: 0.16,
    defs: ctx => `${blur('sakura-far', 17)}
${blur('sakura-mid', 6)}
${spot({
  id: 'sakura-sun',
  x: ctx.TILE.x + ctx.TILE.size * 0.24,
  y: ctx.TILE.y + ctx.TILE.size * 0.16,
  r: ctx.TILE.size * 0.72,
  colour: '#ffffff',
  at: [
    [0, '#fff6e6', 0.44],
    [0.6, '#ffe9d6', 0.12],
    [1, '#ffe9d6', 0]
  ]
})}`,
    art: ctx => `    <rect x="${ctx.TILE.x}" y="${ctx.TILE.y}" width="${ctx.TILE.size}" height="${ctx.TILE.size}" fill="url(#sakura-sun)" />
${sakuraTwigs()}
${sakuraBlossoms(ctx)}`
  },
  {
    id: 'space',
    ink: '#ffffff',
    tile: [
      ['#232a6b', 1],
      ['#141748', 1],
      ['#08091f', 1]
    ],
    rim: [
      ['#b9c8ff', 0.6],
      ['#ffffff', 0.05],
      ['#5f6ecc', 0.3]
    ],
    sheen: 0.1,
    defs: ctx => `${blur('space-cloud', 46)}
${spot({
  id: 'space-violet',
  x: ctx.CENTRE - 130,
  y: ctx.CENTRE - 96,
  r: ctx.TILE.size * 0.56,
  colour: '#8b5cf6',
  at: [
    [0, '#b39bff', 0.66],
    [0.55, '#7c3aed', 0.3],
    [1, '#6d28d9', 0]
  ]
})}
${spot({
  id: 'space-cyan',
  x: ctx.CENTRE + 180,
  y: ctx.CENTRE + 168,
  r: ctx.TILE.size * 0.46,
  colour: '#38bdf8',
  at: [
    [0, '#67e8f9', 0.34],
    [0.6, '#0ea5e9', 0.14],
    [1, '#0284c7', 0]
  ]
})}
${glow('space-halo', '#c7d2fe', 0.24)}`,
    art: ctx => `    <g filter="url(#space-cloud)">
      <rect x="${ctx.TILE.x}" y="${ctx.TILE.y}" width="${ctx.TILE.size}" height="${ctx.TILE.size}" fill="url(#space-violet)" />
      <rect x="${ctx.TILE.x}" y="${ctx.TILE.y}" width="${ctx.TILE.size}" height="${ctx.TILE.size}" fill="url(#space-cyan)" />
    </g>
${spaceStars(ctx)}
    <rect x="${ctx.TILE.x}" y="${ctx.TILE.y}" width="${ctx.TILE.size}" height="${ctx.TILE.size}" fill="url(#space-halo)" />`
  },
  {
    id: 'gradient',
    ink: '#ffffff',
    tile: [
      ['#6b46e0', 1],
      ['#5a3fd6', 1],
      ['#3f2bb0', 1]
    ],
    rim: [
      ['#ffffff', 0.66],
      ['#ffffff', 0.07],
      ['#7c5cf0', 0.36]
    ],
    sheen: 0.12,
    defs: () => `${blur('mesh-soft', 58)}
${MESH.map(({ colour, x, y, r }, index) =>
  spot({
    id: `mesh-${index}`,
    x,
    y,
    r,
    colour,
    at: [
      [0, colour, index === MESH.length - 1 ? 0.6 : 0.92],
      [0.55, colour, index === MESH.length - 1 ? 0.2 : 0.42],
      [1, colour, 0]
    ]
  })
).join('\n')}`,
    art: ctx => `    <g filter="url(#mesh-soft)">
${MESH.map(
  (_, index) =>
    `      <rect x="${ctx.TILE.x - 60}" y="${ctx.TILE.y - 60}" width="${ctx.TILE.size + 120}" height="${ctx.TILE.size + 120}" fill="url(#mesh-${index})" />`
).join('\n')}
    </g>`
  },
  {
    id: 'terminal',
    ink: '#ffffff',
    tile: [
      ['#131d18', 1],
      ['#0a1210', 1],
      ['#050908', 1]
    ],
    rim: [
      ['#8ff0b4', 0.4],
      ['#ffffff', 0.05],
      ['#2f6b48', 0.34]
    ],
    sheen: 0.06,
    defs: ctx => `${blur('phosphor', 34)}
${spot({
  id: 'tube',
  x: ctx.CENTRE,
  y: ctx.CENTRE + 30,
  r: ctx.TILE.size * 0.62,
  colour: PHOSPHOR,
  at: [
    [0, PHOSPHOR, 0.3],
    [0.5, PHOSPHOR, 0.12],
    [1, PHOSPHOR, 0]
  ]
})}
    <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0.5" stop-color="#000000" stop-opacity="0" />
      <stop offset="1" stop-color="#000000" stop-opacity="0.5" />
    </radialGradient>`,
    art: ctx => `    <rect x="${ctx.TILE.x}" y="${ctx.TILE.y}" width="${ctx.TILE.size}" height="${ctx.TILE.size}" fill="url(#tube)" />
    <rect x="${ctx.TILE.x}" y="${ctx.TILE.y}" width="${ctx.TILE.size}" height="${ctx.TILE.size}" fill="url(#vignette)" />
    <g fill="${PHOSPHOR}" opacity="0.62" filter="url(#phosphor)">
${ctx.discs()}
    </g>`,
    over: ctx => `    <g fill="#000000" opacity="0.14">
${scanlines(ctx)}
    </g>`
  }
]
