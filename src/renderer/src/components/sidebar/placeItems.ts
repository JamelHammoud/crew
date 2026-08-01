import type { LiveThread } from '../../../../shared/threads'
import type { Place } from '../../views/home/place'

export const NO_THREADS: LiveThread[] = []

export const samePlace = (a: Place, b: Place): boolean =>
  a === b ||
  (a.key === b.key &&
    a.title === b.title &&
    a.project?.folder === b.project?.folder &&
    a.project?.home === b.project?.home &&
    a.join?.link === b.join?.link &&
    a.join?.folder === b.join?.folder &&
    a.join?.name === b.join?.name)

export const sameLiveThread = (a: LiveThread, b: LiveThread): boolean =>
  a.id === b.id && a.title === b.title && a.working === b.working

export const sameLiveThreads = (a: LiveThread[], b: LiveThread[]): boolean =>
  a === b || (a.length === b.length && a.every((thread, index) => sameLiveThread(thread, b[index])))
