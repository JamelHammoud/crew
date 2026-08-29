import { useEffect, useSyncExternalStore } from 'react'
import type { CreateStickyInput, Sticky, UpdateStickyInput } from '../../../shared/stickies'

const listeners = new Set<() => void>()
let snapshot: Sticky[] = []
let loaded = false
let loading: Promise<void> | null = null
let stop: (() => void) | null = null

function emit(): void {
  for (const listener of listeners) listener()
}

function replace(next: Sticky[]): void {
  snapshot = next
  loaded = true
  emit()
}

function upsert(sticky: Sticky): void {
  const at = snapshot.findIndex(one => one.id === sticky.id)
  replace(at < 0 ? [sticky, ...snapshot] : snapshot.map(one => (one.id === sticky.id ? sticky : one)))
}

export function stickyCreateInput(sticky: Sticky, patch: UpdateStickyInput): CreateStickyInput {
  const title = 'title' in patch ? patch.title : sticky.title
  return {
    title: title?.trim() || undefined,
    body: 'body' in patch ? (patch.body ?? '') : sticky.body,
    color: sticky.color,
    pinned: sticky.pinned
  }
}

export function stickyHasContent(input: CreateStickyInput): boolean {
  return Boolean(input.title?.trim() || input.body.trim())
}

export async function refreshStickies(): Promise<void> {
  const next = await window.crew.listStickies()
  replace(next)
}

export function startStickies(): Promise<void> {
  if (!stop) {
    stop = window.crew.onStickiesChanged((next?: Sticky[]) => {
      if (Array.isArray(next)) replace(next)
      else void refreshStickies()
    })
  }
  if (!loading) {
    loading = refreshStickies().finally(() => {
      loading = null
    })
  }
  return loading
}

export async function createSticky(input: CreateStickyInput): Promise<Sticky> {
  const sticky = await window.crew.createSticky(input)
  upsert(sticky)
  return sticky
}

export async function updateSticky(id: string, patch: UpdateStickyInput): Promise<Sticky | null> {
  const current = snapshot.find(one => one.id === id)
  if (current) upsert({ ...current, ...patch })
  const sticky = await window.crew.updateSticky(id, patch)
  if (sticky) upsert(sticky)
  return sticky
}

export async function deleteSticky(id: string): Promise<void> {
  snapshot = snapshot.filter(one => one.id !== id)
  emit()
  await window.crew.deleteSticky(id)
}

export function stickySnapshot(): Sticky[] {
  return snapshot
}

export function stickiesLoaded(): boolean {
  return loaded
}

export function useStickies(): Sticky[] {
  useEffect(() => {
    void startStickies()
  }, [])
  return useSyncExternalStore(
    listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    stickySnapshot
  )
}

export function useStickiesLoaded(): boolean {
  useEffect(() => {
    void startStickies()
  }, [])
  return useSyncExternalStore(
    listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    stickiesLoaded
  )
}
