export type ScanSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export type ScanFinding = {
  id: string
  title: string
  file: string
  line: number
  severity: ScanSeverity
}

export type ScanCounts = Record<ScanSeverity, number>

export type ScanReport =
  | { kind: 'found'; findings: ScanFinding[]; counts: ScanCounts; at: number }
  | { kind: 'missing' }
  | { kind: 'nowhere' }
  | { kind: 'failed'; message: string }

export const SCANNER = 'threatcrush'

export const SCANNER_HOME = 'https://threatcrush.com'

export const SEVERITIES: readonly ScanSeverity[] = ['critical', 'high', 'medium', 'low', 'info']

const RANK: Record<ScanSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }

export const severityRank = (severity: ScanSeverity): number => RANK[severity]

const severityOf = (raw: unknown): ScanSeverity => SEVERITIES.find(one => one === raw) ?? 'info'

export const noCounts = (): ScanCounts => ({ critical: 0, high: 0, medium: 0, low: 0, info: 0 })

export function countsOf(findings: readonly ScanFinding[]): ScanCounts {
  const counts = noCounts()
  for (const finding of findings) counts[finding.severity] += 1
  return counts
}

export const worstOf = (findings: readonly ScanFinding[]): ScanSeverity | null =>
  findings.reduce<ScanSeverity | null>(
    (worst, finding) =>
      worst === null || severityRank(finding.severity) < severityRank(worst) ? finding.severity : worst,
    null
  )

const text = (raw: unknown): string => (typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '')

const detailsOf = (raw: unknown): Record<string, unknown> => {
  const said = (raw as { details?: unknown })?.details
  return said && typeof said === 'object' ? (said as Record<string, unknown>) : {}
}

function whereIn(raw: unknown, details: Record<string, unknown>): { file: string; line: number } {
  const file = text(details.file)
  const line =
    typeof details.line === 'number' && Number.isFinite(details.line) ? Math.max(1, Math.trunc(details.line)) : 0
  if (file) return { file, line: line || 1 }
  const said = text((raw as { location?: unknown })?.location)
  const cut = said.lastIndexOf(':')
  const tail = cut === -1 ? '' : said.slice(cut + 1)
  const counted = Number.parseInt(tail, 10)
  if (cut > 0 && Number.isFinite(counted)) return { file: said.slice(0, cut), line: Math.max(1, counted) }
  return { file: said, line: 1 }
}

function findingFrom(raw: unknown, index: number): ScanFinding | null {
  const details = detailsOf(raw)
  const { file, line } = whereIn(raw, details)
  if (!file) return null
  const title = text((raw as { type?: unknown })?.type)
  const message = text((raw as { message?: unknown })?.message)
  if (!title && !message) return null
  return {
    id: `${text(details.ruleId) || 'finding'}-${file}-${line}-${index}`,
    title: title || message,
    file,
    line,
    severity: severityOf((raw as { severity?: unknown })?.severity)
  }
}

export function sortFindings(findings: readonly ScanFinding[]): ScanFinding[] {
  return [...findings].sort(
    (one, two) =>
      severityRank(one.severity) - severityRank(two.severity) || one.file.localeCompare(two.file) || one.line - two.line
  )
}

export function readFindings(raw: unknown): ScanFinding[] | null {
  const said = raw as { findings?: unknown; type?: unknown } | null
  if (!said || typeof said !== 'object' || !Array.isArray(said.findings)) return null
  return sortFindings(said.findings.map(findingFrom).filter((one): one is ScanFinding => one !== null))
}

export function readScan(output: string): ScanFinding[] | null {
  const said = output.trim()
  if (!said) return null
  const start = said.indexOf('{')
  if (start === -1) return null
  try {
    return readFindings(JSON.parse(said.slice(start)))
  } catch {
    return null
  }
}

export const sayCount = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`
