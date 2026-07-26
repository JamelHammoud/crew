import { spriteStyle, type EmojiEntry } from './emojiData'
import { tokenizeEmoji } from './emojiTokens'

function spriteNode(doc: Document, entry: EmojiEntry): HTMLElement {
  const sprite = doc.createElement('span')
  sprite.setAttribute('aria-hidden', 'true')
  Object.assign(sprite.style, {
    display: 'inline-block',
    width: '1.15em',
    height: '1.15em',
    verticalAlign: '-0.2em',
    backgroundRepeat: 'no-repeat',
    ...spriteStyle(entry)
  })
  return sprite
}

function readableNode(doc: Document, char: string): HTMLElement {
  const span = doc.createElement('span')
  span.className = 'sr-only'
  span.textContent = char
  return span
}

// Code is quoted as it was written, so only prose is drawn from the sheet.
export function emojifyHtml(root: HTMLElement): void {
  const doc = root.ownerDocument
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const texts: Text[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement
    if (parent && !parent.closest('pre, code')) texts.push(node as Text)
  }
  for (const text of texts) {
    const tokens = tokenizeEmoji(text.textContent ?? '')
    if (!tokens.some(token => token.kind === 'emoji')) continue
    const fragment = doc.createDocumentFragment()
    for (const token of tokens) {
      if (token.kind === 'text') {
        fragment.appendChild(doc.createTextNode(token.text))
        continue
      }
      fragment.appendChild(spriteNode(doc, token.entry))
      fragment.appendChild(readableNode(doc, token.text))
    }
    text.replaceWith(fragment)
  }
}
