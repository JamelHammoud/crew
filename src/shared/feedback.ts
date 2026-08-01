// What a piece of feedback is made of, and the address it goes to. It is here
// rather than in the card so it can be read without a window anywhere near it,
// and so main and the renderer cannot disagree about what one says.

export const FEEDBACK_EMAIL = 'devjamel@gmail.com'

// A mailto is handed to the shell as one string and Windows stops reading one
// at around two thousand characters, so the field stops taking words rather
// than the end being cut off on the way out. It is well under the count it
// could be because every space is three characters by the time the shell sees
// it: prose comes out around a quarter longer than it was written.
export const FEEDBACK_LIMIT = 1000

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

export function feedbackSubject(details: SystemDetails): string {
  return details.version ? `Crew ${details.version} feedback` : 'Crew feedback'
}

// What is written and what it was written on, in that order. The words are the
// thing being read, so the details stand under them rather than in front.
export function feedbackBody(text: string, details: SystemDetails): string {
  const version = details.version ? `Crew ${details.version}` : 'Crew'
  const under = [version, systemLine(details)].filter(Boolean).join('\n')
  return `${text.trim()}\n\n${under}`
}

export function feedbackMailto(text: string, details: SystemDetails): string {
  const subject = encodeURIComponent(feedbackSubject(details))
  const body = encodeURIComponent(feedbackBody(text, details))
  return `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`
}
