import { measure } from './icon-geometry.mjs'

const U = [Math.SQRT1_2, -Math.SQRT1_2]
const V = [Math.SQRT1_2, Math.SQRT1_2]

const at = (a, b) => [12 + a * U[0] + b * V[0], 12 + a * U[1] + b * V[1]]

function plane({ tip, notch, back, span, cutTip, cutWing, cutNotch, shift }) {
  const T = at(tip, 0)
  const N = at(-notch, 0)
  const L = at(-back, -span)
  const B = at(-back, span)
  const pts = [T, L, N, B]
  const cuts = [cutTip, cutWing, cutNotch, cutWing]
  const out = []
  for (let i = 0; i < 4; i++) {
    const prev = pts[(i + 3) % 4]
    const next = pts[(i + 1) % 4]
    const here = pts[i]
    const to = p => {
      const d = [p[0] - here[0], p[1] - here[1]]
      const len = Math.hypot(d[0], d[1])
      return [here[0] + (d[0] / len) * cuts[i], here[1] + (d[1] / len) * cuts[i]]
    }
    out.push({ in: to(prev), v: here, out: to(next) })
  }
  const move = p => [p[0] - shift, p[1] + shift]
  const n = p => `${round(move(p)[0])} ${round(move(p)[1])}`
  const d =
    `M${n(out[0].out)}` +
    out
      .slice(1)
      .map(c => `L${n(c.in)}Q${n(c.v)} ${n(c.out)}`)
      .join('') +
    `L${n(out[0].in)}Q${n(out[0].v)} ${n(out[0].out)}Z`
  const creaseFrom = at(tip - cutTip - 0.55, 0)
  const crease = `M${n(creaseFrom)}L${n(N)}`
  return { d, crease }
}

const round = x => Math.round(x * 100) / 100

const arg = (name, fallback) => {
  const found = process.argv.find(a => a.startsWith(`--${name}=`))
  return found ? Number(found.split('=')[1]) : fallback
}

const spec = {
  tip: arg('tip', 14.72),
  notch: arg('notch', 1.51),
  back: arg('back', 5.1),
  span: arg('span', 9.63),
  cutTip: arg('cutTip', 2.56),
  cutWing: arg('cutWing', 1.92),
  cutNotch: arg('cutNotch', 1.6),
  shift: arg('shift', 0)
}

const { d, crease } = plane(spec)
const markup = `<path d="${d}"></path><path d="${crease}"></path>`
const box = measure(markup)
console.log(JSON.stringify(spec))
console.log('outline', d)
console.log('crease ', crease)
console.log(
  'box',
  `x ${round(box.x)}..${round(box.x + box.width)}`,
  `y ${round(box.y)}..${round(box.y + box.height)}`,
  `w ${round(box.width)} h ${round(box.height)}`,
  `centre ${round(box.cx)} ${round(box.cy)}`,
  `ink ${round(box.ink)}`,
  `round ${box.round}`,
  `bodyfill ${box.body ? round(box.body.area / (box.body.width * box.body.height)) : 'none'}`
)
