import { useBrowser } from '../../state/browser'
import type { SidebarItemId } from '../../state/sidebarPins'
import { useCrew } from '../../state/store'
import type { Tab } from '../navTabs'

export function openSidebarItem(id: SidebarItemId, onTab: (tab: Tab) => void, onToolbox: () => void): void {
  if (id === 'plugins' || id === 'scheduled') {
    onTab(id)
    return
  }
  if (id === 'toolbox') {
    onToolbox()
    return
  }
  const browser = useBrowser.getState()
  browser.openPanel()
  if (id === 'files') browser.openFiles()
  else if (id === 'review') browser.openReview()
  else if (id === 'terminal') browser.addTerminal(undefined, useCrew.getState().folder)
  else if (id === 'web') browser.addTab()
  else browser.openPanel()
}
