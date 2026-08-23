import CopyButton from './CopyButton'
import { TextWithFileLinks } from './fileLinks'

interface ToolCallField {
  key: string
  label: string
  text: string
  long: boolean
}

export interface ToolCallInfo {
  title: string
  summary: string
  fields: ToolCallField[]
  formatted: string
}

const SUMMARY_KEYS = ['title', 'description', 'name', 'query', 'prompt', 'path', 'url']

const recordOf = (value: unknown): Record<string, unknown> | null =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null

const fieldLabel = (key: string): string => {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_.\-/]+/g, ' ')
    .trim()
    .toLowerCase()
  const label = words ? words[0].toUpperCase() + words.slice(1) : key
  return label.replace(/\bid\b/gi, 'ID')
}

const valueText = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (value === undefined) return ''
  return JSON.stringify(value, null, 2)
}

const clipped = (text: string, limit: number): string =>
  text.length > limit ? `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…` : text

const valuePreview = (value: unknown): string => {
  if (typeof value === 'string') return clipped(value.replace(/\s+/g, ' ').trim(), 48)
  if (Array.isArray(value)) return `${value.length} ${value.length === 1 ? 'item' : 'items'}`
  const record = recordOf(value)
  if (record) {
    const count = Object.keys(record).length
    return `${count} ${count === 1 ? 'field' : 'fields'}`
  }
  if (value === null) return 'None'
  return String(value)
}

const summaryOf = (record: Record<string, unknown>): string => {
  for (const key of SUMMARY_KEYS) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return clipped(value.replace(/\s+/g, ' ').trim(), 90)
  }
  const parts = Object.entries(record)
    .slice(0, 2)
    .map(([key, value]) => `${fieldLabel(key)}: ${valuePreview(value)}`)
  return clipped(parts.join(' · '), 90)
}

export function toolCallInfo(detail: string): ToolCallInfo | null {
  const trimmed = detail.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return null
  }
  const record = recordOf(parsed)
  const values = record ? Object.entries(record) : Array.isArray(parsed) ? [['items', parsed] as const] : []
  const fields = values.map(([key, value]) => {
    const text = valueText(value)
    return { key, label: fieldLabel(key), text, long: text.includes('\n') || text.length > 90 }
  })
  return {
    title: record && typeof record['title'] === 'string' ? record['title'].trim() : '',
    summary: record ? summaryOf(record) : fields.length ? valuePreview(parsed) : '',
    fields,
    formatted: JSON.stringify(parsed, null, 2)
  }
}

export default function ToolCallDetail({ info, again, omit = [] }: {
  info: ToolCallInfo
  again?: unknown
  omit?: string[]
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-ink-700 bg-ink-900/35">
      <div className="divide-y divide-ink-700">
        {info.fields.filter(field => !omit.includes(field.key)).map(field => (
          <div key={field.key} className="grid grid-cols-[6.5rem_minmax(0,1fr)]">
            <span className="px-3 py-2 text-xs leading-5 text-fg-faint bg-ink-800/40">{field.label}</span>
            <p
              className={`select-text min-w-0 px-3 py-2 pr-10 text-xs leading-5 text-fg-secondary ${
                field.long ? 'max-h-60 overflow-auto whitespace-pre-wrap break-words font-mono' : 'break-words'
              }`}
            >
              <TextWithFileLinks text={field.text} inline={!field.long} again={again} />
            </p>
          </div>
        ))}
      </div>
      <CopyButton text={info.formatted} label="Copy input" className="absolute top-1 right-1" />
    </div>
  )
}
