// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import ChatMessage from '../src/renderer/src/components/ChatMessage'
import StepRow from '../src/renderer/src/components/StepRow'
import { useCrew } from '../src/renderer/src/state/store'
import type { ThreadItem } from '../src/renderer/src/components/thread'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

const styles = readFileSync(new URL('../src/renderer/src/styles.css', import.meta.url), 'utf8')

function boot(): void {
  useCrew.setState({
    connection: 'online',
    selfId: 'jamel',
    selfName: 'Jamel',
    members: [{ id: 'jamel', name: 'Jamel', connected: true }],
    agents: [],
    events: [],
    docs: {},
    threads: {},
    threadPrompts: {},
    threadDrafts: {},
    chatDraft: '',
    queues: {},
    steps: {},
    tokens: {},
    pending: {},
    openThreadId: null,
    docsTarget: null
  })
}

const item = (extra: Partial<ThreadItem>): ThreadItem => ({
  key: 'one',
  ts: 1,
  kind: 'message',
  author: 'Jamel',
  authorId: 'jamel',
  self: true,
  text: 'Ship it',
  streaming: false,
  ...extra
})

const selectable = (node: Element | null): boolean => Boolean(node?.closest('.select-text'))

describe('what is selectable', () => {
  afterEach(cleanup)

  it('holds the app to not selectable and lets fields and editable boxes back in', () => {
    const base = styles.slice(styles.indexOf('@layer base'), styles.indexOf('::selection'))
    expect(base).toMatch(/body\s*\{\s*user-select:\s*none/)
    expect(base).toMatch(/input,\s*\n\s*textarea,\s*\n\s*\[contenteditable\]/)
    expect(base).toMatch(/user-select:\s*text/)
  })

  it('opens what somebody wrote and leaves the name and the time shut', () => {
    boot()
    const { container } = render(createElement(ChatMessage, { item: item({}) }))
    const said = container.querySelector('p')
    expect(said?.textContent).toContain('Ship it')
    expect(selectable(said)).toBe(true)
    const name = Array.from(container.querySelectorAll('span')).find(el => el.textContent === 'Jamel')
    expect(name).toBeTruthy()
    expect(selectable(name ?? null)).toBe(false)
  })

  it('opens what an agent said', () => {
    boot()
    const { container } = render(
      createElement(ChatMessage, { item: item({ kind: 'reply', self: false, text: 'Done, see the diff.' }) })
    )
    const prose = container.querySelector('.md')
    expect(prose).toBeTruthy()
    expect(selectable(prose)).toBe(true)
  })

  it('opens a command and what it printed, and leaves the row it hangs off shut', () => {
    boot()
    const { container } = render(
      createElement(StepRow, {
        item: item({
          kind: 'tool',
          self: false,
          text: '',
          name: 'Bash',
          detail: 'yarn tsc --noEmit',
          output: 'no errors'
        })
      })
    )
    const row = container.querySelector('button')
    expect(selectable(row)).toBe(false)
    row?.click()
    const printed = Array.from(container.querySelectorAll('div')).find(el => el.textContent === 'no errors')
    expect(printed).toBeTruthy()
    expect(selectable(printed ?? null)).toBe(true)
  })
})
