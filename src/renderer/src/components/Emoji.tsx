import { Fragment, useMemo } from 'react'
import { lookupCustomEmojiRef, useCustomEmoji } from './customEmojiSheet'
import { emojiName, lookupEmoji, spriteStyle } from './emojiData'
import { tokenizeEmoji } from './emojiTokens'
import Tooltip from './Tooltip'

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

// A picture drawn small in a sentence is one somebody may not know the name of,
// and the name is what they would type to write it themselves.
export function EmojiTip({ char }: { char: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <Emoji char={char} size={30} />
      <span className="min-w-0 text-sm font-medium text-fg/85 break-words">{emojiName(char)}</span>
    </span>
  )
}

// The sprite carries no text, so the character rides along beside it, clipped
// out of sight, for anything that copies or reads the message. The crew's own
// carry their `:name:` there for the same reason: it is what somebody would type
// to write the picture again.
//
// The alignment rides on the tooltip rather than on the sprite, since the box it
// wraps what it holds in is a flex one and a flex item is not aligned by the
// line it stands in.
export function EmojiText({ text, quiet }: { text: string; quiet?: boolean }) {
  const sheet = useCustomEmoji()
  const tokens = useMemo(() => tokenizeEmoji(text), [text, sheet])
  return (
    <>
      {tokens.map((token, index) => {
        if (token.kind === 'text') return token.text
        const char = token.kind === 'emoji' ? token.entry.char : token.text
        return (
          <Fragment key={index}>
            <Tooltip label={<EmojiTip char={char} />} disabled={quiet} className="align-[-0.2em]">
              <Emoji char={char} size="1.15em" />
            </Tooltip>
            <span className="sr-only">{token.text}</span>
          </Fragment>
        )
      })}
    </>
  )
}
