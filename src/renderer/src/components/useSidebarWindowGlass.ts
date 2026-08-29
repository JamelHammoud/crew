import { useEffect } from 'react'
import { usePrefs } from '../state/prefs'

export default function useSidebarWindowGlass(): boolean {
  const glass = usePrefs().glassSidebar

  useEffect(() => {
    const root = document.getElementById('root')
    root?.classList.toggle('sidebar-window-glass', glass)
    return () => root?.classList.remove('sidebar-window-glass')
  }, [glass])

  return glass
}
