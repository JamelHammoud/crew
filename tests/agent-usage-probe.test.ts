// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import AgentCard from '../src/renderer/src/components/AgentCard'
import type { PooledAgent } from '../src/shared/llm'

const agent: PooledAgent = {
  id: 'ali/codex',
  label: 'Codex',
  provider: 'codex',
  ownerId: 'ali',
  ownerName: 'ALI',
  status: 'idle',
  runs: {},
  settings: {},
  fields: [],
  usage: {
    provider: 'codex',
    fetchedAt: Date.now(),
    accountId: 'account-1',
    accountLabel: 'ali@example.com',
    plan: 'Pro',
    windows: [
      { key: 'session', label: '5-hour limit', percent: 63, resetsAt: Date.now() + 60 * 60 * 1000 },
      { key: 'weekly', label: 'Weekly limit', percent: 21 }
    ]
  }
}

describe('agent usage limits', () => {
  it('shows the complete usage snapshot inside its agent card', () => {
    const { container } = render(createElement(AgentCard, { agent, threadCount: 0, sharesUsageAccount: true }))
    const card = container.firstElementChild as HTMLElement
    const cardQueries = within(card)

    expect(cardQueries.getByText('Codex')).toBeTruthy()
    expect(cardQueries.getByText('Usage limits')).toBeTruthy()
    expect(cardQueries.getByText('Same account')).toBeTruthy()
    expect(cardQueries.getByText('ali@example.com · Pro plan')).toBeTruthy()
    expect(cardQueries.getByText('5-hour limit')).toBeTruthy()
    expect(cardQueries.getByText('63%')).toBeTruthy()
    expect(cardQueries.getByText('Weekly limit')).toBeTruthy()
    expect(cardQueries.getByText('21%')).toBeTruthy()
    expect(screen.getAllByText('Usage limits')).toHaveLength(1)
  })
})
