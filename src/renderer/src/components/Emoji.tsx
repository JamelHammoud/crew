import { Fragment, useMemo } from 'react'
import { lookupCustomEmojiRef, useCustomEmoji } from './customEmojiSheet'
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
  // Every emoji the app draws comes through here, so this is the one place that
  // has to hear about an emoji arriving: a name written before the crew had it is
  // a picture the moment they do.
  useCustomEmoji()
  // A `:name:` the crew has is its picture. One the crew has never had falls
  // through to the text below and prints the name itself, since the picture may
  // simply have been taken away and the name is the honest answer.
  const picture = lookupCustomEmojiRef(char)
  if (picture) {
    return (
      <img
        src={picture.url}
        alt=""
        aria-hidden
        draggable={false}
        className={`inline-block shrink-0 object-contain ${className ?? ''}`}
        style={{ width: size, height: size }}
      />
    )
  }
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
// out of sight, for anything that copies or reads the message. The crew's own
// carry their `:name:` there for the same reason: it is what somebody would type
// to write the picture again.
export function EmojiText({ text }: { text: string }) {
  const tokens = useMemo(() => tokenizeEmoji(text), [text])
  return (
    <>
      {tokens.map((token, index) =>
        token.kind === 'text' ? (
          token.text
        ) : (
          <Fragment key={index}>
            <Emoji
              char={token.kind === 'emoji' ? token.entry.char : token.text}
              size="1.15em"
              className="align-[-0.2em]"
            />
            <span className="sr-only">{token.text}</span>
          </Fragment>
        )
      )}
    </>
  )
}
