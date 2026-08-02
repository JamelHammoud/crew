const NAMES_KEY = 'crew.place-names'

export const PLACE_NAME_LIMIT = 40

export function cleanPlaceName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, PLACE_NAME_LIMIT)
}

export function savedNames(): Record<string, string> {
  let parsed: unknown
  try {
    parsed = JSON.parse(globalThis.localStorage?.getItem(NAMES_KEY) ?? '{}')
  } catch {
    return {}
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).flatMap(([key, value]) => {
      const clean = typeof value === 'string' ? cleanPlaceName(value) : ''
      return clean ? [[key, clean] as [string, string]] : []
    })
  )
}

export function keepName(key: string, name: string): Record<string, string> {
  const names = savedNames()
  const clean = cleanPlaceName(name)
  if (clean) names[key] = clean
  else delete names[key]
  try {
    globalThis.localStorage?.setItem(NAMES_KEY, JSON.stringify(names))
  } catch {
    return names
  }
  return names
}
