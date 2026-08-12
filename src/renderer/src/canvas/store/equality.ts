function sameValue(a: unknown, b: unknown): boolean {
  return a === b || (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b))
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export function sameRecordValue(a: unknown, b: unknown): boolean {
  if (sameValue(a, b)) return true

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    for (let at = 0; at < a.length; at++) {
      if (!sameRecordValue(a[at], b[at])) return false
    }
    return true
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(a)
    if (keys.length !== Object.keys(b).length) return false
    for (const key of keys) {
      if (!Object.hasOwn(b, key)) return false
      if (!sameRecordValue(a[key], b[key])) return false
    }
    return true
  }

  return false
}
