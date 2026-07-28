// A voice thread is an ordinary thread somebody is talking to out loud. What
// the agent writes back is read by a voice on the asker's machine, so it is
// said in spoken words, and anything worth looking at rather than hearing is
// drawn as a card instead of described.

export interface VoiceFact {
  label: string
  value: string
}

export type VoiceCard =
  | { kind: 'facts'; title?: string; rows: VoiceFact[] }
  | { kind: 'list'; title?: string; items: string[] }
  | { kind: 'choice'; title?: string; options: string[] }
  | { kind: 'code'; title?: string; language?: string; text: string }
  | { kind: 'note'; title?: string; text: string }

export type VoiceCardKind = VoiceCard['kind']

export const TITLE_LIMIT = 48
export const LABEL_LIMIT = 32
export const VALUE_LIMIT = 64
export const ITEM_LIMIT = 120
export const OPTION_LIMIT = 40
export const TEXT_LIMIT = 800
export const ROWS_LIMIT = 8
export const ITEMS_LIMIT = 8
export const OPTIONS_LIMIT = 4
export const CARDS_LIMIT = 3
export const LANGUAGE_LIMIT = 16

const line = (value: unknown, limit: number): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, limit) : ''

const block = (value: unknown, limit: number): string =>
  typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim().slice(0, limit) : ''

const titled = <T extends object>(card: T, title: string): T => (title ? { ...card, title } : card)

const strings = (value: unknown, limit: number, count: number): string[] =>
  Array.isArray(value)
    ? value
        .map(item => line(item, limit))
        .filter(Boolean)
        .slice(0, count)
    : []

// What arrives is whatever a model wrote, so a card is only as good as this. One
// with nothing on it is not a card and comes back as null rather than as an
// empty box standing beside the orb.
export function cleanCard(raw: unknown): VoiceCard | null {
  if (!raw || typeof raw !== 'object') return null
  const card = raw as Record<string, unknown>
  const title = line(card.title, TITLE_LIMIT)
  if (card.kind === 'facts') {
    const rows = Array.isArray(card.rows)
      ? card.rows
          .map(row => {
            const entry = (row ?? {}) as Record<string, unknown>
            return { label: line(entry.label, LABEL_LIMIT), value: line(entry.value, VALUE_LIMIT) }
          })
          .filter(row => row.label !== '' || row.value !== '')
          .slice(0, ROWS_LIMIT)
      : []
    return rows.length > 0 ? titled({ kind: 'facts' as const, rows }, title) : null
  }
  if (card.kind === 'list') {
    const items = strings(card.items, ITEM_LIMIT, ITEMS_LIMIT)
    return items.length > 0 ? titled({ kind: 'list' as const, items }, title) : null
  }
  if (card.kind === 'choice') {
    const options = strings(card.options, OPTION_LIMIT, OPTIONS_LIMIT)
    return options.length > 0 ? titled({ kind: 'choice' as const, options }, title) : null
  }
  if (card.kind === 'code') {
    const text = block(card.text, TEXT_LIMIT)
    if (!text) return null
    const language = line(card.language, LANGUAGE_LIMIT).toLowerCase()
    return titled(language ? { kind: 'code' as const, language, text } : { kind: 'code' as const, text }, title)
  }
  if (card.kind === 'note') {
    const text = block(card.text, TEXT_LIMIT)
    return text ? titled({ kind: 'note' as const, text }, title) : null
  }
  return null
}

const CARD_FENCE = /^[ \t]*```[ \t]*card[ \t]*\r?\n([\s\S]*?)^[ \t]*```[ \t]*$/gim

// A card is a fenced block the agent writes beside its words. It is taken out
// of what gets said, because the whole point of one is that it is looked at.
export function readCards(text: string): { spoken: string; cards: VoiceCard[] } {
  const cards: VoiceCard[] = []
  const spoken = text.replace(CARD_FENCE, (whole, body: string) => {
    if (cards.length >= CARDS_LIMIT) return ''
    try {
      const card = cleanCard(JSON.parse(body))
      if (card) cards.push(card)
    } catch {
      return ''
    }
    return ''
  })
  return { spoken, cards }
}

const EMOJI = /[\p{Extended_Pictographic}\u{1f3fb}-\u{1f3ff}‍️]/gu

// Everything a page can show and a voice cannot say. Read straight, a reply
// comes out as "star star ready star star", and one stray backtick is enough to
// make the whole answer sound like it is being spelled out.
export function spokenText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/^[ \t]*```[\s\S]*?^[ \t]*```[ \t]*$/gim, '')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<https?:\/\/[^>\s]+>/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]*>[ \t]?/gm, '')
    .replace(/^[ \t]*([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, '')
    .replace(/^[ \t]*\|.*\|[ \t]*$/gm, row => row.replace(/\|/g, ' ').trim())
    .replace(/^[ \t]*[-*+][ \t]+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?;:]|$)/g, '$1$2')
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?;:]|$)/g, '$1$2')
    .replace(/(^|\s)@([\w-]+)/g, '$1$2')
    .replace(EMOJI, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Both halves of a reply in one pass: the words to say, and what to draw.
export function readReply(text: string): { spoken: string; cards: VoiceCard[] } {
  const { spoken, cards } = readCards(text)
  return { spoken: spokenText(spoken), cards }
}

export const VOICE_INSTRUCTIONS = [
  'This thread is a voice conversation. Every message here was spoken out loud, and your reply is read back by a voice, so write it the way you would say it.',
  'Answer in a sentence or two. Plain spoken words, no markdown, no headings, no bullet lists, no code, no emoji, and never read a file path or a URL out loud.',
  'Do the work you are asked to do as usual. When you have done something, say what you did in one line rather than listing it.',
  'When there is something worth looking at rather than hearing, put it on a card and keep saying your one line beside it. A card is a fenced block written exactly like this:',
  '```card',
  '{"kind":"facts","title":"Suite","rows":[{"label":"Passed","value":"84"},{"label":"Failed","value":"2"}]}',
  '```',
  `The kinds are facts with rows of label and value, list with items, choice with up to ${OPTIONS_LIMIT} options for someone to pick from out loud, code with text and an optional language, and note with text.`,
  `Write at most ${CARDS_LIMIT} cards, only when they earn their place, and never a card that just repeats what you said.`
].join('\n')
