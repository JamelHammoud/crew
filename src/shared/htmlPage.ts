// A page read as the page it is written to be. It is drawn from the words in
// hand rather than from the file on disk, so an edit typed in the text is on the
// page too, which means the page is stood up somewhere other than beside the
// stylesheet and the pictures it points at. A base is what puts those back
// within reach: everything written beside the page is read off the folder the
// page really lives in, so a preview looks the way the page looks.

export function fileUrl(absolute: string): string {
  const slashed = absolute.split('\\').join('/')
  const rooted = slashed.startsWith('/') ? slashed : `/${slashed}`
  const parts = rooted.split('/').map(part => (/^[a-z]:$/i.test(part) ? part : encodeURIComponent(part)))
  return `file://${parts.join('/')}`
}

export function baseUrl(absolute: string): string {
  const url = fileUrl(absolute)
  return url.slice(0, url.lastIndexOf('/') + 1)
}

const BASE = /<base\b[^>]*\bhref\s*=/i
const HEAD = /<head\b[^>]*>/i
const HTML = /<html\b[^>]*>/i
const DOCTYPE = /^\s*<!doctype\b[^>]*>/i

// A page that says its own base keeps it, and one that says nothing is handed
// the folder it was written in. Where the tag lands is the head, then the page,
// then after the doctype, since a doctype only counts as one while it is the
// first thing in the file.
export function withBase(text: string, base: string): string {
  if (!base || BASE.test(text)) return text
  const tag = `<base href="${base}">`
  for (const pattern of [HEAD, HTML, DOCTYPE]) {
    const found = pattern.exec(text)
    if (!found) continue
    const at = found.index + found[0].length
    return `${text.slice(0, at)}${tag}${text.slice(at)}`
  }
  return `${tag}${text}`
}
