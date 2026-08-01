import { createExtension } from '@blocknote/core'
import type { Node } from 'prosemirror-model'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { spriteStyle, type EmojiEntry } from '../emojiData'
import { anyEmoji, tokenizeEmoji } from '../emojiTokens'

// The character stays exactly where it was typed, because the doc is a markdown
// file and what is written down is what somebody wrote. The sheet is painted
// over the glyph instead: the text keeps its own box, so the caret lands where
// it always did and a selection paints the band under it.
function sheet(entry: EmojiEntry): string {
  const style = spriteStyle(entry)
  return [
    `--doc-emoji-image:${style.backgroundImage}`,
    `--doc-emoji-size:${style.backgroundSize}`,
    `--doc-emoji-at:${style.backgroundPosition}`
  ].join(';')
}

// Code is quoted as it was written, the same rule prose is drawn under, so a
// fence and a run of inline code are both left alone.
function sprites(doc: Node): DecorationSet {
  const found: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.type.spec.code) return false
    if (!node.isText) return true
    const text = node.text ?? ''
    if (!anyEmoji(text) || node.marks.some(mark => mark.type.spec.code)) return false
    let at = 0
    for (const token of tokenizeEmoji(text)) {
      if (token.kind === 'emoji') {
        found.push(
          Decoration.inline(pos + at, pos + at + token.text.length, {
            class: 'doc-emoji',
            style: sheet(token.entry)
          })
        )
      }
      at += token.text.length
    }
    return false
  })
  return DecorationSet.create(doc, found)
}

const key = new PluginKey<DecorationSet>('crewDocEmoji')

export const docEmoji = createExtension({
  key: 'crewDocEmoji',
  prosemirrorPlugins: [
    new Plugin<DecorationSet>({
      key,
      state: {
        init: (_config, state) => sprites(state.doc),
        apply: (tr, drawn) => (tr.docChanged ? sprites(tr.doc) : drawn)
      },
      props: { decorations: state => key.getState(state) }
    })
  ]
})
