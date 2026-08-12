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
// A narrow range on purpose. Run the ramp from a near white to a near black and
// the mark stands on the pale end and vanishes, and the two ends read as two
// regions with a hard seam between them rather than as one lit field.
const BIT_BANDS = ['#6ee0ff', '#43b0f0', '#2f7ce0', '#2a55c8', '#2440a8']
const BIT_SPARKS = ['#ff5fd0', '#ffe36b', '#ffffff']

// The ordered dither every machine of that era used. A plain checker only ever
// mixes two blocks at the seam, so the seam is still a line; this spreads each
// boundary over sixteen blocks, which is what reads as one field.
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5]
]

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
      const threshold = BAYER[row % 4][col % 4] / 16
      const index = Math.min(BIT_BANDS.length - 1, band + (into > threshold ? 1 : 0))
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
  const flowers = laid.map(({ x, y, r, look, soft }) => blossom({ x, y, r, turn: between(pick, 0, 72), ...look, soft }))
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

// A field of even dots is a dark tile with dust on it. What makes one read as
// depth is that the stars are not all the same distance away: the far ones are
// small, dim and take the colour of whatever cloud they are behind, the near ones
// are bright and carry the four points a bright star reads with, and the whole
// field thins out where the cloud is brightest, the way a real one is washed out
// by what is in front of it.

const SPACE_DUST = 120
const SPACE_NEAR = 26

// How bright the cloud is at a point, which is what decides whether a star there
// survives. Two soft centres, the same two the nebula is painted from.
const cloudAt = (x, y, { CENTRE, TILE }) => {
  const one = Math.hypot(x - (CENTRE - 130), y - (CENTRE - 96)) / (TILE.size * 0.5)
  const two = Math.hypot(x - (CENTRE + 180), y - (CENTRE + 168)) / (TILE.size * 0.44)
  return Math.max(0, 1 - one) * 0.8 + Math.max(0, 1 - two) * 0.6
}

const spaceStars = ctx => {
  const { TILE } = ctx
  const pick = rng('space stars deep')
  const dust = []
  for (let index = 0; index < SPACE_DUST; index++) {
    const x = between(pick, TILE.x + 10, TILE.x + TILE.size - 10)
    const y = between(pick, TILE.y + 10, TILE.y + TILE.size - 10)
    const washed = cloudAt(x, y, ctx)
    if (pick() < washed * 0.75) continue
    const r = between(pick, 1.6, 3.4)
    dust.push(
      `    <circle cx="${x}" cy="${y}" r="${r}" fill="#cfd8ff" opacity="${round(between(pick, 0.2, 0.55) * (1 - washed * 0.5))}" />`
    )
  }
  const near = []
  for (let index = 0; index < SPACE_NEAR; index++) {
    const x = between(pick, TILE.x + 16, TILE.x + TILE.size - 16)
    const y = between(pick, TILE.y + 16, TILE.y + TILE.size - 16)
    const r = between(pick, 4, 8.4)
    const lit = round(between(pick, 0.7, 1) * (1 - cloudAt(x, y, ctx) * 0.35))
    near.push(
      `    <circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" opacity="${lit}" />
    <circle cx="${x}" cy="${y}" r="${round(r * 3.4)}" fill="url(#star-halo)" opacity="${round(lit * 0.5)}" />`
    )
  }
  // The four points a bright star reads with, drawn rather than blurred: a
  // blurred dot is a smudge, and the points are the whole shape. Each one is
  // turned off the grid, or four crosses all square to the tile read as a
  // pattern rather than as stars.
  const sparks = [
    { x: 262, y: 288, r: 54, turn: 0 },
    { x: 812, y: 396, r: 40, turn: 18 },
    { x: 336, y: 800, r: 46, turn: -14 },
    { x: 706, y: 838, r: 30, turn: 8 },
    { x: 596, y: 196, r: 34, turn: 24 }
  ].map(({ x, y, r, turn }) => {
    const waist = round(r * 0.11)
    return `    <g transform="translate(${x} ${y}) rotate(${turn})">
      <path d="M 0 ${-r} Q ${waist} ${-waist} ${r} 0 Q ${waist} ${waist} 0 ${r} Q ${-waist} ${waist} ${-r} 0 Q ${-waist} ${-waist} 0 ${-r} Z" fill="#ffffff" />
      <circle cx="0" cy="0" r="${round(r * 2.6)}" fill="url(#star-halo)" opacity="0.7" />
    </g>`
  })
  return [...dust, ...near, ...sparks].join('\n')
}

// GRADIENT -------------------------------------------------------------------
// A real generated cover rather than a drawing of one: the same shader the music
// is photographed with, so this tile is a petal held up to the lens and has the
// depth of field, the sky and the bloom that come with that. A mesh of blurred
// blobs was what it was before, and gradients average, so nothing in it was ever
// in front of anything else.
//
// COVER_SEED is the picture. It is not a label: the shader works the whole scene
// and its palette out from these exact characters, so rewording it draws a
// different cover. Change it only by looking at what comes back.
export const COVER_SEED = 'crew icon 71'

// TERMINAL -------------------------------------------------------------------
// Phosphor on glass. The scanlines run over the mark rather than under it,
// because they are on the front of the tube and the mark is behind it.

const PHOSPHOR = '#4ade80'
const SCAN_STEP = 11
const SCAN_WEIGHT = 4

const scanlines = ({ TILE }) => {
  const lines = []
  for (let y = TILE.y; y < TILE.y + TILE.size; y += SCAN_STEP) {
    lines.push(`    <rect x="${TILE.x}" y="${round(y)}" width="${TILE.size}" height="${SCAN_WEIGHT}" />`)
  }
  return lines.join('\n')
}

// Code above the mark and code below it, and the band the discs stand in is left
// empty. A run of bars all one colour at one indent is a list; what makes a
// screen read as code is that the lines step in and out and that the tokens on
// them are not all the same colour, so this is written as tokens with an indent
// each. The prompt and the cursor are the one literal terminal thing on it, and
// they sit on the last line, where a live one is.

const TOKENS = {
  keyword: ['#c084fc', 0.85],
  name: ['#67e8f9', 0.8],
  string: [PHOSPHOR, 0.8],
  number: ['#fbbf24', 0.75],
  quiet: ['#5c8f75', 0.7]
}

const CODE_LEFT = 208
const CODE_STEP = 62
const CODE_INDENT = 58
const CODE_WEIGHT = 26
const CODE_GAP = 20

// Every line is an indent and a run of tokens, each token a width, so the shape
// of the block is the shape of real code rather than a row of equal bars.
const CODE = [
  {
    y: 176,
    indent: 0,
    run: [
      ['keyword', 86],
      ['name', 118],
      ['quiet', 34]
    ]
  },
  {
    y: 176 + CODE_STEP,
    indent: 1,
    run: [
      ['name', 74],
      ['string', 152]
    ]
  },
  {
    y: 176 + CODE_STEP * 2,
    indent: 1,
    run: [
      ['keyword', 60],
      ['number', 46],
      ['quiet', 88]
    ]
  },
  {
    y: 692,
    indent: 1,
    run: [
      ['name', 104],
      ['string', 74]
    ]
  },
  { y: 692 + CODE_STEP, indent: 0, run: [['quiet', 40]] }
]

const PROMPT = { y: 692 + CODE_STEP * 2, indent: 0 }

const terminalCode = () => {
  const lines = CODE.map(({ y, indent, run }) => {
    let at = CODE_LEFT + indent * CODE_INDENT
    return run
      .map(([token, width]) => {
        const [colour, alpha] = TOKENS[token]
        const bar = `    <rect x="${at}" y="${y}" width="${width}" height="${CODE_WEIGHT}" rx="${CODE_WEIGHT / 2}" fill="${colour}" opacity="${alpha}" />`
        at += width + CODE_GAP
        return bar
      })
      .join('\n')
  })
  const chevron = `    <path d="M ${CODE_LEFT} ${PROMPT.y - 12} L ${CODE_LEFT + 34} ${PROMPT.y + 13} L ${CODE_LEFT} ${PROMPT.y + 38}" fill="none" stroke="${PHOSPHOR}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" opacity="0.9" />`
  const cursor = `    <rect x="${CODE_LEFT + 62}" y="${PROMPT.y - 14}" width="34" height="54" rx="5" fill="${PHOSPHOR}" opacity="0.9" />`
  return [...lines, chevron, cursor].join('\n')
}

export const SKINS = [
  {
    id: 'bit',
    ink: '#ffffff',
    tile: [
      ['#6ee0ff', 1],
      ['#2f7ce0', 1],
      ['#2440a8', 1]
    ],
    rim: [
      ['#b4ecff', 0.7],
      ['#ffffff', 0.06],
      ['#3f6ff0', 0.34]
    ],
    sheen: 0.05,
    defs: () => glow('bit-lift', '#ffffff', 0.1),
    art: ctx => `${bitField(ctx)}
    <rect x="${ctx.TILE.x}" y="${ctx.TILE.y}" width="${ctx.TILE.size}" height="${ctx.TILE.size}" fill="url(#bit-lift)" />
    <g fill="#ffffff" opacity="0.28">
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
    [0, '#67e8f9', 0.46],
    [0.6, '#0ea5e9', 0.2],
    [1, '#0284c7', 0]
  ]
})}
${spot({
  id: 'space-rose',
  x: ctx.CENTRE + 250,
  y: ctx.CENTRE - 270,
  r: ctx.TILE.size * 0.36,
  colour: '#f472b6',
  at: [
    [0, '#f9a8d4', 0.34],
    [0.6, '#ec4899', 0.12],
    [1, '#db2777', 0]
  ]
})}
${glow('space-halo', '#c7d2fe', 0.2)}
${glow('star-halo', '#dbe4ff', 0.5)}
${blur('space-veil', 15)}`,
    // The cloud is laid down blurriest first, so what is furthest off is softest,
    // and the veil over the top is the one thin filament in front of all of it.
    art: ctx => `    <g filter="url(#space-cloud)">
      <rect x="${ctx.TILE.x}" y="${ctx.TILE.y}" width="${ctx.TILE.size}" height="${ctx.TILE.size}" fill="url(#space-violet)" />
      <rect x="${ctx.TILE.x}" y="${ctx.TILE.y}" width="${ctx.TILE.size}" height="${ctx.TILE.size}" fill="url(#space-cyan)" />
      <rect x="${ctx.TILE.x}" y="${ctx.TILE.y}" width="${ctx.TILE.size}" height="${ctx.TILE.size}" fill="url(#space-rose)" />
    </g>
    <g filter="url(#space-veil)" opacity="0.5">
      <path d="M ${ctx.TILE.x - 40} ${ctx.CENTRE + 210} C ${ctx.CENTRE - 210} ${ctx.CENTRE + 40} ${ctx.CENTRE + 120} ${ctx.CENTRE - 30} ${ctx.TILE.x + ctx.TILE.size + 40} ${ctx.TILE.y + 120}" fill="none" stroke="url(#space-violet)" stroke-width="150" />
    </g>
${spaceStars(ctx)}
    <rect x="${ctx.TILE.x}" y="${ctx.TILE.y}" width="${ctx.TILE.size}" height="${ctx.TILE.size}" fill="url(#space-halo)" />`
  },
  {
    id: 'gradient',
    ink: '#ffffff',
    cover: COVER_SEED,
    // The picture covers the tile, so the gradient under it is only what shows
    // for the frame of a paint before the photograph has landed.
    tile: [
      ['#ffb0b8', 1],
      ['#ff8f9f', 1],
      ['#f77a92', 1]
    ],
    // A light tile, so the rim is the light one: white where the light arrives
    // and the picture's own colour in shade where it leaves.
    rim: [
      ['#ffffff', 0.92],
      ['#ffffff', 0.06],
      ['#c05a72', 0.2]
    ],
    sheen: 0.1,
    art: ctx =>
      `    <image x="${ctx.TILE.x}" y="${ctx.TILE.y}" width="${ctx.TILE.size}" height="${ctx.TILE.size}" preserveAspectRatio="xMidYMid slice" href="data:image/png;base64,${ctx.cover}" />`
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
${terminalCode()}
    <rect x="${ctx.TILE.x}" y="${ctx.TILE.y}" width="${ctx.TILE.size}" height="${ctx.TILE.size}" fill="url(#vignette)" />
    <g fill="${PHOSPHOR}" opacity="0.44" filter="url(#phosphor)">
${ctx.discs()}
    </g>`,
    over: ctx => `    <g fill="#000000" opacity="0.14">
${scanlines(ctx)}
    </g>`
  }
]
