import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Mail from '../src/renderer/src/views/Mail'
import type { MailBridge } from '../src/shared/mail'
import { useMail, type MailAccount, type MailThread, type MailThreadSummary } from '../src/renderer/src/state/mail'
import { installLocalStorage } from './helpers/local-storage'

let observedWidth = 1200
const observers = new Set<(entries: Array<{ contentRect: { width: number } }>) => void>()

class Observer {
  constructor(private readonly callback: (entries: Array<{ contentRect: { width: number } }>) => void) {}
  observe(): void {
    observers.add(this.callback)
    this.callback([{ contentRect: { width: observedWidth } }])
  }
  disconnect(): void {
    observers.delete(this.callback)
  }
}

const personal: MailAccount = {
  id: 'personal',
  email: 'jamel@gmail.com',
  displayName: 'Jamel',
  status: 'connected',
  unread: 1,
  labels: [{ id: 'travel', name: 'Travel', unread: 1 }]
}

const work: MailAccount = {
  id: 'work',
  email: 'jamel@crew.test',
  displayName: 'Jamel at Crew',
  status: 'connected',
  unread: 1,
  labels: []
}

const dinner: MailThreadSummary = {
  id: 'dinner',
  accountId: 'personal',
  subject: 'Dinner this weekend',
  participants: [{ name: 'Ali', email: 'ali@example.com' }],
  preview: 'Saturday works for everyone.',
  date: '2026-08-29T12:00:00.000Z',
  unread: true,
  starred: false,
  hasAttachments: true,
  messageCount: 2,
  mailboxIds: ['inbox'],
  labelIds: ['travel']
}

const release: MailThreadSummary = {
  id: 'release',
  accountId: 'work',
  subject: 'Release checklist',
  participants: [{ name: 'Sam', email: 'sam@crew.test' }],
  preview: 'The build is ready for the last pass.',
  date: '2026-08-29T13:00:00.000Z',
  unread: true,
  starred: true,
  messageCount: 1,
  mailboxIds: ['inbox'],
  labelIds: []
}

const dinnerThread: MailThread = {
  ...dinner,
  messages: [
    {
      id: 'dinner-one',
      threadId: dinner.id,
      accountId: personal.id,
      from: { name: 'Ali', email: 'ali@example.com' },
      to: [{ name: 'Jamel', email: personal.email }],
      cc: [],
      bcc: [],
      subject: dinner.subject,
      date: dinner.date,
      text: 'Would Saturday work?',
      unread: false,
      starred: false,
      attachments: []
    },
    {
      id: 'dinner-two',
      threadId: dinner.id,
      accountId: personal.id,
      from: { name: 'Jamel', email: personal.email },
      to: [{ name: 'Ali', email: 'ali@example.com' }],
      cc: [],
      bcc: [],
      subject: dinner.subject,
      date: dinner.date,
      text: 'Saturday works for everyone.',
      unread: true,
      starred: false,
      attachments: [{ id: 'menu', name: 'menu.pdf', mime: 'application/pdf', size: 1200 }]
    }
  ]
}

function makeBridge() {
  const accounts = [personal, work]
  const threads = [release, dinner]
  return {
    listAccounts: vi.fn(async () => accounts),
    connectAccount: vi.fn(async input => ({ ...personal, email: input.email, displayName: input.displayName })),
    removeAccount: vi.fn(async () => {}),
    reconnectAccount: vi.fn(async accountId => accounts.find(one => one.id === accountId)!),
    updateAccount: vi.fn(async (accountId, patch) => ({ ...accounts.find(one => one.id === accountId)!, ...patch })),
    listThreads: vi.fn(async query => {
      const selected = query.accountId ? threads.filter(thread => thread.accountId === query.accountId) : threads
      const find = query.query?.toLowerCase()
      return find ? selected.filter(thread => `${thread.subject} ${thread.preview}`.toLowerCase().includes(find)) : selected
    }),
    getThread: vi.fn(async () => dinnerThread),
    sync: vi.fn(async () => ({ accounts, threads })),
    setThreadState: vi.fn(async () => {}),
    saveDraft: vi.fn(async draft => ({ id: draft.id, updatedAt: new Date().toISOString() })),
    discardDraft: vi.fn(async () => {}),
    sendDraft: vi.fn(async () => {}),
    addAttachment: vi.fn(async (_accountId, _draftId, file) => ({ id: 'upload', name: file.name, mime: file.type, size: file.size })),
    saveAttachment: vi.fn(async () => {}),
    printThread: vi.fn(async () => {}),
    snoozeThread: vi.fn(async () => {}),
    onChanged: vi.fn((_listener: () => void) => () => {}),
    onOnline: vi.fn(() => () => {}),
    onConnection: vi.fn(() => () => {}),
    onUnread: vi.fn(() => () => {}),
    onNotification: vi.fn(() => () => {})
  } satisfies MailBridge
}

let bridge: ReturnType<typeof makeBridge>

function resetMail(): void {
  useMail.setState({
    accounts: [],
    threads: [],
    openThread: null,
    drafts: [],
    loading: false,
    syncing: false,
    threadLoading: false,
    ready: false,
    online: true,
    issue: null
  })
}

async function resize(width: number): Promise<void> {
  observedWidth = width
  await act(async () => {
    for (const callback of observers) callback([{ contentRect: { width } }])
  })
}

beforeEach(() => {
  observedWidth = 1200
  observers.clear()
  bridge = makeBridge()
  Object.assign(globalThis, { ResizeObserver: Observer, IS_REACT_ACT_ENVIRONMENT: true })
  Object.assign(window, {
    mail: bridge,
    crew: { openExternal: vi.fn(async () => true) }
  })
  Element.prototype.getAnimations ??= () => []
  document.execCommand = vi.fn(() => true)
  installLocalStorage().clear()
  resetMail()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('mail setup', () => {
  it('keeps the password storage note in the app password help', async () => {
    bridge.listAccounts.mockResolvedValue([])
    bridge.listThreads.mockResolvedValue([])
    render(createElement(Mail))

    const help = await screen.findByRole('button', { name: 'About app passwords' })
    expect(screen.queryByText('Your password stays on this computer.')).toBeNull()

    fireEvent.mouseEnter(help)

    expect(await screen.findByText('Your password stays on this computer.')).toBeTruthy()
  })

  it('validates and connects the first account', async () => {
    bridge.listAccounts.mockResolvedValue([])
    bridge.listThreads.mockResolvedValue([])
    render(createElement(Mail))

    const email = await screen.findByPlaceholderText('name@gmail.com')
    const name = screen.getByPlaceholderText('Name on sent mail')
    const password = screen.getByPlaceholderText('16 characters')
    const connect = screen.getByRole('button', { name: 'Connect' })
    expect((connect as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(email, { target: { value: 'new@gmail.com' } })
    fireEvent.change(name, { target: { value: 'New Person' } })
    fireEvent.change(password, { target: { value: 'aaaa bbbb cccc dddd' } })
    expect((connect as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(connect)

    await waitFor(() => expect(bridge.connectAccount).toHaveBeenCalledWith({
      email: 'new@gmail.com',
      displayName: 'New Person',
      appPassword: 'aaaabbbbccccdddd'
    }))
  })
})

describe('mail list and reader', () => {
  it('switches between a unified inbox and each account', async () => {
    render(createElement(Mail))
    expect(await screen.findByText('Release checklist')).toBeTruthy()
    expect(screen.getByText('Dinner this weekend')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Mail account' }))
    fireEvent.click(screen.getByRole('button', { name: /^jamel@gmail\.com/ }))
    await waitFor(() => expect(bridge.listThreads).toHaveBeenLastCalledWith(expect.objectContaining({ accountId: 'personal' })))
    expect(await screen.findByText('Dinner this weekend')).toBeTruthy()
    expect(screen.queryByText('Release checklist')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Mail account' }))
    fireEvent.click(screen.getByRole('button', { name: /All accounts/ }))
    await waitFor(() => expect(screen.getByText('Release checklist')).toBeTruthy())
  })

  it('keeps window chrome above the controls and one mailbox row selected', async () => {
    const { container } = render(createElement(Mail))
    const compose = await screen.findByRole('button', { name: 'Compose' })
    const sidebar = compose.closest('aside') as HTMLElement
    const chrome = sidebar.firstElementChild as HTMLElement

    expect(chrome.className).toContain('h-[70px]')
    expect(chrome.className).toContain('app-drag')
    expect(sidebar.className).toContain('bg-ink-900')
    expect(sidebar.className).not.toContain('bg-ink-800')
    expect(container.querySelectorAll('aside [data-selected]')).toHaveLength(1)

    const account = screen.getByRole('button', { name: 'Mail account' })
    const footer = account.parentElement?.parentElement as HTMLElement
    expect(footer.className).toContain('border-t')
    expect(footer.className).not.toMatch(/(?:^|\s)(?:m|mx)-/)
    expect(footer.nextElementSibling?.getAttribute('data-testid')).toBe('mail-account-modals')
  })

  it('opens a conversation by pointer and keyboard and offers reply actions', async () => {
    render(createElement(Mail))
    const row = await screen.findByRole('button', { name: /Ali.*Dinner this weekend/ })
    fireEvent.keyDown(row, { key: 'Enter' })

    await waitFor(() => expect(bridge.getThread).toHaveBeenCalledWith('personal', 'dinner'))
    expect(await screen.findByRole('heading', { name: 'Dinner this weekend' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reply' })).toBeTruthy()
    expect(screen.getByText('menu.pdf')).toBeTruthy()
  })

  it('moves a conversation to spam, changes labels, and snoozes it', async () => {
    render(createElement(Mail))
    fireEvent.click(await screen.findByRole('button', { name: /Ali.*Dinner this weekend/ }))
    await screen.findByRole('heading', { name: 'Dinner this weekend' })

    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Move to spam' }))
    await waitFor(() => expect(bridge.setThreadState).toHaveBeenCalledWith('personal', ['dinner'], { mailboxId: 'spam' }))

    fireEvent.click(screen.getByText('Labels').parentElement!)
    fireEvent.click(await screen.findByRole('button', { name: 'Travel' }))
    await waitFor(() => expect(bridge.setThreadState).toHaveBeenCalledWith('personal', ['dinner'], { removeLabelId: 'travel' }))

    fireEvent.click(screen.getByRole('button', { name: 'Snooze' }))
    expect(await screen.findByLabelText('Snooze until')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Snooze' }).at(-1)!)
    await waitFor(() => expect(bridge.snoozeThread).toHaveBeenCalledWith('personal', 'dinner', expect.any(Number)))
  })

  it('searches after typing and reports an empty result', async () => {
    render(createElement(Mail))
    const search = await screen.findByPlaceholderText('Search mail')
    fireEvent.change(search, { target: { value: 'missing words' } })

    expect(await screen.findByText('No mail found')).toBeTruthy()
    expect(bridge.listThreads).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'missing words' }))
  })

  it('keeps the current rows and scroll position while live mail reloads', async () => {
    let changed: (() => void) | undefined
    let finish: ((value: MailThreadSummary[]) => void) | undefined
    bridge.onChanged.mockImplementation(listener => {
      changed = listener
      return () => {}
    })
    render(createElement(Mail))

    const row = await screen.findByRole('button', { name: /Sam.*Release checklist/ })
    const scroller = row.closest('.overflow-y-auto') as HTMLDivElement
    scroller.scrollTop = 180
    bridge.listThreads.mockImplementationOnce(() => new Promise(resolve => (finish = resolve)))
    changed?.()

    await waitFor(() => expect(bridge.listThreads).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Release checklist')).toBeTruthy()
    expect(document.querySelectorAll('.skeleton')).toHaveLength(0)
    expect(scroller.scrollTop).toBe(180)

    await act(async () => finish?.([release, dinner]))
    expect(scroller.scrollTop).toBe(180)
  })

  it('shows loading, empty, offline, and retry states without removing navigation', async () => {
    let finish: ((value: MailThreadSummary[]) => void) | undefined
    bridge.listThreads.mockImplementation(() => new Promise(resolve => (finish = resolve)))
    useMail.setState({ accounts: [personal, work], ready: true, loading: true, online: false, issue: 'Mail could not be refreshed.' })
    render(createElement(Mail))

    expect(screen.getByText('Offline')).toBeTruthy()
    expect(screen.getByText('Mail could not be refreshed.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0)
    await act(async () => finish?.([]))
    expect(await screen.findByText('Inbox is clear')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Mail account' })).toBeTruthy()
  })
})

describe('mail composer', () => {
  it('commits recipients, autosaves changes, sends, and keeps errors in the card', async () => {
    render(createElement(Mail))
    fireEvent.click(await screen.findByRole('button', { name: 'Compose' }))
    const to = screen.getByRole('textbox', { name: 'To' })
    fireEvent.change(to, { target: { value: 'ali@example.com' } })
    fireEvent.keyDown(to, { key: 'Enter' })
    fireEvent.change(screen.getByRole('textbox', { name: 'Subject' }), { target: { value: 'A new note' } })

    await waitFor(() => expect(bridge.saveDraft).toHaveBeenCalledWith(expect.objectContaining({
      to: [{ email: 'ali@example.com' }],
      subject: 'A new note'
    })), { timeout: 2_000 })

    bridge.sendDraft.mockRejectedValueOnce(new Error('The message could not be sent.'))
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText(/The message could not be sent/)).toBeTruthy()
  })

  it('opens send later and submits an explicit schedule time', async () => {
    render(createElement(Mail))
    fireEvent.click(await screen.findByRole('button', { name: 'Compose' }))
    const draftId = useMail.getState().drafts[0].id
    act(() => useMail.getState().changeDraft(draftId, { to: [{ email: 'ali@example.com' }] }))
    fireEvent.click(screen.getByRole('button', { name: 'Send later' }))
    const schedule = await screen.findByRole('button', { name: 'Schedule' })
    fireEvent.click(schedule)

    await waitFor(() => expect(bridge.sendDraft).toHaveBeenCalledWith(
      expect.objectContaining({ id: draftId, to: [{ email: 'ali@example.com' }] }),
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    ))
  })
})

describe('responsive mail', () => {
  it('turns mailboxes, list, and reader into separate narrow screens', async () => {
    observedWidth = 560
    render(createElement(Mail))
    expect(await screen.findByRole('button', { name: 'Mailboxes' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Compose' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Mailboxes' }))
    expect(await screen.findByRole('button', { name: 'Compose' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to mail' }))
    const row = await screen.findByRole('button', { name: /Ali.*Dinner this weekend/ })
    fireEvent.click(row)
    expect(await screen.findByRole('button', { name: 'Back' })).toBeTruthy()

    await resize(760)
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy()
    await resize(1100)
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Compose' })).toBeTruthy()
  })
})
