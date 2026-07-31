import { clamp, toFixed } from './utils'

export interface VecModel {
  x: number
  y: number
  z?: number
}

export type VecLike = Vec | VecModel

export class Vec {
  constructor(
    public x = 0,
    public y = 0,
    public z = 1
  ) {}

  get pressure(): number {
    return this.z
  }

  set(x = this.x, y = this.y, z = this.z): this {
    this.x = x
    this.y = y
    this.z = z
    return this
  }

  setTo({ x = 0, y = 0, z = 1 }: VecLike): this {
    this.x = x
    this.y = y
    this.z = z
    return this
  }

  clone(): Vec {
    const { x, y, z } = this
    return new Vec(x, y, z)
  }

  rot(r: number): this {
    if (r === 0) return this
    const { x, y } = this
    const s = Math.sin(r)
    const c = Math.cos(r)
    this.x = x * c - y * s
    this.y = x * s + y * c
    return this
  }

  rotWith(c: VecLike, r: number): this {
    if (r === 0) return this
    const x = this.x - c.x
    const y = this.y - c.y
    const s = Math.sin(r)
    const k = Math.cos(r)
    this.x = c.x + (x * k - y * s)
    this.y = c.y + (x * s + y * k)
    return this
  }

  sub(v: VecLike): this {
    this.x -= v.x
    this.y -= v.y
    return this
  }

  subXY(x: number, y: number): this {
    this.x -= x
    this.y -= y
    return this
  }

  subScalar(n: number): this {
    this.x -= n
    this.y -= n
    return this
  }

  add(v: VecLike): this {
    this.x += v.x
    this.y += v.y
    return this
  }

  addXY(x: number, y: number): this {
    this.x += x
    this.y += y
    return this
  }

  addScalar(n: number): this {
    this.x += n
    this.y += n
    return this
  }

  clamp(min: number, max?: number): this {
    this.x = Math.max(this.x, min)
    this.y = Math.max(this.y, min)
    if (max !== undefined) {
      this.x = Math.min(this.x, max)
      this.y = Math.min(this.y, max)
    }
    return this
  }

  div(t: number): this {
    this.x /= t
    this.y /= t
    return this
  }

  divV(v: VecLike): this {
    this.x /= v.x
    this.y /= v.y
    return this
  }

  mul(t: number): this {
    this.x *= t
    this.y *= t
    return this
  }

  mulV(v: VecLike): this {
    this.x *= v.x
    this.y *= v.y
    return this
  }

  abs(): this {
    this.x = Math.abs(this.x)
    this.y = Math.abs(this.y)
    return this
  }

  neg(): this {
    this.x *= -1
    this.y *= -1
    return this
  }

  per(): this {
    const { x, y } = this
    this.x = y
    this.y = -x
    return this
  }

  uni(): this {
    const l = this.len()
    if (l === 0) return this
    this.x /= l
    this.y /= l
    return this
  }

  tan(v: VecLike): this {
    return this.sub(v).uni()
  }

  nudge(b: VecLike, distance: number): this {
    return this.add(Vec.Tan(b, this).mul(distance))
  }

  lrp(b: VecLike, t: number): this {
    this.x = this.x + (b.x - this.x) * t
    this.y = this.y + (b.y - this.y) * t
    return this
  }

  snapToGrid(gridSize: number): this {
    this.x = Math.round(this.x / gridSize) * gridSize
    this.y = Math.round(this.y / gridSize) * gridSize
    return this
  }

  toFixed(): this {
    this.x = toFixed(this.x)
    this.y = toFixed(this.y)
    return this
  }

  dpr(v: VecLike): number {
    return Vec.Dpr(this, v)
  }

  cpr(v: VecLike): number {
    return Vec.Cpr(this, v)
  }

  pry(v: VecLike): number {
    return Vec.Pry(this, v)
  }

  len2(): number {
    return Vec.Len2(this)
  }

  len(): number {
    return Vec.Len(this)
  }

  dist(v: VecLike): number {
    return Vec.Dist(this, v)
  }

  dist2(v: VecLike): number {
    return Vec.Dist2(this, v)
  }

  distanceToLineSegment(a: VecLike, b: VecLike): number {
    return Vec.DistanceToLineSegment(a, b, this)
  }

  angle(b: VecLike): number {
    return Vec.Angle(this, b)
  }

  toAngle(): number {
    return Vec.ToAngle(this)
  }

  equals(b: VecLike): boolean {
    return Vec.Equals(this, b)
  }

  equalsXY(x: number, y: number): boolean {
    return Vec.EqualsXY(this, x, y)
  }

  toArray(): number[] {
    return Vec.ToArray(this)
  }

  toString(): string {
    return Vec.ToString(Vec.ToFixed(this))
  }

  static From({ x, y, z = 1 }: VecModel): Vec {
    return new Vec(x, y, z)
  }

  static FromArray(v: number[]): Vec {
    return new Vec(v[0], v[1])
  }

  static FromAngle(r: number, length = 1): Vec {
    return new Vec(Math.cos(r) * length, Math.sin(r) * length)
  }

  static Cast(a: VecLike): Vec {
    if (a instanceof Vec) return a
    return Vec.From(a)
  }

  static Add(a: VecLike, b: VecLike): Vec {
    return new Vec(a.x + b.x, a.y + b.y)
  }

  static AddXY(a: VecLike, x: number, y: number): Vec {
    return new Vec(a.x + x, a.y + y)
  }

  static AddScalar(a: VecLike, n: number): Vec {
    return new Vec(a.x + n, a.y + n)
  }

  static Sub(a: VecLike, b: VecLike): Vec {
    return new Vec(a.x - b.x, a.y - b.y)
  }

  static SubXY(a: VecLike, x: number, y: number): Vec {
    return new Vec(a.x - x, a.y - y)
  }

  static SubScalar(a: VecLike, n: number): Vec {
    return new Vec(a.x - n, a.y - n)
  }

  static Div(a: VecLike, t: number): Vec {
    return new Vec(a.x / t, a.y / t)
  }

  static DivV(a: VecLike, b: VecLike): Vec {
    return new Vec(a.x / b.x, a.y / b.y)
  }

  static Mul(a: VecLike, t: number): Vec {
    return new Vec(a.x * t, a.y * t)
  }

  static MulV(a: VecLike, b: VecLike): Vec {
    return new Vec(a.x * b.x, a.y * b.y)
  }

  static Neg(a: VecLike): Vec {
    return new Vec(-a.x, -a.y)
  }

  static Abs(a: VecLike): Vec {
    return new Vec(Math.abs(a.x), Math.abs(a.y))
  }

  static Per(a: VecLike): Vec {
    return new Vec(a.y, -a.x)
  }

  static Min(a: VecLike, b: VecLike): Vec {
    return new Vec(Math.min(a.x, b.x), Math.min(a.y, b.y))
  }

  static Max(a: VecLike, b: VecLike): Vec {
    return new Vec(Math.max(a.x, b.x), Math.max(a.y, b.y))
  }

  static Med(a: VecLike, b: VecLike): Vec {
    return new Vec((a.x + b.x) / 2, (a.y + b.y) / 2)
  }

  static Average(arr: VecLike[]): Vec {
    const len = arr.length
    const avg = new Vec(0, 0)
    if (len === 0) return avg
    for (let i = 0; i < len; i++) {
      avg.add(arr[i])
    }
    return avg.div(len)
  }

  static Clamp(a: VecLike, min: number, max?: number): Vec {
    if (max === undefined) {
      return new Vec(Math.max(a.x, min), Math.max(a.y, min))
    }
    return new Vec(clamp(a.x, min, max), clamp(a.y, min, max))
  }

  static Rot(a: VecLike, r = 0): Vec {
    const s = Math.sin(r)
    const c = Math.cos(r)
    return new Vec(a.x * c - a.y * s, a.x * s + a.y * c)
  }

  static RotWith(a: VecLike, c: VecLike, r: number): Vec {
    const x = a.x - c.x
    const y = a.y - c.y
    const s = Math.sin(r)
    const k = Math.cos(r)
    return new Vec(c.x + (x * k - y * s), c.y + (x * s + y * k))
  }

  static Dist(a: VecLike, b: VecLike): number {
    return ((a.y - b.y) ** 2 + (a.x - b.x) ** 2) ** 0.5
  }

  static Dist2(a: VecLike, b: VecLike): number {
    return (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y)
  }

  static ManhattanDist(a: VecLike, b: VecLike): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
  }

  static DistMin(a: VecLike, b: VecLike, n: number): boolean {
    return (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) < n ** 2
  }

  static Dpr(a: VecLike, b: VecLike): number {
    return a.x * b.x + a.y * b.y
  }

  static Cpr(a: VecLike, b: VecLike): number {
    return a.x * b.y - b.x * a.y
  }

  static Cross(a: VecLike, v: VecLike): Vec {
    const az = a.z ?? 1
    const vz = v.z ?? 1
    return new Vec(a.y * vz - az * v.y, az * v.x - a.x * vz)
  }

  static Len2(a: VecLike): number {
    return a.x * a.x + a.y * a.y
  }

  static Len(a: VecLike): number {
    return (a.x * a.x + a.y * a.y) ** 0.5
  }

  static Pry(a: VecLike, b: VecLike): number {
    return Vec.Dpr(a, b) / Vec.Len(b)
  }

  static Uni(a: VecLike): Vec {
    const l = Vec.Len(a)
    return new Vec(l === 0 ? 0 : a.x / l, l === 0 ? 0 : a.y / l)
  }

  static Tan(a: VecLike, b: VecLike): Vec {
    return Vec.Uni(Vec.Sub(a, b))
  }

  static Nudge(a: VecLike, b: VecLike, distance: number): Vec {
    return Vec.Add(a, Vec.Tan(b, a).mul(distance))
  }

  static Lrp(a: VecLike, b: VecLike, t: number): Vec {
    return new Vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)
  }

  static Rescale(a: VecLike, n: number): Vec {
    const l = Vec.Len(a)
    return new Vec((n * a.x) / l, (n * a.y) / l)
  }

  static ScaleWithOrigin(a: VecLike, scale: number, origin: VecLike): Vec {
    return Vec.Sub(a, origin).mul(scale).add(origin)
  }

  static NearestPointOnLineThroughPoint(a: VecLike, u: VecLike, p: VecLike): Vec {
    const t = (p.x - a.x) * u.x + (p.y - a.y) * u.y
    return new Vec(a.x + u.x * t, a.y + u.y * t)
  }

  static DistanceToLineThroughPoint(a: VecLike, u: VecLike, p: VecLike): number {
    const dx = p.x - a.x
    const dy = p.y - a.y
    return Math.abs(dx * u.y - dy * u.x)
  }

  static NearestPointOnLineSegment(a: VecLike, b: VecLike, p: VecLike, doClamp = true): Vec {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const d2 = dx * dx + dy * dy

    if (d2 === 0) return Vec.From(a)

    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / d2

    if (doClamp) {
      if (t < 0) t = 0
      else if (t > 1) t = 1
    }

    return new Vec(a.x + t * dx, a.y + t * dy)
  }

  static DistanceToLineSegment(a: VecLike, b: VecLike, p: VecLike, doClamp = true): number {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const d2 = dx * dx + dy * dy

    if (d2 === 0) return Vec.Dist(a, p)

    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / d2

    if (doClamp) {
      if (t < 0) t = 0
      else if (t > 1) t = 1
    }

    const nx = a.x + t * dx - p.x
    const ny = a.y + t * dy - p.y
    return Math.sqrt(nx * nx + ny * ny)
  }

  static Angle(a: VecLike, b: VecLike): number {
    return Math.atan2(b.y - a.y, b.x - a.x)
  }

  static AngleBetween(a: VecLike, b: VecLike): number {
    const p = a.x * b.x + a.y * b.y
    const n = Math.sqrt((a.x * a.x + a.y * a.y) * (b.x * b.x + b.y * b.y))
    const sign = a.x * b.y - a.y * b.x < 0 ? -1 : 1
    return sign * Math.acos(clamp(p / n, -1, 1))
  }

  static ToAngle(a: VecLike): number {
    let r = Math.atan2(a.y, a.x)
    if (r < 0) r += Math.PI * 2
    return r
  }

  static Clockwise(a: VecLike, b: VecLike, c: VecLike): boolean {
    return (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y) < 0
  }

  static Equals(a: VecLike, b: VecLike): boolean {
    return Math.abs(a.x - b.x) < 0.0001 && Math.abs(a.y - b.y) < 0.0001
  }

  static EqualsXY(a: VecLike, x: number, y: number): boolean {
    return a.x === x && a.y === y
  }

  static IsNaN(a: VecLike): boolean {
    return Number.isNaN(a.x) || Number.isNaN(a.y)
  }

  static IsFinite(a: VecLike): boolean {
    return Number.isFinite(a.x) && Number.isFinite(a.y)
  }

  static Snap(a: VecLike, step = 1): Vec {
    return new Vec(Math.round(a.x / step) * step, Math.round(a.y / step) * step)
  }

  static SnapToGrid(a: VecLike, gridSize = 8): Vec {
    return new Vec(Math.round(a.x / gridSize) * gridSize, Math.round(a.y / gridSize) * gridSize)
  }

  static ToFixed(a: VecLike): Vec {
    return new Vec(toFixed(a.x), toFixed(a.y))
  }

  static ToArray(a: VecLike): number[] {
    return [a.x, a.y, a.z ?? 1]
  }

  static ToString(a: VecLike): string {
    return `${a.x}, ${a.y}`
  }
}
