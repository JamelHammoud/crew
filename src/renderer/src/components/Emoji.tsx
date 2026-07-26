import { Fragment, useMemo } from 'react'
import { lookupEmoji, spriteStyle } from './emojiData'
import { tokenizeEmoji } from './emojiTokens'

export default function Emoji({
  char,
  size = 18,
  className
}: {
  char: string
  size?: number | string
  className?: string
}) {
  const entry = lookupEmoji(char)
  if (!entry) {
    return (
      <span aria-hidden className={className} style={{ fontSize: size, lineHeight: 1 }}>
        {char}
      </span>
    )
  }
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-no-repeat ${className ?? ''}`}
      style={{ width: size, height: size, ...spriteStyle(entry) }}
    />
  )
}

// The sprite carries no text, so the character rides along beside it, clipped
// out of sight, for anything that copies or reads the message.
export function EmojiText({ text }: { text: string }) {
  const tokens = useMemo(() => tokenizeEmoji(text), [text])
  return (
    <>
      {tokens.map((token, index) =>
        token.kind === 'text' ? (
          token.text
        ) : (
          <Fragment key={index}>
            <Emoji char={token.entry.char} size="1.15em" className="align-[-0.2em]" />
            <span className="sr-only">{token.text}</span>
          </Fragment>
        )
      )}
    </>
  )
}
