import { marked, type Token, type Tokens } from 'marked'
import { useMemo, type CSSProperties, type ReactNode } from 'react'
import type { BoardMentionRef } from '../../../shared/design'
import type { DocMentionRef } from '../../../shared/docs'
import type { AgentMentionRef } from '../../../shared/llm'
import { openHref, parseFileRef, TextWithFileLinks } from './fileLinks'
import { MentionText } from './Mention'

interface Refs {
  mentionRefs?: AgentMentionRef[]
  docMentions?: DocMentionRef[]
  boardMentions?: BoardMentionRef[]
}

const LEX = { ...marked.getDefaults(), breaks: true }

const HEADINGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const

const sideOf = (side: Tokens.Table['align'][number] | undefined): CSSProperties | undefined =>
  side ? { textAlign: side } : undefined

const kidsOf = (token: Token): Token[] => ('tokens' in token && token.tokens ? token.tokens : [])

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

const charOf = (code: string): string | null => {
  const at = Number(code[1] === 'x' || code[1] === 'X' ? `0x${code.slice(2)}` : code.slice(1))
  return Number.isInteger(at) && at >= 0 && at <= 0x10ffff ? String.fromCodePoint(at) : null
}

const plain = (text: string): string =>
  text.includes('&')
    ? text.replace(
        /&(#\d+|#[Xx][\da-fA-F]+|[a-zA-Z]+);/g,
        (whole, code: string) => (code[0] === '#' ? charOf(code) : NAMED[code.toLowerCase()]) ?? whole
      )
    : text

function Words({ text, refs }: { text: string; refs: Refs }) {
  return (
    <MentionText
      text={text}
      mentionRefs={refs.mentionRefs}
      docMentions={refs.docMentions}
      boardMentions={refs.boardMentions}
    />
  )
}

function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      onClick={event => {
        event.preventDefault()
        event.stopPropagation()
        openHref(href)
      }}
    >
      {children}
    </a>
  )
}

function Inline({ tokens, refs }: { tokens: Token[]; refs: Refs }) {
  return (
    <>
      {tokens.map((token, index) => {
        const nested = kidsOf(token)
        switch (token.type) {
          case 'strong':
            return (
              <strong key={index}>
                <Inline tokens={nested} refs={refs} />
              </strong>
            )
          case 'em':
            return (
              <em key={index}>
                <Inline tokens={nested} refs={refs} />
              </em>
            )
          case 'del':
            return (
              <del key={index}>
                <Inline tokens={nested} refs={refs} />
              </del>
            )
          case 'codespan': {
            const code = plain(token.text)
            return parseFileRef(code) ? <TextWithFileLinks key={index} text={code} /> : <code key={index}>{code}</code>
          }
          case 'link':
            return (
              <Link key={index} href={token.href}>
                <Inline tokens={nested} refs={refs} />
              </Link>
            )
          case 'image':
            return <img key={index} src={token.href} alt={plain(token.text)} />
          case 'br':
            return <br key={index} />
          case 'escape':
            return plain(token.text)
          case 'html':
            return token.text
          case 'text':
            return nested.length > 0 ? (
              <Inline key={index} tokens={nested} refs={refs} />
            ) : (
              <Words key={index} text={plain(token.text)} refs={refs} />
            )
          default:
            return <Words key={index} text={token.raw ?? ''} refs={refs} />
        }
      })}
    </>
  )
}

function List({ list, refs }: { list: Tokens.List; refs: Refs }) {
  const tasks = list.items.some(item => item.task)
  const rows = list.items.map((item, index) => (
    <li key={index} className={item.task ? 'md-task' : undefined}>
      {item.task && <span className="md-check" data-checked={item.checked ? '' : undefined} />}
      <Blocks tokens={item.tokens} refs={refs} />
    </li>
  ))
  const marks = tasks ? 'md-tasks' : undefined
  if (!list.ordered) return <ul className={marks}>{rows}</ul>
  return (
    <ol className={marks} start={Number(list.start) || 1}>
      {rows}
    </ol>
  )
}

function Table({ table, refs }: { table: Tokens.Table; refs: Refs }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {table.header.map((cell, index) => (
              <th key={index} style={sideOf(table.align[index] ?? undefined)}>
                <Inline tokens={cell.tokens} refs={refs} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, at) => (
            <tr key={at}>
              {row.map((cell, index) => (
                <td key={index} style={sideOf(table.align[index] ?? undefined)}>
                  <Inline tokens={cell.tokens} refs={refs} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Block({ token, refs, tail }: { token: Token; refs: Refs; tail?: ReactNode }) {
  const nested = kidsOf(token)
  switch (token.type) {
    case 'space':
    case 'def':
      return null
    case 'paragraph':
      return (
        <p>
          <Inline tokens={nested} refs={refs} />
          {tail}
        </p>
      )
    case 'text':
      return (
        <>
          {nested.length > 0 ? <Inline tokens={nested} refs={refs} /> : <Words text={token.text} refs={refs} />}
          {tail}
        </>
      )
    case 'heading': {
      const Tag = HEADINGS[Math.min(Math.max(token.depth, 1), 6) - 1]
      return (
        <Tag>
          <Inline tokens={nested} refs={refs} />
          {tail}
        </Tag>
      )
    }
    case 'code':
      return (
        <>
          <pre>
            <code>{token.text}</code>
          </pre>
          {tail}
        </>
      )
    case 'blockquote':
      return (
        <>
          <blockquote>
            <Blocks tokens={nested} refs={refs} />
          </blockquote>
          {tail}
        </>
      )
    case 'list':
      return (
        <>
          <List list={token as Tokens.List} refs={refs} />
          {tail}
        </>
      )
    case 'table':
      return (
        <>
          <Table table={token as Tokens.Table} refs={refs} />
          {tail}
        </>
      )
    case 'hr':
      return (
        <>
          <hr />
          {tail}
        </>
      )
    case 'html':
      return (
        <p>
          {token.text}
          {tail}
        </p>
      )
    default:
      return (
        <p>
          <Words text={token.raw ?? ''} refs={refs} />
          {tail}
        </p>
      )
  }
}

function lastSaid(tokens: Token[]): number {
  for (let index = tokens.length - 1; index >= 0; index--) {
    if (tokens[index].type !== 'space' && tokens[index].type !== 'def') return index
  }
  return -1
}

function Blocks({ tokens, refs, tail }: { tokens: Token[]; refs: Refs; tail?: ReactNode }) {
  const end = lastSaid(tokens)
  return (
    <>
      {tokens.map((token, index) => (
        <Block key={index} token={token} refs={refs} tail={index === end ? tail : undefined} />
      ))}
      {end === -1 ? tail : null}
    </>
  )
}

export default function MessageText({
  text,
  mentionRefs,
  docMentions,
  boardMentions,
  className = '',
  tail
}: {
  text: string
  mentionRefs?: AgentMentionRef[]
  docMentions?: DocMentionRef[]
  boardMentions?: BoardMentionRef[]
  className?: string
  tail?: ReactNode
}) {
  const refs = useMemo(() => ({ mentionRefs, docMentions, boardMentions }), [mentionRefs, docMentions, boardMentions])
  const blocks = useMemo(() => marked.lexer(text, LEX), [text])
  return (
    <div className={`md md-said select-text ${className}`}>
      <Blocks tokens={blocks} refs={refs} tail={tail} />
    </div>
  )
}
