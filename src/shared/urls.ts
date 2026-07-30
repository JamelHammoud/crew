// What someone typed, turned into something that can be opened. A bare host
// becomes an address, and anything that cannot be one becomes a search.
export function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/\s/.test(trimmed) || !trimmed.includes('.')) {
    return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`
  }
  return `https://${trimmed}`
}

export const URL_LIMIT = 2000

// What an agent may put on somebody's screen. A person typing in the address bar
// gets the benefit of the doubt and lands on a search; an agent gets none of it,
// because what it writes is opened on every machine in the crew without anybody
// pressing anything. Three ways in and no others: a real address, a machine it
// is already serving on, and a file on the disk it is working in. Anything else
// comes back as null and is refused in words, so a model reads what to write
// instead of watching a page it named quietly not appear.
export function pageUrl(input: unknown): string | null {
  const raw = typeof input === 'string' ? input.trim().slice(0, URL_LIMIT) : ''
  if (!raw || /\s/.test(raw)) return null
  if (/^(https?|file):\/\/\S+$/i.test(raw)) return raw
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/\S*)?$/i.test(raw)) return `http://${raw}`
  if (raw.startsWith('/')) return `file://${raw.split('/').map(encodeURIComponent).join('/')}`
  return null
}

// What the row in the thread reads as when the agent said nothing about the
// page. A file is its own name and a site is its host, which is the shortest
// true thing either one can be called.
export function pageName(url: string): string {
  try {
    const { protocol, host, pathname } = new URL(url)
    if (protocol === 'file:') return decodeURIComponent(pathname.split('/').filter(Boolean).at(-1) ?? '') || 'A page'
    return host || 'A page'
  } catch {
    return 'A page'
  }
}
