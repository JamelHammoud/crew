export function activityDetail(input: unknown): string | undefined {
  if (!input || typeof input !== 'object') return undefined
  const record = input as Record<string, unknown>
  for (const key of ['description', 'prompt', 'command', 'pattern', 'file_path', 'path']) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return truncate(value)
  }
  return truncate(JSON.stringify(record))
}

function truncate(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > 100 ? flat.slice(0, 100) + '…' : flat
}
