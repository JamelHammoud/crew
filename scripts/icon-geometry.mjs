// Flattens icon art into points, so an icon can be measured rather than
// squinted at. Two numbers come out of it: the box the art really occupies, and
// the ink it lays down. The box is what keeps a set aligned. The ink is what
// makes one icon look heavier than its neighbour at the same size.

const NUMBER = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi
const ARGS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 }

function tokenize(d) {
  const out = []
  const parts = d.match(/[a-z][^a-z]*/gi) ?? []
  for (const part of parts) {
    const code = part[0]
    const key = code.toUpperCase()
    const take = ARGS[key]
    if (take === undefined) continue
    if (take === 0) {
      out.push([code, []])
      continue
    }
    const nums = (part.slice(1).match(NUMBER) ?? []).map(Number)
    let first = true
    for (let at = 0; at + take <= nums.length; at += take) {
      // A moveto that repeats its arguments is a lineto, and nothing else is.
      const repeat = key === 'M' ? (code === 'm' ? 'l' : 'L') : code
      out.push([first ? code : repeat, nums.slice(at, at + take)])
      first = false
    }
  }
  return out
}

function arcPoints(x1, y1, rx, ry, deg, large, sweep, x2, y2, steps) {
  if (!rx || !ry) return [[x2, y2]]
  rx = Math.abs(rx)
  ry = Math.abs(ry)
  const phi = (deg * Math.PI) / 180
  const cos = Math.cos(phi)
  const sin = Math.sin(phi)
  const dx = (x1 - x2) / 2
  const dy = (y1 - y2) / 2
  const ax = cos * dx + sin * dy
  const ay = -sin * dx + cos * dy
  const check = (ax * ax) / (rx * rx) + (ay * ay) / (ry * ry)
  if (check > 1) {
    const grow = Math.sqrt(check)
    rx *= grow
    ry *= grow
  }
  const top = rx * rx * ry * ry - rx * rx * ay * ay - ry * ry * ax * ax
  const bottom = rx * rx * ay * ay + ry * ry * ax * ax
  const scale = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, top / bottom))
  const cxa = (scale * rx * ay) / ry
  const cya = (-scale * ry * ax) / rx
  const cx = cos * cxa - sin * cya + (x1 + x2) / 2
  const cy = sin * cxa + cos * cya + (y1 + y2) / 2
  const angle = (ux, uy, vx, vy) => {
    const dot = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy))
    const sign = ux * vy - uy * vx < 0 ? -1 : 1
    return sign * Math.acos(Math.min(1, Math.max(-1, dot)))
  }
  const sx = (ax - cxa) / rx
  const sy = (ay - cya) / ry
  const start = angle(1, 0, sx, sy)
  let span = angle(sx, sy, (-ax - cxa) / rx, (-ay - cya) / ry)
  if (!sweep && span > 0) span -= 2 * Math.PI
  if (sweep && span < 0) span += 2 * Math.PI
  const out = []
  const count = Math.max(4, Math.ceil((steps * Math.abs(span)) / (Math.PI / 2)))
  for (let step = 1; step <= count; step++) {
    const t = start + (span * step) / count
    out.push([
      cx + rx * cos * Math.cos(t) - ry * sin * Math.sin(t),
      cy + rx * sin * Math.cos(t) + ry * cos * Math.sin(t)
    ])
  }
  return out
}

function bezier(points, steps) {
  const out = []
  for (let step = 1; step <= steps; step++) {
    const t = step / steps
    const u = 1 - t
    if (points.length === 4) {
      const [a, b, c, e] = points
      out.push([
        u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * e[0],
        u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * e[1]
      ])
    } else {
      const [a, b, c] = points
      out.push([u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]])
    }
  }
  return out
}

// Every subpath comes back on its own, because a run of ink that stops and
// starts again elsewhere is not one line and must not be measured as one.
export function samplePath(d, steps = 16) {
  const runs = []
  let run = []
  let x = 0
  let y = 0
  let sx = 0
  let sy = 0
  let lastControl = null
  const close = () => {
    if (run.length > 1) runs.push(run)
    run = []
  }
  for (const [code, args] of tokenize(d)) {
    const key = code.toUpperCase()
    const rel = code !== key
    const at = (i) => (rel ? args[i] + x : args[i])
    const atY = (i) => (rel ? args[i] + y : args[i])
    if (key === 'M') {
      close()
      x = at(0)
      y = atY(1)
      sx = x
      sy = y
      run = [[x, y]]
      lastControl = null
      continue
    }
    if (key === 'Z') {
      if (run.length) run.push([sx, sy])
      x = sx
      y = sy
      close()
      lastControl = null
      continue
    }
    if (!run.length) run = [[x, y]]
    if (key === 'L') {
      x = at(0)
      y = atY(1)
      run.push([x, y])
      lastControl = null
    } else if (key === 'H') {
      x = rel ? args[0] + x : args[0]
      run.push([x, y])
      lastControl = null
    } else if (key === 'V') {
      y = rel ? args[0] + y : args[0]
      run.push([x, y])
      lastControl = null
    } else if (key === 'C' || key === 'S') {
      const c1 = key === 'C' ? [at(0), atY(1)] : [2 * x - (lastControl?.[0] ?? x), 2 * y - (lastControl?.[1] ?? y)]
      const c2 = key === 'C' ? [at(2), atY(3)] : [at(0), atY(1)]
      const end = key === 'C' ? [at(4), atY(5)] : [at(2), atY(3)]
      run.push(...bezier([[x, y], c1, c2, end], steps))
      lastControl = c2
      x = end[0]
      y = end[1]
    } else if (key === 'Q' || key === 'T') {
      const c1 = key === 'Q' ? [at(0), atY(1)] : [2 * x - (lastControl?.[0] ?? x), 2 * y - (lastControl?.[1] ?? y)]
      const end = key === 'Q' ? [at(2), atY(3)] : [at(0), atY(1)]
      run.push(...bezier([[x, y], c1, end], steps))
      lastControl = c1
      x = end[0]
      y = end[1]
    } else if (key === 'A') {
      const end = [rel ? args[5] + x : args[5], rel ? args[6] + y : args[6]]
      run.push(...arcPoints(x, y, args[0], args[1], args[2], args[3], args[4], end[0], end[1], steps))
      x = end[0]
      y = end[1]
      lastControl = null
    }
  }
  close()
  return runs
}

const rounded = (x, y, w, h, rx, ry) => {
  const a = Math.min(rx || ry || 0, w / 2)
  const b = Math.min(ry || rx || 0, h / 2)
  if (!a && !b) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`
  return [
    `M${x + a} ${y}H${x + w - a}`,
    `A${a} ${b} 0 0 1 ${x + w} ${y + b}`,
    `V${y + h - b}`,
    `A${a} ${b} 0 0 1 ${x + w - a} ${y + h}`,
    `H${x + a}`,
    `A${a} ${b} 0 0 1 ${x} ${y + h - b}`,
    `V${y + b}`,
    `A${a} ${b} 0 0 1 ${x + a} ${y}`,
    'Z'
  ].join('')
}

const num = (attrs, name, fallback = 0) => {
  const found = attrs.match(new RegExp(`\\b${name}="(-?[\\d.]+)"`))
  return found ? Number(found[1]) : fallback
}

// The art is authored as rects, circles and paths because that is what reads on
// the page. Measuring only wants points, so everything becomes a path first.
export function shapesOf(markup) {
  const out = []
  for (const [, tag, attrs] of markup.matchAll(/<(path|rect|circle|ellipse|line)\b([^>]*)>/g)) {
    const filled = /fill="(?!none)[^"]+"/.test(attrs)
    const own = attrs.match(/\bstroke-width="(-?[\d.]+)"/)
    const weight = /stroke="none"/.test(attrs) ? 0 : own ? Number(own[1]) : null
    let d = null
    if (tag === 'path') d = attrs.match(/\sd="([^"]+)"/)?.[1] ?? null
    else if (tag === 'rect')
      d = rounded(
        num(attrs, 'x'),
        num(attrs, 'y'),
        num(attrs, 'width'),
        num(attrs, 'height'),
        num(attrs, 'rx'),
        num(attrs, 'ry')
      )
    else if (tag === 'circle' || tag === 'ellipse') {
      const cx = num(attrs, 'cx')
      const cy = num(attrs, 'cy')
      const rx = tag === 'circle' ? num(attrs, 'r') : num(attrs, 'rx')
      const ry = tag === 'circle' ? num(attrs, 'r') : num(attrs, 'ry')
      d = `M${cx - rx} ${cy}A${rx} ${ry} 0 0 1 ${cx + rx} ${cy}A${rx} ${ry} 0 0 1 ${cx - rx} ${cy}Z`
    } else if (tag === 'line')
      d = `M${num(attrs, 'x1')} ${num(attrs, 'y1')}L${num(attrs, 'x2')} ${num(attrs, 'y2')}`
    if (d) out.push({ d, filled, weight })
  }
  return out
}

// A subpath that comes back to where it started encloses something, and a shape
// that encloses is measured on its box. One that does not is a run of line, and
// a line is measured on how far it reaches. Telling the two apart is the whole
// of it: grading a chevron against a square is how a set ends up reporting that
// everything in it is undersized.
const ENCLOSING = 12

export function measure(markup, stroke = 1.5) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let ink = 0
  let reach = 0
  let body = null
  for (const shape of shapesOf(markup)) {
    const weight = shape.weight === null ? stroke : shape.weight
    for (const run of samplePath(shape.d)) {
      let length = 0
      let area = 0
      let lo = [Infinity, Infinity]
      let hi = [-Infinity, -Infinity]
      for (let i = 0; i < run.length; i++) {
        const [x, y] = run[i]
        lo = [Math.min(lo[0], x), Math.min(lo[1], y)]
        hi = [Math.max(hi[0], x), Math.max(hi[1], y)]
        if (i) length += Math.hypot(x - run[i - 1][0], y - run[i - 1][1])
        const [nx, ny] = run[(i + 1) % run.length]
        area += x * ny - nx * y
      }
      minX = Math.min(minX, lo[0])
      minY = Math.min(minY, lo[1])
      maxX = Math.max(maxX, hi[0])
      maxY = Math.max(maxY, hi[1])
      ink += length * weight
      area = Math.abs(area / 2)
      if (shape.filled) ink += area
      const shut = Math.hypot(run[0][0] - run.at(-1)[0], run[0][1] - run.at(-1)[1]) < 0.01
      // How far this run gets from end to end, which is what a chevron, a plus
      // or a cross is really asking to be measured on.
      reach = Math.max(reach, Math.hypot(hi[0] - lo[0], hi[1] - lo[1]))
      if (shut && area >= ENCLOSING && area > (body?.area ?? 0))
        body = { area, width: hi[0] - lo[0], height: hi[1] - lo[1] }
    }
  }
  if (minX === Infinity) return null
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    // The centre of the art, which is what has to agree with the centre of the
    // box. A shape a quarter unit low reads low in every row it sits in.
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    ink,
    reach,
    // The largest thing the art encloses, and how round it is. A circle fills
    // 79% of its own box and a rectangle fills all of it, which is enough to
    // tell a ring from a panel without being told.
    body,
    round: body ? body.area / (body.width * body.height) < 0.88 : false
  }
}
