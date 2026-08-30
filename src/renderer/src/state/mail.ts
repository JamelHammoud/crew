import { create } from 'zustand'
import type {
  MailAccountView,
  MailAddressView,
  MailAttachmentView,
  MailBridge,
  MailDraftView,
  MailDraftViewInput,
  MailMessageView,
  MailThreadQueryView,
  MailThreadStatePatch,
  MailThreadSummaryView,
  MailThreadView,
  MailboxId
} from '../../../shared/mail'

export type MailAccount = MailAccountView
export type MailAddress = MailAddressView
export type MailAttachment = MailAttachmentView
export type MailDraft = MailDraftView
export type MailDraftInput = MailDraftViewInput
export type MailMessage = MailMessageView
export type MailThread = MailThreadView
export type MailThreadQuery = MailThreadQueryView
export type MailThreadSummary = MailThreadSummaryView
export type { MailBridge, MailboxId }

interface StoredDraft {
  id: string
  accountId: string
  to: MailAddress[]
  cc: MailAddress[]
  bcc: MailAddress[]
  subject: string
  text: string
  html?: string
  attachments: MailAttachment[]
  replyTo?: string
  forwardOf?: string
  updatedAt: string
  minimized: boolean
  scheduledFor?: string
}

interface MailState {
  accounts: MailAccount[]
  threads: MailThreadSummary[]
  openThread: MailThread | null
  drafts: MailDraft[]
  loading: boolean
  syncing: boolean
  threadLoading: boolean
  ready: boolean
  online: boolean
  issue: string | null
  load: (query?: MailThreadQuery) => Promise<void>
  refresh: (query?: MailThreadQuery) => Promise<void>
  connect: (email: string, displayName: string, appPassword: string) => Promise<string | null>
  removeAccount: (accountId: string) => Promise<string | null>
  reconnect: (accountId: string, appPassword?: string) => Promise<string | null>
  updateAccount: (accountId: string, patch: { displayName?: string; signature?: string }) => Promise<string | null>
  showThread: (accountId: string, threadId: string) => Promise<void>
  closeThread: () => void
  setThreads: (
    accountId: string,
    ids: string[],
    patch: MailThreadStatePatch
  ) => Promise<string | null>
  makeDraft: (accountId: string, seed?: Partial<MailDraftInput>) => string
  changeDraft: (id: string, patch: Partial<MailDraft>) => void
  saveDraft: (id: string) => Promise<string | null>
  discardDraft: (id: string) => Promise<string | null>
  sendDraft: (id: string, sendAt?: string) => Promise<string | null>
  attach: (id: string, file: File) => Promise<string | null>
  saveAttachment: (messageId: string, attachmentId: string) => Promise<string | null>
  print: () => Promise<string | null>
  setOnline: (online: boolean) => void
}

const DRAFTS_KEY = 'crew.mail.drafts'
let currentQuery: MailThreadQuery = {}

type MailWindow = Window & { mail?: MailBridge }

const api = (): MailBridge | undefined => (window as MailWindow).mail

const problem = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback

const draftInput = (draft: MailDraft): MailDraftInput => ({
  id: draft.id,
  accountId: draft.accountId,
  to: draft.to,
  cc: draft.cc,
  bcc: draft.bcc,
  subject: draft.subject,
  text: draft.text,
  html: draft.html,
  attachments: draft.attachments,
  replyTo: draft.replyTo,
  forwardOf: draft.forwardOf
})

const fromStored = (draft: StoredDraft): MailDraft => ({
  ...draft,
  saving: false,
  saved: true,
  sending: false
})

const storedDrafts = (): MailDraft[] => {
  try {
    const value = globalThis.localStorage?.getItem(DRAFTS_KEY)
    if (!value) return []
    const parsed = JSON.parse(value) as StoredDraft[]
    return Array.isArray(parsed) ? parsed.map(fromStored) : []
  } catch {
    return []
  }
}

const rememberDrafts = (drafts: MailDraft[]): void => {
  const stored: StoredDraft[] = drafts.map(
    ({ saving: _saving, saved: _saved, sending: _sending, problem: _problem, ...draft }) => draft
  )
  globalThis.localStorage?.setItem(DRAFTS_KEY, JSON.stringify(stored))
}

const replaceAccount = (accounts: MailAccount[], account: MailAccount): MailAccount[] =>
  accounts.some(one => one.id === account.id)
    ? accounts.map(one => (one.id === account.id ? account : one))
    : [...accounts, account]

const patchThreads = (
  threads: MailThreadSummary[],
  accountId: string,
  ids: Set<string>,
  patch: MailThreadStatePatch
): MailThreadSummary[] =>
  threads.map(thread => {
    if (thread.accountId !== accountId || !ids.has(thread.id)) return thread
    const mailboxIds = patch.mailboxId
      ? [...thread.mailboxIds.filter(id => !['inbox', 'spam', 'trash'].includes(id)), patch.mailboxId]
      : thread.mailboxIds
    const labelIds = patch.addLabelId
      ? [...new Set([...thread.labelIds, patch.addLabelId])]
      : patch.removeLabelId
        ? thread.labelIds.filter(id => id !== patch.removeLabelId)
        : thread.labelIds
    return {
      ...thread,
      unread: patch.read === undefined ? thread.unread : !patch.read,
      starred: patch.starred ?? thread.starred,
      mailboxIds,
      labelIds
    }
  })

export const useMail = create<MailState>((set, get) => ({
  accounts: [],
  threads: [],
  openThread: null,
  drafts: storedDrafts(),
  loading: false,
  syncing: false,
  threadLoading: false,
  ready: false,
  online: navigator.onLine,
  issue: null,

  load: async query => {
    const mail = api()
    if (!mail) {
      set({ ready: true, loading: false, issue: 'Mail is unavailable. Restart Crew and try again.' })
      return
    }
    currentQuery = query ?? {}
    set({ loading: true })
    try {
      const [accounts, threads] = await Promise.all([mail.listAccounts(), mail.listThreads(query ?? {})])
      set({ accounts, threads, ready: true, loading: false, issue: null })
    } catch (error) {
      set({ ready: true, loading: false, issue: problem(error, 'Mail could not be loaded.') })
    }
  },

  refresh: async query => {
    const mail = api()
    if (!mail) return
    set({ syncing: true, issue: null })
    currentQuery = query ?? currentQuery
    try {
      const synced = await mail.sync(query?.accountId)
      const threads = query ? await mail.listThreads(query) : synced.threads
      set({ accounts: synced.accounts, threads, syncing: false })
    } catch (error) {
      set({ syncing: false, issue: problem(error, 'Mail could not be refreshed.') })
    }
  },

  connect: async (email, displayName, appPassword) => {
    const mail = api()
    if (!mail) return 'Mail is unavailable. Restart Crew and try again.'
    try {
      const account = await mail.connectAccount({ email, displayName, appPassword })
      set(state => ({ accounts: replaceAccount(state.accounts, account), issue: null }))
      return null
    } catch (error) {
      return problem(error, 'That account could not be connected.')
    }
  },

  removeAccount: async accountId => {
    const mail = api()
    if (!mail) return 'Mail is unavailable. Restart Crew and try again.'
    try {
      await mail.removeAccount(accountId)
      set(state => ({
        accounts: state.accounts.filter(account => account.id !== accountId),
        threads: state.threads.filter(thread => thread.accountId !== accountId),
        openThread: state.openThread?.accountId === accountId ? null : state.openThread
      }))
      return null
    } catch (error) {
      return problem(error, 'That account could not be removed.')
    }
  },

  reconnect: async (accountId, appPassword) => {
    const mail = api()
    if (!mail) return 'Mail is unavailable. Restart Crew and try again.'
    try {
      const account = await mail.reconnectAccount(accountId, appPassword)
      set(state => ({ accounts: replaceAccount(state.accounts, account) }))
      return null
    } catch (error) {
      return problem(error, 'That account could not be reconnected.')
    }
  },

  updateAccount: async (accountId, patch) => {
    const mail = api()
    if (!mail) return 'Mail is unavailable. Restart Crew and try again.'
    try {
      const account = await mail.updateAccount(accountId, patch)
      set(state => ({ accounts: replaceAccount(state.accounts, account) }))
      return null
    } catch (error) {
      return problem(error, 'Those changes could not be saved.')
    }
  },

  showThread: async (accountId, threadId) => {
    const mail = api()
    if (!mail) return
    set({ threadLoading: true, openThread: null })
    try {
      const thread = await mail.getThread(accountId, threadId)
      set({ openThread: thread, threadLoading: false })
      if (thread.unread) void get().setThreads(accountId, [thread.id], { read: true })
    } catch (error) {
      set({ threadLoading: false, issue: problem(error, 'That conversation could not be opened.') })
    }
  },

  closeThread: () => set({ openThread: null, threadLoading: false }),

  setThreads: async (accountId, ids, patch) => {
    const mail = api()
    if (!mail) return 'Mail is unavailable. Restart Crew and try again.'
    const before = get().threads
    const selected = new Set(ids)
    let nextThreads = patchThreads(before, accountId, selected, patch)
    if (patch.mailboxId && currentQuery.mailboxId && patch.mailboxId !== currentQuery.mailboxId) {
      nextThreads = nextThreads.filter(thread => thread.accountId !== accountId || !selected.has(thread.id))
    }
    if (currentQuery.mailboxId === 'starred' && patch.starred === false) {
      nextThreads = nextThreads.filter(thread => thread.accountId !== accountId || !selected.has(thread.id))
    }
    set({
      threads: nextThreads,
      openThread: get().openThread && selected.has(get().openThread!.id)
        ? ({ ...patchThreads([get().openThread!], accountId, selected, patch)[0] } as MailThread)
        : get().openThread
    })
    try {
      await mail.setThreadState(accountId, ids, patch)
      return null
    } catch (error) {
      set({ threads: before })
      return problem(error, 'That change could not be saved.')
    }
  },

  makeDraft: (accountId, seed = {}) => {
    const id = `draft:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
    const account = get().accounts.find(one => one.id === accountId)
    const draft: MailDraft = {
      id,
      accountId,
      to: seed.to ?? [],
      cc: seed.cc ?? [],
      bcc: seed.bcc ?? [],
      subject: seed.subject ?? '',
      text: seed.text ?? account?.signature ?? '',
      html: seed.html,
      attachments: seed.attachments ?? [],
      replyTo: seed.replyTo,
      forwardOf: seed.forwardOf,
      updatedAt: new Date().toISOString(),
      minimized: false,
      saving: false,
      saved: false,
      sending: false
    }
    const drafts = [...get().drafts, draft]
    set({ drafts })
    rememberDrafts(drafts)
    return id
  },

  changeDraft: (id, patch) => {
    const drafts = get().drafts.map(draft =>
      draft.id === id
        ? { ...draft, ...patch, updatedAt: new Date().toISOString(), saved: patch.saved ?? false, problem: undefined }
        : draft
    )
    set({ drafts })
    rememberDrafts(drafts)
  },

  saveDraft: async id => {
    const mail = api()
    const draft = get().drafts.find(one => one.id === id)
    if (!draft || !mail || draft.sending) return null
    set(state => ({ drafts: state.drafts.map(one => (one.id === id ? { ...one, saving: true } : one)) }))
    try {
      const saved = await mail.saveDraft(draftInput(draft))
      const drafts = get().drafts.map(one =>
        one.id === id ? { ...one, id: saved.id, updatedAt: saved.updatedAt, saving: false, saved: true } : one
      )
      set({ drafts })
      rememberDrafts(drafts)
      return null
    } catch (error) {
      const message = problem(error, 'This draft could not be saved.')
      set(state => ({
        drafts: state.drafts.map(one => (one.id === id ? { ...one, saving: false, problem: message } : one))
      }))
      return message
    }
  },

  discardDraft: async id => {
    const mail = api()
    const draft = get().drafts.find(one => one.id === id)
    if (!draft) return null
    try {
      if (mail) await mail.discardDraft(draft.accountId, draft.id)
      const drafts = get().drafts.filter(one => one.id !== id)
      set({ drafts })
      rememberDrafts(drafts)
      return null
    } catch (error) {
      return problem(error, 'This draft could not be discarded.')
    }
  },

  sendDraft: async (id, sendAt) => {
    const mail = api()
    const draft = get().drafts.find(one => one.id === id)
    if (!draft || !mail) return 'Mail is unavailable. Restart Crew and try again.'
    if (draft.to.length + draft.cc.length + draft.bcc.length === 0) return 'Add at least one recipient.'
    set(state => ({ drafts: state.drafts.map(one => (one.id === id ? { ...one, sending: true } : one)) }))
    try {
      await mail.sendDraft(draftInput(draft), sendAt)
      const drafts = get().drafts.filter(one => one.id !== id)
      set({ drafts })
      rememberDrafts(drafts)
      return null
    } catch (error) {
      const message = problem(error, sendAt ? 'This message could not be scheduled.' : 'This message could not be sent.')
      set(state => ({
        drafts: state.drafts.map(one => (one.id === id ? { ...one, sending: false, problem: message } : one))
      }))
      return message
    }
  },

  attach: async (id, file) => {
    const mail = api()
    const draft = get().drafts.find(one => one.id === id)
    if (!mail || !draft) return 'That file could not be attached.'
    try {
      const attachment = await mail.addAttachment(draft.accountId, draft.id, file)
      get().changeDraft(id, { attachments: [...draft.attachments, attachment] })
      return null
    } catch (error) {
      return problem(error, 'That file could not be attached.')
    }
  },

  saveAttachment: async (messageId, attachmentId) => {
    const mail = api()
    const thread = get().openThread
    if (!mail || !thread) return 'That file could not be saved.'
    try {
      await mail.saveAttachment(thread.accountId, messageId, attachmentId)
      return null
    } catch (error) {
      return problem(error, 'That file could not be saved.')
    }
  },

  print: async () => {
    const mail = api()
    const thread = get().openThread
    if (!mail || !thread) return 'This conversation could not be printed.'
    try {
      await mail.printThread(thread.accountId, thread.id)
      return null
    } catch (error) {
      return problem(error, 'This conversation could not be printed.')
    }
  },

  setOnline: online => set({ online })
}))

let watching = false

export function watchMail(): () => void {
  if (watching) return () => {}
  watching = true
  const mail = api()
  const reload = () => void useMail.getState().load(currentQuery)
  const setOnline = () => useMail.getState().setOnline(navigator.onLine)
  const stopChanged = mail?.onChanged?.(reload)
  const stopOnline = mail?.onOnline?.(online => useMail.getState().setOnline(online))
  const stopConnection = mail?.onConnection?.(event => {
    useMail.setState(state => ({
      accounts: state.accounts.map(account =>
        account.id === event.accountId ? { ...account, status: event.status, problem: event.problem } : account
      )
    }))
  })
  const stopUnread = mail?.onUnread?.(event => {
    useMail.setState(state => ({
      accounts: state.accounts.map(account =>
        account.id === event.accountId ? { ...account, unread: event.unread } : account
      )
    }))
  })
  const stopNotificationOpen = mail?.onNotificationOpen?.(notification => {
    void useMail.getState().showThread(notification.accountId, notification.threadId)
  })
  window.addEventListener('online', setOnline)
  window.addEventListener('offline', setOnline)
  return () => {
    watching = false
    stopChanged?.()
    stopOnline?.()
    stopConnection?.()
    stopUnread?.()
    stopNotificationOpen?.()
    window.removeEventListener('online', setOnline)
    window.removeEventListener('offline', setOnline)
  }
}

export function mailApiAvailable(): boolean {
  return Boolean(api())
}
