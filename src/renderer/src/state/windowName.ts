import { useEffect } from 'react'
import { windowName } from '../../../shared/windowName'
import { placeTitle } from '../views/home/place'
import { savedNames } from './placeNames'
import { usePlaces } from './places'
import { useCrew } from './store'

export function useWindowName(showing: string): void {
  const place = useCrew(s => s.place)
  const folder = useCrew(s => s.folder)
  const link = useCrew(s => s.joinLink)
  const named = usePlaces(s => s.places.find(one => one.key === place)?.title ?? '')

  useEffect(() => {
    document.title = windowName(named || placeTitle(place, folder, link, savedNames()), showing)
  }, [named, place, folder, link, showing])
}
