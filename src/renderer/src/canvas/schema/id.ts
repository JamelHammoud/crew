import type { TLBindingId, TLPageId, TLShapeId } from './records'

const ID_ALPHABET = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'
const DEFAULT_SIZE = 21
const POOL_MULTIPLIER = 128

let pool: Uint8Array | null = null
let poolOffset = 0

function fillPool(bytes: number): void {
  if (!pool || pool.length < bytes) {
    pool = new Uint8Array(bytes * POOL_MULTIPLIER)
    crypto.getRandomValues(pool)
    poolOffset = 0
  } else if (poolOffset + bytes > pool.length) {
    crypto.getRandomValues(pool)
    poolOffset = 0
  }
  poolOffset += bytes
}

export function uniqueId(size = DEFAULT_SIZE): string {
  fillPool(size)
  let id = ''
  for (let at = poolOffset - size; at < poolOffset; at++) id += ID_ALPHABET[pool![at] & 63]
  return id
}

export function createShapeId(id?: string): TLShapeId {
  return `shape:${id ?? uniqueId()}` as TLShapeId
}

export function createPageId(id?: string): TLPageId {
  return `page:${id ?? uniqueId()}` as TLPageId
}

export function createBindingId(id?: string): TLBindingId {
  return `binding:${id ?? uniqueId()}` as TLBindingId
}
