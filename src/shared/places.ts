import type { LiveThread } from './threads'

export interface LivePlace {
  key: string
  folder: string
  name: string
  hosting: boolean
  threads: LiveThread[]
}

// The events that change which threads a place is showing and the order they
// stand in. Everything else a run emits, a step above all, would push the whole
// list again for nothing.
export const RESHAPES_THREADS = new Set([
  'thread.started',
  'thread.status',
  'thread.archived',
  'agent.start',
  'agent.end',
  'message.route'
])

export const projectPlace = (folder: string): string => `project:${folder}`

export const joinPlace = (link: string): string => `join:${link}`
