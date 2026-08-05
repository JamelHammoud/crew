import { FrameGlyph } from '../design/glyphs'
import { BookGlyph, ChatGlyph, MoreGlyph, PlugGlyph, type Glyph } from '../icons'

export type Tab = 'chat' | 'docs' | 'design' | 'plugins'

export type NavTab = Tab

export type TabRow = { id: NavTab; label: string; Icon: Glyph }

export const TABS: TabRow[] = [
  { id: 'chat', label: 'Chat', Icon: ChatGlyph },
  { id: 'docs', label: 'Docs', Icon: DocGlyph },
  { id: 'design', label: 'Design', Icon: FrameGlyph }
]

export const MORE_TABS: TabRow[] = [{ id: 'plugins', label: 'Plugins', Icon: PlugGlyph }]

export const MoreIcon = MoreGlyph

export const TAB_ICON = 'w-[18px] h-[18px]'

export const inMore = (tab: Tab): boolean => MORE_TABS.some(one => one.id === tab)

export const tabsShowing = (tab: Tab): TabRow[] =>
  inMore(tab) ? [...TABS, ...MORE_TABS.filter(one => one.id === tab)] : TABS
