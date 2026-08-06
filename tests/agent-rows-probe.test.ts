// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { SettingSections } from '../src/renderer/src/components/agent/SettingRows'
import type { AgentSettingField } from '../src/shared/llm'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

const FIELDS: AgentSettingField[] = [
  {
    key: 'instructions',
    label: 'Instructions',
    kind: 'paragraph',
    default: '',
    line: 'Read before every message.'
  },
  { key: 'fallbackModel', label: 'If the model is busy', options: [], default: '', section: 'Model' },
  {
    key: 'dirs',
    label: 'Other folders it can read',
    kind: 'text',
    default: '',
    section: 'On this computer'
  },
  {
    key: 'crewOnly',
    label: 'Same on every machine',
    kind: 'switch',
    default: '',
    section: 'On this computer'
  }
]

const stand = (fields = FIELDS) => {
  const { container } = render(createElement(SettingSections, { fields, settings: {}, onChange: () => {} }))
  return Array.from(container.children)
}

const heading = (node: Element): boolean => node.tagName === 'H4'

afterEach(cleanup)

describe('the rows an agent is set up on', () => {
  it('stands every row and every section title in one list', () => {
    const rows = stand()
    expect(rows.map(node => (heading(node) ? `= ${node.textContent}` : (node.textContent ?? '').slice(0, 12)))).toEqual(
      ['Instructions', '= Model', 'If the model', '= On this computer', 'Other folder', 'Same on ever']
    )
  })

  it('carries a rule above every section title, so nothing stands adrift', () => {
    const rows = stand()
    for (const [at, node] of rows.entries()) {
      if (!heading(node)) continue
      const above = rows[at - 1]
      expect(above).toBeDefined()
      expect(heading(above)).toBe(false)
      expect(above.className).toContain('border-b')
    }
  })

  it('ends on a row rather than a title, so the one rule dropped is the last', () => {
    const rows = stand()
    expect(heading(rows[rows.length - 1])).toBe(false)
  })

  it('runs every rule the whole width of the card', () => {
    for (const node of stand()) {
      if (heading(node)) continue
      expect(node.className).toContain('-mx-6')
      expect(node.className).toContain('px-6')
    }
  })

  it('sets a section title on the list rather than on a page of its own', () => {
    const title = stand().find(heading)
    expect(title?.className).toContain('pt-5')
    expect(title?.className).not.toContain('pt-7')
  })

  it('says a section once, however many rows are under it', () => {
    stand()
    expect(screen.queryAllByText('On this computer')).toHaveLength(1)
  })
})
