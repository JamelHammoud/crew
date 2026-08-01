export type Tab = 'chat' | 'docs' | 'design'

export type NavTab = Tab

export const TABS: Array<{ id: NavTab; label: string }> = [
  { id: 'chat', label: 'Chat' },
  { id: 'docs', label: 'Docs' },
  { id: 'design', label: 'Design' }
]
