import { create } from 'zustand'
import type { LivePlace } from '../../../shared/places'
import type { RecentJoin, RecentProject } from '../../../shared/recent'
import type { LiveThread } from '../../../shared/threads'
import { placesOf, type Place } from '../views/home/place'

type PlacesState = {
  places: Place[]
  live: LivePlace[]
  load: () => Promise<void>
  move: (key: string, to: number) => void
}

const ORDER_KEY = 'crew.project-order'

function savedOrder(): string[] {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(ORDER_KEY) ?? '[]')
    return Array.isArray(saved) ? saved.filter((key): key is string => typeof key === 'string') : []
  } catch {
    return []
  }
}

function arranged(places: Place[]): Place[] {
  const order = savedOrder()
  if (order.length === 0) return places
  const byKey = new Map(places.map(place => [place.key, place]))
  const known = order.flatMap(key => {
    const place = byKey.get(key)
    if (!place) return []
    byKey.delete(key)
    return [place]
  })
  return [...places.filter(place => byKey.has(place.key)), ...known]
}

function keepOrder(places: Place[]): void {
  try {
    globalThis.localStorage?.setItem(ORDER_KEY, JSON.stringify(places.map(place => place.key)))
  } catch {
    return
  }
}

export const usePlaces = create<PlacesState>(set => ({
  places: [],
  live: [],
  load: async () => {
    const [projects, joins, live] = await Promise.all([
      window.crew?.projects?.().catch(() => [] as RecentProject[]) ?? [],
      window.crew?.recentJoins?.().catch(() => [] as RecentJoin[]) ?? [],
      window.crew?.liveProjects?.().catch(() => [] as LivePlace[]) ?? []
    ])
    set({ places: arranged(placesOf(projects, joins)), live })
  },
  move: (key, to) =>
    set(state => {
      const from = state.places.findIndex(place => place.key === key)
      if (from < 0 || to === from || to < 0 || to >= state.places.length) return {}
      const places = [...state.places]
      places.splice(to, 0, ...places.splice(from, 1))
      keepOrder(places)
      return { places }
    })
}))

export const isLive = (live: LivePlace[], key: string): boolean => live.some(place => place.key === key)

export const threadsIn = (live: LivePlace[], key: string): LiveThread[] =>
  live.find(place => place.key === key)?.threads ?? []

window.crew?.onLive?.(live => {
  usePlaces.setState({ live })
  void usePlaces.getState().load()
})
