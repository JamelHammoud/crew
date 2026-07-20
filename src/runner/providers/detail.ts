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
  const trimmed = text.trim()
  return trimmed.length > 4000 ? trimmed.slice(0, 4000) + '…' : trimmed
}
