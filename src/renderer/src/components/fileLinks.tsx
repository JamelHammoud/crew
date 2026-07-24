import { useBrowser } from '../state/browser'

export interface FileRef {
  path: string
  line: number | null
}

const SLASH_PATH = String.raw`(?:\.\/)?(?:[\w.-]+\/)+[\w.-]*\w`
const BARE_FILE = String.raw`[\w-]+(?:\.[\w-]+)*\.[A-Za-z][A-Za-z0-9]{1,6}`
const LINE_SUFFIX = String.raw`:\d+(?::\d+)?`
const DOMAINS = new Set(['com', 'net', 'org', 'io', 'dev', 'ai', 'app', 'co', 'edu', 'gov'])

const FULL_RE = new RegExp(`^(${SLASH_PATH}|${BARE_FILE})(${LINE_SUFFIX})?$`)
const PROSE_RE = new RegExp(
  String.raw`(?<![\w/.@:-])(${SLASH_PATH}|${BARE_FILE})(${LINE_SUFFIX})?(?![\w/])`,
  'g'
)

function toRef(rawPath: string, suffix: string | undefined): FileRef | null {
  const path = rawPath.replace(/^\.\//, '')
  if (path.startsWith('../') || path.includes('//')) return null
  if (!path.includes('/') && DOMAINS.has(path.split('.').pop() ?? '')) return null
  const line = suffix ? parseInt(suffix.slice(1), 10) : null
  return { path, line }
}

export function parseFileRef(raw: string): FileRef | null {
  const text = raw.trim()
  if (text.includes('://')) return null
  const match = text.match(FULL_RE)
  if (!match) return null
  return toRef(match[1], match[2])
}

export type FileToken =
  | { kind: 'text'; text: string }
  | { kind: 'file'; text: string; path: string; line: number | null }

export function fileTokens(text: string): FileToken[] {
  const tokens: FileToken[] = []
  let cursor = 0
  for (const match of text.matchAll(PROSE_RE)) {
    const ref = toRef(match[1], match[2])
    if (!ref) continue
    const start = match.index ?? 0
    if (start > cursor) tokens.push({ kind: 'text', text: text.slice(cursor, start) })
    tokens.push({ kind: 'file', text: match[0], path: ref.path, line: ref.line })
    cursor = start + match[0].length
  }
  if (cursor < text.length) tokens.push({ kind: 'text', text: text.slice(cursor) })
  return tokens
}

function makeAnchor(doc: Document, ref: FileRef): HTMLAnchorElement {
  const anchor = doc.createElement('a')
  anchor.className = 'file-link'
  anchor.dataset.path = ref.path
  if (ref.line !== null) anchor.dataset.line = String(ref.line)
  return anchor
}

export function linkifyFiles(root: HTMLElement): void {
  const doc = root.ownerDocument
  for (const code of [...root.querySelectorAll('code')]) {
    if (code.closest('pre, a')) continue
    const ref = parseFileRef(code.textContent ?? '')
    if (!ref) continue
    const anchor = makeAnchor(doc, ref)
    code.replaceWith(anchor)
    anchor.appendChild(code)
  }
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const texts: Text[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement
    if (parent && !parent.closest('a, pre, code')) texts.push(node as Text)
  }
  for (const text of texts) {
    const tokens = fileTokens(text.textContent ?? '')
    if (!tokens.some(t => t.kind === 'file')) continue
    const fragment = doc.createDocumentFragment()
    for (const token of tokens) {
      if (token.kind === 'text') {
        fragment.appendChild(doc.createTextNode(token.text))
        continue
      }
      const anchor = makeAnchor(doc, { path: token.path, line: token.line })
      const code = doc.createElement('code')
      code.textContent = token.text
      anchor.appendChild(code)
      fragment.appendChild(anchor)
    }
    text.replaceWith(fragment)
  }
}

export function FileChip({ path, line, text }: { path: string; line: number | null; text: string }) {
  return (
    <code
      onClick={event => {
        event.stopPropagation()
        useBrowser.getState().openFile(path, line)
      }}
      className="font-mono text-[13px] bg-ink-800 rounded-md px-1.5 py-0.5 cursor-pointer transition-colors hover:bg-ink-700 hover:text-fg"
    >
      {text}
    </code>
  )
}

export function TextWithFileLinks({ text }: { text: string }) {
  const tokens = fileTokens(text)
  return (
    <>
      {tokens.map((token, index) =>
        token.kind === 'file' ? (
          <FileChip key={index} path={token.path} line={token.line} text={token.text} />
        ) : (
          token.text
        )
      )}
    </>
  )
}
