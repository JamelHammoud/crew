import { makeTab, useBrowser } from '../../state/browser'
import type { SidebarItemId } from '../../state/sidebarPins'
import { useCrew } from '../../state/store'
import type { Tab } from '../navTabs'

const WINDOW_ITEMS: readonly SidebarItemId[] = ['files', 'review', 'terminal', 'web', 'stickies']

export function sidebarItemOpensWindow(id: SidebarItemId): boolean {
  return WINDOW_ITEMS.includes(id)
}

export function openSidebarItemWindow(id: SidebarItemId): void {
  if (id === 'stickies') {
    void window.crew.openStickies()
    return
  }
  const base = makeTab()
  const tab =
    id === 'files'
      ? { ...base, kind: 'file' as const, tree: true }
      : id === 'review'
        ? { ...base, kind: 'review' as const }
        : id === 'terminal'
          ? { ...base, kind: 'terminal' as const, folder: useCrew.getState().folder }
          : id === 'web'
            ? base
            : null
  if (tab) void window.crew.popOutBrowserTab(tab)
}

export function openSidebarItem(id: SidebarItemId, onTab: (tab: Tab) => void, onToolbox: () => void): void {
  if (id === 'plugins' || id === 'scheduled') {
    onTab(id)
    return
  }
  if (id === 'toolbox') {
    onToolbox()
    return
  }
  if (id === 'stickies') {
    void window.crew.openStickies()
    return
  }
  const browser = useBrowser.getState()
  browser.openPanel()
  if (id === 'files') browser.openFiles()
  else if (id === 'review') browser.openReview()
  else if (id === 'terminal') browser.addTerminal(undefined, useCrew.getState().folder)
  else if (id === 'web') browser.addTab()
}
