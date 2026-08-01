import { create } from 'zustand'
import type { LivePlace } from '../../../shared/places'
import type { RecentJoin, RecentProject } from '../../../shared/recent'
import { placesOf, type Place } from '../views/home/place'

type PlacesState = {
  places: Place[]
  live: LivePlace[]
  load: () => Promise<void>
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
    set({ places: placesOf(projects, joins), live })
  }
}))

export const isLive = (live: LivePlace[], key: string): boolean => live.some(place => place.key === key)

window.crew?.onLive?.(live => {
  usePlaces.setState({ live })
  void usePlaces.getState().load()
})
