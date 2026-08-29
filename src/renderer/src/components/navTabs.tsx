import { FrameGlyph } from '../design/glyphs'
import { AtGlyph, BookGlyph, ChatGlyph, ClockGlyph, MailGlyph, MoreGlyph, type Glyph } from '../icons'
import type { SoundName } from '../media/sounds'

export type Tab = 'chat' | 'docs' | 'design' | 'plugins' | 'scheduled' | 'mail'

export type NavTab = Tab

export type TabRow = { id: NavTab; label: string; Icon: Glyph }

export const TABS: TabRow[] = [
  { id: 'chat', label: 'Chat', Icon: ChatGlyph },
  { id: 'docs', label: 'Docs', Icon: BookGlyph },
  { id: 'design', label: 'Design', Icon: FrameGlyph }
]

export const MORE_TABS: TabRow[] = [
  { id: 'scheduled', label: 'Scheduled', Icon: ClockGlyph },
  { id: 'plugins', label: 'Plugins', Icon: AtGlyph },
  { id: 'mail', label: 'Mail', Icon: MailGlyph }
]

export const MoreIcon = MoreGlyph

export const TAB_ICON = 'w-[18px] h-[18px]'

export const TAB_SOUND = {
  chat: 'tab.chat',
  docs: 'tab.docs',
  design: 'tab.design',
  plugins: 'tab.plugins',
  scheduled: 'tab.scheduled',
  mail: 'tab.docs'
} satisfies Record<Tab, SoundName>

export const tabLabel = (tab: Tab): string =>
  [...TABS, ...MORE_TABS].find(one => one.id === tab)?.label ?? TABS[0].label

export const inMore = (tab: Tab): boolean => MORE_TABS.some(one => one.id === tab)

export const tabsShowing = (tab: Tab): TabRow[] =>
  inMore(tab) ? [...TABS, ...MORE_TABS.filter(one => one.id === tab)] : TABS
