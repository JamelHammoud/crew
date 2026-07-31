import { approximatelyLte, toPrecision } from './utils'
import { Vec, type VecLike } from './Vec'

export interface BoxModel {
  x: number
  y: number
  w: number
  h: number
}

export type BoxLike = Box | BoxModel

export type SelectionEdge = 'top' | 'right' | 'bottom' | 'left'

export type SelectionCorner = 'top_left' | 'top_right' | 'bottom_right' | 'bottom_left'

export type SelectionHandle = SelectionEdge | SelectionCorner

export class Box {
  x = 0
  y = 0
  w = 0
  h = 0

  constructor(x = 0, y = 0, w = 0, h = 0) {
    this.x = x
    this.y = y
    this.w = w
    this.h = h
  }

  get point(): Vec {
    return new Vec(this.x, this.y)
  }

  set point(val: Vec) {
    this.x = val.x
    this.y = val.y
  }

  get minX(): number {
    return this.x
  }

  set minX(n: number) {
    this.x = n
  }

  get midX(): number {
    return this.x + this.w / 2
  }

  get maxX(): number {
    return this.x + this.w
  }

  get minY(): number {
    return this.y
  }

  set minY(n: number) {
    this.y = n
  }

  get midY(): number {
    return this.y + this.h / 2
  }

  get maxY(): number {
    return this.y + this.h
  }

  get left(): number {
    return this.x
  }

  get right(): number {
    return this.x + this.w
  }

  get top(): number {
    return this.y
  }

  get bottom(): number {
    return this.y + this.h
  }

  get width(): number {
    return this.w
  }

  set width(n: number) {
    this.w = n
  }

  get height(): number {
    return this.h
  }

  set height(n: number) {
    this.h = n
  }

  get aspectRatio(): number {
    return this.width / this.height
  }

  get center(): Vec {
    return new Vec(this.x + this.w / 2, this.y + this.h / 2)
  }

  set center(v: Vec) {
    this.x = v.x - this.w / 2
    this.y = v.y - this.h / 2
  }

  get size(): Vec {
    return new Vec(this.w, this.h)
  }

  get corners(): Vec[] {
    return [
      new Vec(this.x, this.y),
      new Vec(this.x + this.w, this.y),
      new Vec(this.x + this.w, this.y + this.h),
      new Vec(this.x, this.y + this.h)
    ]
  }

  get cornersAndCenter(): Vec[] {
    return [
      new Vec(this.x, this.y),
      new Vec(this.x + this.w, this.y),
      new Vec(this.x + this.w, this.y + this.h),
      new Vec(this.x, this.y + this.h),
      new Vec(this.x + this.w / 2, this.y + this.h / 2)
    ]
  }

  get sides(): Array<[Vec, Vec]> {
    const { corners } = this
    return [
      [corners[0], corners[1]],
      [corners[1], corners[2]],
      [corners[2], corners[3]],
      [corners[3], corners[0]]
    ]
  }

  isValid(): boolean {
    return Number.isFinite(this.x) && Number.isFinite(this.y) && Number.isFinite(this.w) && Number.isFinite(this.h)
  }

  set(x = 0, y = 0, w = 0, h = 0): this {
    this.x = x
    this.y = y
    this.w = w
    this.h = h
    return this
  }

  setTo(b: BoxLike): this {
    this.x = b.x
    this.y = b.y
    this.w = b.w
    this.h = b.h
    return this
  }

  clone(): Box {
    const { x, y, w, h } = this
    return new Box(x, y, w, h)
  }

  toFixed(): this {
    this.x = toPrecision(this.x)
    this.y = toPrecision(this.y)
    this.w = toPrecision(this.w)
    this.h = toPrecision(this.h)
    return this
  }

  toJson(): BoxModel {
    return { x: this.x, y: this.y, w: this.w, h: this.h }
  }

  expand(a: BoxLike): this {
    const minX = Math.min(this.x, a.x)
    const minY = Math.min(this.y, a.y)
    const maxX = Math.max(this.x + this.w, a.x + a.w)
    const maxY = Math.max(this.y + this.h, a.y + a.h)

    this.x = minX
    this.y = minY
    this.w = maxX - minX
    this.h = maxY - minY
    return this
  }

  expandBy(n: number): this {
    this.x -= n
    this.y -= n
    this.w += n * 2
    this.h += n * 2
    return this
  }

  scale(n: number): this {
    this.x /= n
    this.y /= n
    this.w /= n
    this.h /= n
    return this
  }

  translate(delta: VecLike): this {
    this.x += delta.x
    this.y += delta.y
    return this
  }

  snapToGrid(size: number): this {
    const minX = Math.round(this.x / size) * size
    const minY = Math.round(this.y / size) * size
    const maxX = Math.round((this.x + this.w) / size) * size
    const maxY = Math.round((this.y + this.h) / size) * size
    this.minX = minX
    this.minY = minY
    this.width = Math.max(1, maxX - minX)
    this.height = Math.max(1, maxY - minY)
    return this
  }

  union(box: BoxLike): this {
    const minX = Math.min(this.x, box.x)
    const minY = Math.min(this.y, box.y)
    const maxX = Math.max(this.x + this.w, box.x + box.w)
    const maxY = Math.max(this.y + this.h, box.y + box.h)

    this.x = minX
    this.y = minY
    this.width = maxX - minX
    this.height = maxY - minY
    return this
  }

  zeroFix(): this {
    this.w = Math.max(1, this.w)
    this.h = Math.max(1, this.h)
    return this
  }

  collides(b: Box): boolean {
    return Box.Collides(this, b)
  }

  contains(b: Box): boolean {
    return Box.Contains(this, b)
  }

  includes(b: Box): boolean {
    return Box.Includes(this, b)
  }

  containsPoint(v: VecLike, margin = 0): boolean {
    return Box.ContainsPoint(this, v, margin)
  }

  equals(other: BoxLike): boolean {
    return Box.Equals(this, other)
  }

  getHandlePoint(handle: SelectionHandle): Vec {
    switch (handle) {
      case 'top_left':
        return new Vec(this.x, this.y)
      case 'top_right':
        return new Vec(this.x + this.w, this.y)
      case 'bottom_left':
        return new Vec(this.x, this.y + this.h)
      case 'bottom_right':
        return new Vec(this.x + this.w, this.y + this.h)
      case 'top':
        return new Vec(this.x + this.w / 2, this.y)
      case 'right':
        return new Vec(this.x + this.w, this.y + this.h / 2)
      case 'bottom':
        return new Vec(this.x + this.w / 2, this.y + this.h)
      case 'left':
        return new Vec(this.x, this.y + this.h / 2)
    }
  }

  resize(handle: SelectionHandle | string, dx: number, dy: number): this {
    const { box } = Box.Resize(this, handle, dx, dy)
    this.minX = box.minX
    this.minY = box.minY
    this.width = box.width
    this.height = box.height
    return this
  }

  static From(box: BoxLike): Box {
    return new Box(box.x, box.y, box.w, box.h)
  }

  static FromCenter(center: VecLike, size: VecLike): Box {
    return new Box(center.x - size.x / 2, center.y - size.y / 2, size.x, size.y)
  }

  static FromPoints(points: VecLike[]): Box {
    if (points.length === 0) return new Box()
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let point: VecLike
    for (let i = 0, n = points.length; i < n; i++) {
      point = points[i]
      minX = Math.min(point.x, minX)
      minY = Math.min(point.y, minY)
      maxX = Math.max(point.x, maxX)
      maxY = Math.max(point.y, maxY)
    }

    return new Box(minX, minY, maxX - minX, maxY - minY)
  }

  static Common(boxes: Box[]): Box {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i]
      minX = Math.min(minX, b.minX)
      minY = Math.min(minY, b.minY)
      maxX = Math.max(maxX, b.maxX)
      maxY = Math.max(maxY, b.maxY)
    }

    return new Box(minX, minY, maxX - minX, maxY - minY)
  }

  static Expand(a: Box, b: Box): Box {
    const minX = Math.min(b.minX, a.minX)
    const minY = Math.min(b.minY, a.minY)
    const maxX = Math.max(b.maxX, a.maxX)
    const maxY = Math.max(b.maxY, a.maxY)

    return new Box(minX, minY, maxX - minX, maxY - minY)
  }

  static ExpandBy(a: Box, n: number): Box {
    return new Box(a.minX - n, a.minY - n, a.width + n * 2, a.height + n * 2)
  }

  static Collides(a: Box, b: Box): boolean {
    return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY)
  }

  static Contains(a: Box, b: Box): boolean {
    return a.minX < b.minX && a.minY < b.minY && a.maxY > b.maxY && a.maxX > b.maxX
  }

  static ContainsApproximately(a: Box, b: Box, precision?: number): boolean {
    return (
      approximatelyLte(a.minX, b.minX, precision) &&
      approximatelyLte(a.minY, b.minY, precision) &&
      approximatelyLte(b.maxX, a.maxX, precision) &&
      approximatelyLte(b.maxY, a.maxY, precision)
    )
  }

  static Includes(a: Box, b: Box): boolean {
    return Box.Collides(a, b) || Box.Contains(a, b)
  }

  static ContainsPoint(a: Box, b: VecLike, margin = 0): boolean {
    return !(b.x < a.minX - margin || b.y < a.minY - margin || b.x > a.maxX + margin || b.y > a.maxY + margin)
  }

  static Sides(a: Box): Array<[Vec, Vec]> {
    return a.sides
  }

  static Equals(a: BoxLike, b: BoxLike): boolean {
    return b.x === a.x && b.y === a.y && b.w === a.w && b.h === a.h
  }

  static ZeroFix(other: BoxLike): Box {
    return new Box(other.x, other.y, Math.max(1, other.w), Math.max(1, other.h))
  }

  static Resize(
    box: Box,
    handle: SelectionHandle | string,
    dx: number,
    dy: number,
    isAspectRatioLocked = false
  ): { box: Box; scaleX: number; scaleY: number } {
    const { minX: a0x, minY: a0y, maxX: a1x, maxY: a1y } = box
    let { minX: b0x, minY: b0y, maxX: b1x, maxY: b1y } = box

    switch (handle) {
      case 'left':
      case 'top_left':
      case 'bottom_left': {
        b0x += dx
        break
      }
      case 'right':
      case 'top_right':
      case 'bottom_right': {
        b1x += dx
        break
      }
    }
    switch (handle) {
      case 'top':
      case 'top_left':
      case 'top_right': {
        b0y += dy
        break
      }
      case 'bottom':
      case 'bottom_left':
      case 'bottom_right': {
        b1y += dy
        break
      }
    }

    const scaleX = (b1x - b0x) / (a1x - a0x)
    const scaleY = (b1y - b0y) / (a1y - a0y)

    const flipX = scaleX < 0
    const flipY = scaleY < 0

    if (isAspectRatioLocked) {
      const aspectRatio = (a1x - a0x) / (a1y - a0y)
      const bw = Math.abs(b1x - b0x)
      const bh = Math.abs(b1y - b0y)
      const tw = bw * (scaleY < 0 ? 1 : -1) * (1 / aspectRatio)
      const th = bh * (scaleX < 0 ? 1 : -1) * aspectRatio
      const isTall = aspectRatio < bw / bh

      switch (handle) {
        case 'top_left': {
          if (isTall) b0y = b1y + tw
          else b0x = b1x + th
          break
        }
        case 'top_right': {
          if (isTall) b0y = b1y + tw
          else b1x = b0x - th
          break
        }
        case 'bottom_right': {
          if (isTall) b1y = b0y - tw
          else b1x = b0x - th
          break
        }
        case 'bottom_left': {
          if (isTall) b1y = b0y - tw
          else b0x = b1x + th
          break
        }
        case 'bottom':
        case 'top': {
          const m = (b0x + b1x) / 2
          const w = bh * aspectRatio
          b0x = m - w / 2
          b1x = m + w / 2
          break
        }
        case 'left':
        case 'right': {
          const m = (b0y + b1y) / 2
          const h = bw / aspectRatio
          b0y = m - h / 2
          b1y = m + h / 2
          break
        }
      }
    }

    if (flipX) {
      const t = b1x
      b1x = b0x
      b0x = t
    }

    if (flipY) {
      const t = b1y
      b1y = b0y
      b0y = t
    }

    const final = new Box(b0x, b0y, Math.abs(b1x - b0x), Math.abs(b1y - b0y))

    return {
      box: final,
      scaleX: +((final.width / box.width) * (scaleX > 0 ? 1 : -1)).toFixed(5),
      scaleY: +((final.height / box.height) * (scaleY > 0 ? 1 : -1)).toFixed(5)
    }
  }
}
