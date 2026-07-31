import type { VecModel } from './records'

export const DIM_2D = 2
export const DIM_3D = 3

export type PointDim = typeof DIM_2D | typeof DIM_3D

export const FIRST_POINT_B64_LENGTH = 16
export const FIRST_POINT_2D_B64_LENGTH = 12
export const DEFAULT_PRESSURE = 0.5

const FIRST_POINT_BYTES = 12
const FIRST_POINT_2D_BYTES = 8
const DELTA_BYTES = 6
const DELTA_2D_BYTES = 4

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const SIX_BIT_MASK = 0x3f
const PADDING_CHAR_CODE = '='.charCodeAt(0)

const B64_LOOKUP = new Uint8Array(128)
for (let at = 0; at < 64; at++) B64_LOOKUP[BASE64_CHARS.charCodeAt(at)] = at

const POW2 = new Float64Array(31)
for (let at = 0; at < 31; at++) POW2[at] = Math.pow(2, at - 15)
const POW2_SUBNORMAL = Math.pow(2, -14) / 1024

const MANTISSA = new Float64Array(1024)
for (let at = 0; at < 1024; at++) MANTISSA[at] = 1 + at / 1024

type Float16View = DataView & {
  getFloat16?(offset: number, littleEndian?: boolean): number
  setFloat16?(offset: number, value: number, littleEndian?: boolean): void
}

type Base64Array = Uint8Array & { toBase64?(): string }
type Base64Ctor = Uint8ArrayConstructor & { fromBase64?(base64: string): Uint8Array }

export function float16BitsToNumber(bits: number): number {
  const sign = bits >> 15
  const exponent = (bits >> 10) & 0x1f
  const fraction = bits & 0x3ff
  if (exponent === 0) return sign ? -fraction * POW2_SUBNORMAL : fraction * POW2_SUBNORMAL
  if (exponent === 31) return fraction ? NaN : sign ? -Infinity : Infinity
  const magnitude = POW2[exponent] * MANTISSA[fraction]
  return sign ? -magnitude : magnitude
}

export function numberToFloat16Bits(value: number): number {
  if (value === 0) return Object.is(value, -0) ? 0x8000 : 0
  if (!Number.isFinite(value)) {
    if (Number.isNaN(value)) return 0x7e00
    return value > 0 ? 0x7c00 : 0xfc00
  }
  const sign = value < 0 ? 1 : 0
  const magnitude = Math.abs(value)
  const exponent = Math.floor(Math.log2(magnitude))
  let biased = exponent + 15
  if (biased >= 31) return (sign << 15) | 0x7c00
  if (biased <= 0) return (sign << 15) | (Math.round(magnitude * Math.pow(2, 14) * 1024) & 0x3ff)
  let fraction = Math.round((magnitude / Math.pow(2, exponent) - 1) * 1024)
  if (fraction >= 1024) {
    fraction = 0
    biased++
    if (biased >= 31) return (sign << 15) | 0x7c00
  }
  return (sign << 15) | (biased << 10) | fraction
}

const hasNativeFloat16 = typeof (DataView.prototype as Float16View).getFloat16 === 'function'

function getFloat16(view: DataView, offset: number): number {
  if (hasNativeFloat16) return (view as Float16View).getFloat16!(offset, true)
  return float16BitsToNumber(view.getUint16(offset, true))
}

function setFloat16(view: DataView, offset: number, value: number): void {
  if (hasNativeFloat16) (view as Float16View).setFloat16!(offset, value, true)
  else view.setUint16(offset, numberToFloat16Bits(value), true)
}

export function bytesToBase64(bytes: Uint8Array): string {
  const native = bytes as Base64Array
  if (typeof native.toBase64 === 'function') return native.toBase64()
  const whole = Math.floor(bytes.length / 3) * 3
  let out = ''
  for (let at = 0; at < whole; at += 3) {
    const bitmap = (bytes[at] << 16) | (bytes[at + 1] << 8) | bytes[at + 2]
    out +=
      BASE64_CHARS[(bitmap >> 18) & SIX_BIT_MASK] +
      BASE64_CHARS[(bitmap >> 12) & SIX_BIT_MASK] +
      BASE64_CHARS[(bitmap >> 6) & SIX_BIT_MASK] +
      BASE64_CHARS[bitmap & SIX_BIT_MASK]
  }
  const left = bytes.length - whole
  if (left === 1) {
    const bitmap = bytes[whole] << 16
    out += BASE64_CHARS[(bitmap >> 18) & SIX_BIT_MASK] + BASE64_CHARS[(bitmap >> 12) & SIX_BIT_MASK] + '=='
  } else if (left === 2) {
    const bitmap = (bytes[whole] << 16) | (bytes[whole + 1] << 8)
    out +=
      BASE64_CHARS[(bitmap >> 18) & SIX_BIT_MASK] +
      BASE64_CHARS[(bitmap >> 12) & SIX_BIT_MASK] +
      BASE64_CHARS[(bitmap >> 6) & SIX_BIT_MASK] +
      '='
  }
  return out
}

export function base64ToBytes(base64: string): Uint8Array {
  const native = Uint8Array as Base64Ctor
  if (typeof native.fromBase64 === 'function') return native.fromBase64(base64)
  const length = base64.length
  let padding = 0
  if (length > 0 && base64.charCodeAt(length - 1) === PADDING_CHAR_CODE) {
    padding++
    if (length > 1 && base64.charCodeAt(length - 2) === PADDING_CHAR_CODE) padding++
  }
  const bytes = new Uint8Array(Math.floor((length * 3) / 4) - padding)
  const whole = Math.floor((length - padding) / 4) * 4
  let at = 0
  for (let cursor = 0; cursor < whole; cursor += 4) {
    const bitmap =
      (B64_LOOKUP[base64.charCodeAt(cursor)] << 18) |
      (B64_LOOKUP[base64.charCodeAt(cursor + 1)] << 12) |
      (B64_LOOKUP[base64.charCodeAt(cursor + 2)] << 6) |
      B64_LOOKUP[base64.charCodeAt(cursor + 3)]
    bytes[at++] = (bitmap >> 16) & 255
    bytes[at++] = (bitmap >> 8) & 255
    bytes[at++] = bitmap & 255
  }
  if (padding === 1) {
    const bitmap =
      (B64_LOOKUP[base64.charCodeAt(whole)] << 18) |
      (B64_LOOKUP[base64.charCodeAt(whole + 1)] << 12) |
      (B64_LOOKUP[base64.charCodeAt(whole + 2)] << 6)
    bytes[at++] = (bitmap >> 16) & 255
    bytes[at++] = (bitmap >> 8) & 255
  } else if (padding === 2) {
    const bitmap = (B64_LOOKUP[base64.charCodeAt(whole)] << 18) | (B64_LOOKUP[base64.charCodeAt(whole + 1)] << 12)
    bytes[at++] = (bitmap >> 16) & 255
  }
  return bytes
}

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

function encodePoints3D(points: VecModel[]): string {
  const bytes = new Uint8Array(FIRST_POINT_BYTES + (points.length - 1) * DELTA_BYTES)
  const view = new DataView(bytes.buffer)
  const first = points[0]
  view.setFloat32(0, first.x, true)
  view.setFloat32(4, first.y, true)
  view.setFloat32(8, first.z ?? DEFAULT_PRESSURE, true)
  let prevX = first.x
  let prevY = first.y
  let prevZ = first.z ?? DEFAULT_PRESSURE
  for (let at = 1; at < points.length; at++) {
    const point = points[at]
    const z = point.z ?? DEFAULT_PRESSURE
    const offset = FIRST_POINT_BYTES + (at - 1) * DELTA_BYTES
    setFloat16(view, offset, point.x - prevX)
    setFloat16(view, offset + 2, point.y - prevY)
    setFloat16(view, offset + 4, z - prevZ)
    prevX = point.x
    prevY = point.y
    prevZ = z
  }
  return bytesToBase64(bytes)
}

function encodePoints2D(points: VecModel[]): string {
  const bytes = new Uint8Array(FIRST_POINT_2D_BYTES + (points.length - 1) * DELTA_2D_BYTES)
  const view = new DataView(bytes.buffer)
  const first = points[0]
  view.setFloat32(0, first.x, true)
  view.setFloat32(4, first.y, true)
  let prevX = first.x
  let prevY = first.y
  for (let at = 1; at < points.length; at++) {
    const point = points[at]
    const offset = FIRST_POINT_2D_BYTES + (at - 1) * DELTA_2D_BYTES
    setFloat16(view, offset, point.x - prevX)
    setFloat16(view, offset + 2, point.y - prevY)
    prevX = point.x
    prevY = point.y
  }
  return bytesToBase64(bytes)
}

export function encodePoints(points: VecModel[], dim: PointDim = DIM_3D): string {
  if (points.length === 0) return ''
  return dim === DIM_2D ? encodePoints2D(points) : encodePoints3D(points)
}

function decodePoints3D(base64: string): VecModel[] {
  const bytes = base64ToBytes(base64)
  const view = viewOf(bytes)
  let x = view.getFloat32(0, true)
  let y = view.getFloat32(4, true)
  let z = view.getFloat32(8, true)
  const points: VecModel[] = [{ x, y, z }]
  for (let offset = FIRST_POINT_BYTES; offset + DELTA_BYTES <= bytes.length; offset += DELTA_BYTES) {
    x += getFloat16(view, offset)
    y += getFloat16(view, offset + 2)
    z += getFloat16(view, offset + 4)
    points.push({ x, y, z })
  }
  return points
}

function decodePoints2D(base64: string): VecModel[] {
  const bytes = base64ToBytes(base64)
  const view = viewOf(bytes)
  let x = view.getFloat32(0, true)
  let y = view.getFloat32(4, true)
  const points: VecModel[] = [{ x, y, z: DEFAULT_PRESSURE }]
  for (let offset = FIRST_POINT_2D_BYTES; offset + DELTA_2D_BYTES <= bytes.length; offset += DELTA_2D_BYTES) {
    x += getFloat16(view, offset)
    y += getFloat16(view, offset + 2)
    points.push({ x, y, z: DEFAULT_PRESSURE })
  }
  return points
}

export function decodePoints(base64: string, dim: PointDim = DIM_3D): VecModel[] {
  if (base64.length === 0) return []
  return dim === DIM_2D ? decodePoints2D(base64) : decodePoints3D(base64)
}

export function isSinglePoint(base64: string, dim: PointDim = DIM_3D): boolean {
  return base64.length <= (dim === DIM_2D ? FIRST_POINT_2D_B64_LENGTH : FIRST_POINT_B64_LENGTH)
}
