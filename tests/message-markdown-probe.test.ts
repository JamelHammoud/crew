// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PathLocation } from '../src/shared/files'
import type { PooledAgent } from '../src/shared/llm'
import type { ThreadItem } from '../src/renderer/src/components/thread'

const located: Record<string, PathLocation> = {}
;(window as unknown as { crew: unknown }).crew = {
  locatePath: async (path: string): Promise<PathLocation> => located[path] ?? { kind: 'local', exists: false, dir: false }
}

const { default: ChatMessage } = await import('../src/renderer/src/components/ChatMessage')
const { default: MessageText } = await import('../src/renderer/src/components/MessageText')
const { useBrowser } = await import('../src/renderer/src/state/browser')
const { useCrew } = await import('../src/renderer/src/state/store')

const agent: PooledAgent = {
  id: 'jamel/bubbles',
  label: 'Bubbles',
  provider: 'claude',
  ownerId: 'jamel',
  ownerName: 'Jamel',
  status: 'idle',
  runs: {},
  settings: {},
  fields: []
}

const said = (text: string, extra: Partial<ThreadItem> = {}): ThreadItem => ({
  key: 'm1',
  ts: Date.parse('2026-08-07T12:00:00Z'),
  kind: 'message',
  author: 'Jamel',
  authorId: 'jamel',
  self: false,
  text,
  streaming: false,
  ...extra
})

const drawn = (text: string): HTMLElement => {
  const { container } = render(createElement(MessageText, { text }))
  return container.querySelector('.md') as HTMLElement
}

beforeEach(() => {
  for (const path of Object.keys(located)) delete located[path]
  useCrew.setState({ agents: [], members: [], docs: {}, boards: [], selfId: 'jamel' })
  useBrowser.setState({ tabs: [], activeTabId: null })
})

afterEach(cleanup)

describe('what somebody wrote, drawn as markdown', () => {
  it('reads a plain sentence as one paragraph with nothing added to it', () => {
    const body = drawn('ship it when the tests pass')

    expect(body.querySelectorAll('p')).toHaveLength(1)
    expect(body.textContent).toBe('ship it when the tests pass')
    expect(body.className).toContain('md-said')
  })

  it('draws the marks and leaves none of them on the page', () => {
    const body = drawn('**bold** and *thin* and `code` and ~~gone~~')

    expect(body.querySelector('strong')?.textContent).toBe('bold')
    expect(body.querySelector('em')?.textContent).toBe('thin')
    expect(body.querySelector('code')?.textContent).toBe('code')
    expect(body.querySelector('del')?.textContent).toBe('gone')
    expect(body.textContent).toBe('bold and thin and code and gone')
  })

  it('keeps a line ending as a line break', () => {
    const body = drawn('one\ntwo')

    expect(body.querySelectorAll('br')).toHaveLength(1)
    expect(body.querySelectorAll('p')).toHaveLength(1)
  })

  it('draws a list, and a task list with the app own box', () => {
    const list = drawn('- one\n- two\n- three')
    expect(list.querySelectorAll('ul > li')).toHaveLength(3)

    cleanup()
    const tasks = drawn('- [x] done\n- [ ] not yet')
    expect(tasks.querySelector('ul')?.className).toContain('md-tasks')
    expect(tasks.querySelectorAll('li.md-task')).toHaveLength(2)
    expect(tasks.querySelectorAll('.md-check')).toHaveLength(2)
    expect(tasks.querySelectorAll('.md-check[data-checked]')).toHaveLength(1)
  })

  it('draws a heading, a quote, a rule and a table', () => {
    const body = drawn('## what is left\n\n> nothing\n\n---\n\n| a | b |\n| --- | ---: |\n| 1 | 2 |')

    expect(body.querySelector('h2')?.textContent).toBe('what is left')
    expect(body.querySelector('blockquote')?.textContent).toContain('nothing')
    expect(body.querySelector('hr')).toBeTruthy()
    expect(body.querySelector('.table-scroll table')).toBeTruthy()
    expect(body.querySelectorAll('th')).toHaveLength(2)
    expect(body.querySelectorAll('tbody td')).toHaveLength(2)
    expect((body.querySelectorAll('th')[1] as HTMLElement).style.textAlign).toBe('right')
  })

  it('quotes a fence as it was written', () => {
    const body = drawn('try this\n\n```ts\nconst n = 1 * 2\n```')

    expect(body.querySelector('pre code')?.textContent).toBe('const n = 1 * 2')
    expect(body.querySelector('pre em')).toBeNull()
  })

  it('leaves a name inside a fence as the words it was typed in', () => {
    useCrew.setState({ agents: [agent] })
    const body = drawn('```\nask @Bubbles first\n```')

    expect(body.querySelector('pre code')?.textContent).toBe('ask @Bubbles first')
    expect(body.querySelector('pre strong')).toBeNull()
  })
})

describe('the characters somebody really typed', () => {
  it('reads an apostrophe, a quote, an ampersand and an angle as themselves', () => {
    const body = drawn(`Today's changes & "the rest" of them, 5 > 4`)

    expect(body.textContent).toBe(`Today's changes & "the rest" of them, 5 > 4`)
  })

  it('reads them the same inside a mark and inside a table', () => {
    const body = drawn(`**Today's** and *a "quote"*\n\n| it's | b |\n| --- | --- |\n| 5 > 4 | c's |`)

    expect(body.querySelector('strong')?.textContent).toBe(`Today's`)
    expect(body.querySelector('em')?.textContent).toBe(`a "quote"`)
    expect(body.querySelector('th')?.textContent).toBe(`it's`)
    expect([...body.querySelectorAll('tbody td')].map(cell => cell.textContent)).toEqual(['5 > 4', `c's`])
  })

  it('reads them as themselves in backticks and in a fence', () => {
    const body = drawn('A `<br>` in a cell, and `a && b`\n\n```\nconst a = b < c && d > e\n```')

    expect([...body.querySelectorAll('p code')].map(code => code.textContent)).toEqual(['<br>', 'a && b'])
    expect(body.querySelector('pre code')?.textContent).toBe('const a = b < c && d > e')
  })

  it('reads a backslash escape as the character it was holding back', () => {
    const body = drawn('\\<not a tag\\> and \\*not thin\\*')

    expect(body.textContent).toBe('<not a tag> and *not thin*')
    expect(body.querySelector('em')).toBeNull()
  })

  it('leaves markup somebody typed as the characters they typed', () => {
    const body = drawn('an <img src=x onerror=boom> in a sentence')

    expect(body.textContent).toBe('an <img src=x onerror=boom> in a sentence')
    expect(body.querySelector('img')).toBeNull()
  })

  it('reads an escape a person wrote themselves, and leaves the rest of them alone', () => {
    const body = drawn('&amp; and &#39; and &#x3c; and &hellip; and &notreally;')

    expect(body.textContent).toBe("& and ' and < and &hellip; and &notreally;")
  })
})

describe('the crew own marks inside markdown', () => {
  it('still draws a name as a mention, bold or not', () => {
    useCrew.setState({ agents: [agent] })
    const body = drawn('**@Bubbles** and @Bubbles again')

    const chips = [...body.querySelectorAll('strong.cursor-default')]
    expect(chips.map(chip => chip.textContent)).toEqual(['@Bubbles', '@Bubbles'])
    expect(body.querySelector('strong strong.cursor-default')).toBeTruthy()
    expect(body.textContent).toBe('@Bubbles and @Bubbles again')
  })

  it('still opens a doc a message names', () => {
    useCrew.setState({ docs: { plan: { title: 'Plan', text: '# Plan' } }, docsTarget: null })
    const { container } = render(
      createElement(MessageText, { text: 'see **#Plan** for the rest', docMentions: [{ page: 'plan', title: 'Plan' }] })
    )
    const pill = container.querySelector('span > svg')?.parentElement

    expect(pill?.textContent).toBe('Plan')
    fireEvent.click(pill as HTMLElement)
    expect(useCrew.getState().docsTarget).toBe('plan')
  })

  it('opens a link in the panel rather than walking the window off the app', () => {
    const body = drawn('the [notes](https://example.com/notes) are here')
    const link = body.querySelector('a') as HTMLAnchorElement

    expect(link.textContent).toBe('notes')
    fireEvent.click(link)
    const tab = useBrowser.getState().tabs.at(-1)
    expect(tab?.url).toBe('https://example.com/notes')
  })

  it('still opens a file written in backticks', async () => {
    located['src/a.ts'] = { kind: 'repo', path: 'src/a.ts', exists: true, dir: false }
    const { container, rerender } = render(createElement(MessageText, { text: 'look at `src/a.ts`' }))
    await Promise.resolve()
    await Promise.resolve()
    rerender(createElement(MessageText, { text: 'look at `src/a.ts`' }))

    const chip = [...container.querySelectorAll('code')].find(el => el.textContent === 'src/a.ts')
    expect(chip).toBeTruthy()
    fireEvent.click(chip as HTMLElement)
    expect(useBrowser.getState().tabs.at(-1)?.path).toBe('src/a.ts')
  })
})

describe('where markdown is drawn', () => {
  it('draws it in the chat and leaves a thread reading plain', () => {
    const item = said('**ship it**')

    const chat = render(createElement(ChatMessage, { item, markdown: true }))
    expect(chat.container.querySelector('.md strong')?.textContent).toBe('ship it')
    cleanup()

    const thread = render(createElement(ChatMessage, { item }))
    expect(thread.container.querySelector('.md')).toBeNull()
    expect(thread.container.querySelector('p')?.textContent).toBe('**ship it**')
  })

  it('leaves a message of nothing but pictures large and unparsed', () => {
    const { container } = render(createElement(ChatMessage, { item: said('🔥🔥🔥'), markdown: true }))

    expect(container.querySelector('.md')).toBeNull()
    expect(container.querySelector('p')?.className).toContain('text-[32px]')
  })

  it('lands the edited marker at the end of what was written', () => {
    const item = said('one\n\n**two**', { editedTs: Date.parse('2026-08-07T12:05:00Z') })
    const { container } = render(createElement(ChatMessage, { item, markdown: true, linked: true }))

    const paragraphs = [...container.querySelectorAll('.md > p')]
    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[0].textContent).toBe('one')
    expect(paragraphs[1].textContent).toContain('(edited)')
    expect(screen.getByText('(edited)')).toBeTruthy()
  })
})
