import type { PointerEvent as Press } from 'react'
import type { LiveThread } from '../../../../shared/threads'
import type { Place } from '../../views/home/place'

export const NO_THREADS: LiveThread[] = []

export const THREADS_SHOWN = 6

export interface PlaceGroupProps {
  place: Place
  here: boolean
  busy: boolean
  stoppable: boolean
  threads: LiveThread[]
  openThreadIds: string[]
  onOpen: (place: Place) => void
  onOpenWindow: (place: Place) => void
  onOpenThread: (place: Place, threadId: string, toRight: boolean) => void
  onStop: (place: Place) => void
  onRename: (place: Place, name: string) => void
  onForget: (place: Place) => void
  take: (id: string) => (event: Press) => void
  dragged: () => boolean
}

export interface ThreadRowProps {
  thread: LiveThread
  open: boolean
  here: boolean
  placeKey: string
  onOpen: (threadId: string) => void
  onOpenToRight: (threadId: string) => void
}

export const samePlace = (a: Place, b: Place): boolean =>
  a === b ||
  (a.key === b.key &&
    a.title === b.title &&
    a.line === b.line &&
    a.project?.folder === b.project?.folder &&
    a.project?.home === b.project?.home &&
    a.join?.link === b.join?.link &&
    a.join?.folder === b.join?.folder &&
    a.join?.name === b.join?.name)

export const sameLiveThread = (a: LiveThread, b: LiveThread): boolean =>
  a.id === b.id &&
  a.title === b.title &&
  a.working === b.working &&
  a.preview === b.preview

export const sameLiveThreads = (a: LiveThread[], b: LiveThread[]): boolean =>
  a === b || (a.length === b.length && a.every((thread, index) => sameLiveThread(thread, b[index])))

export const samePlaceGroup = (a: PlaceGroupProps, b: PlaceGroupProps): boolean =>
  a.here === b.here &&
  a.busy === b.busy &&
  a.stoppable === b.stoppable &&
  a.openThreadIds === b.openThreadIds &&
    a.onOpen === b.onOpen &&
    a.onOpenWindow === b.onOpenWindow &&
  a.onOpenThread === b.onOpenThread &&
  a.onStop === b.onStop &&
  a.onRename === b.onRename &&
  a.onForget === b.onForget &&
  a.take === b.take &&
  a.dragged === b.dragged &&
  samePlace(a.place, b.place) &&
  sameLiveThreads(a.threads, b.threads)

export const sameThreadRow = (a: ThreadRowProps, b: ThreadRowProps): boolean =>
  a.open === b.open &&
  a.here === b.here &&
  a.placeKey === b.placeKey &&
  a.onOpen === b.onOpen &&
  a.onOpenToRight === b.onOpenToRight &&
  sameLiveThread(a.thread, b.thread)
