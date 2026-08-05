export type Tab = 'chat' | 'docs' | 'design' | 'plugins'

export type NavTab = Tab

export const TABS: Array<{ id: NavTab; label: string }> = [
  { id: 'chat', label: 'Chat' },
  { id: 'docs', label: 'Docs' },
  { id: 'design', label: 'Design' }
]

export const MORE_TABS: Array<{ id: NavTab; label: string }> = [{ id: 'plugins', label: 'Plugins' }]

export const inMore = (tab: Tab): boolean => MORE_TABS.some(one => one.id === tab)

export const tabsShowing = (tab: Tab): Array<{ id: NavTab; label: string }> =>
  inMore(tab) ? [...TABS, ...MORE_TABS.filter(one => one.id === tab)] : TABS
