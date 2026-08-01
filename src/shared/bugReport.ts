// What a bug report is made of, and the address it goes to. It is here rather
// than in the card so it can be read without a window anywhere near it, and so
// main and the renderer cannot disagree about what a report says.

export const BUG_EMAIL = 'devjamel@gmail.com'

// A mailto is handed to the shell as one string, and Windows stops reading one
// somewhere around two thousand characters. A report longer than this is a
// conversation rather than a report, so the field stops taking words at the
// limit instead of the shell quietly cutting the end off.
export const REPORT_LIMIT = 1500

export interface SystemDetails {
  version: string
  platform: string
  release: string
  arch: string
}

const SYSTEMS: Record<string, string> = {
  darwin: 'macOS',
  win32: 'Windows',
  linux: 'Linux'
}

export function systemLine(details: SystemDetails): string {
  const name = SYSTEMS[details.platform] ?? details.platform
  return [name, details.release, details.arch].filter(Boolean).join(' ')
}

export function reportSubject(details: SystemDetails): string {
  return details.version ? `Crew ${details.version} bug report` : 'Crew bug report'
}

// What is written and what it was written on, in that order. The report is the
// thing being read, so the details stand under it rather than in front of it.
export function reportBody(text: string, details: SystemDetails): string {
  const version = details.version ? `Crew ${details.version}` : 'Crew'
  const under = [version, systemLine(details)].filter(Boolean).join('\n')
  return `${text.trim()}\n\n${under}`
}

export function bugMailto(text: string, details: SystemDetails): string {
  const subject = encodeURIComponent(reportSubject(details))
  const body = encodeURIComponent(reportBody(text, details))
  return `mailto:${BUG_EMAIL}?subject=${subject}&body=${body}`
}
