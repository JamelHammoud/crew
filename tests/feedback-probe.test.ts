// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import About from '../src/renderer/src/components/settings/About'
import { REPORT_LIMIT } from '../src/shared/bugReport'

let opened: string[] = []
let opens = true
let copied: string[] = []

beforeEach(() => {
  opened = []
  copied = []
  opens = true
  vi.stubGlobal('window', window)
  Object.defineProperty(window, 'crew', {
    configurable: true,
    value: {
      appVersion: () => Promise.resolve('0.1.0'),
      systemInfo: () =>
        Promise.resolve({ version: '0.1.0', platform: 'darwin', release: '25.5.0', arch: 'arm64' }),
      openExternal: (url: string) => {
        opened.push(url)
        return Promise.resolve(opens)
      }
    }
  })
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: (text: string) => {
        copied.push(text)
        return Promise.resolve()
      }
    }
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const card = () => screen.getByRole('dialog')

const write = async (said: string) => {
  render(createElement(About))
  fireEvent.click(screen.getByRole('button', { name: 'Write a report' }))
  await waitFor(() => expect(within(card()).getByLabelText('Report')).toBeTruthy())
  fireEvent.change(within(card()).getByLabelText('Report'), { target: { value: said } })
}

describe('reporting a problem', () => {
  it('stands on the About page and opens a card', async () => {
    render(createElement(About))
    expect(screen.getByText('Report a problem')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Write a report' }))
    expect(within(card()).getByLabelText('Report')).toBeTruthy()
    expect(within(card()).getByRole('button', { name: 'Send' })).toBeTruthy()
  })

  it('sends nothing until something has been written', async () => {
    await write('   ')
    expect(within(card()).getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(true)
  })

  it('hands the words and the machine to one address', async () => {
    await write('The panel went blank')
    fireEvent.click(within(card()).getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(opened.length).toBe(1))
    const asked = new URL(opened[0]).searchParams
    expect(opened[0].startsWith('mailto:devjamel@gmail.com?')).toBe(true)
    expect(asked.get('subject')).toBe('Crew 0.1.0 bug report')
    expect(asked.get('body')).toBe('The panel went blank\n\nCrew 0.1.0\nmacOS 25.5.0 arm64')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('keeps the words and says the address when no mail app opened', async () => {
    opens = false
    await write('The panel went blank')
    fireEvent.click(within(card()).getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(within(card()).getByText(/No mail app opened/)).toBeTruthy())
    expect(within(card()).getByText('devjamel@gmail.com')).toBeTruthy()
    expect((within(card()).getByLabelText('Report') as HTMLTextAreaElement).value).toBe(
      'The panel went blank'
    )

    fireEvent.click(within(card()).getByRole('button', { name: 'Copy the report' }))
    await waitFor(() => expect(copied).toEqual(['The panel went blank\n\nCrew 0.1.0\nmacOS 25.5.0 arm64']))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('stops taking words where the shell stops reading them', async () => {
    await write('anything')
    expect(within(card()).getByLabelText('Report').getAttribute('maxlength')).toBe(String(REPORT_LIMIT))
  })

  it('holds no solid grey, since the card it stands on is glass', async () => {
    await write('The panel went blank')
    for (const el of card().querySelectorAll('*')) {
      expect(el.getAttribute('class') ?? '').not.toMatch(/text-fg-(muted|faint|secondary)/)
    }
  })
})
