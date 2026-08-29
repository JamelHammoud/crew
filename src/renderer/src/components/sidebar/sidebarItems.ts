import type { Glyph } from '../../components/glyph'
import {
  AtGlyph,
  BranchGlyph,
  ClockGlyph,
  CompassGlyph,
  FolderGlyph,
  GlobeGlyph,
  StickyGlyph,
  TerminalGlyph,
  ToolboxGlyph
} from '../../icons'
import type { SidebarItemId } from '../../state/sidebarPins'
import type { Tab } from '../navTabs'

export type SidebarItem = {
  id: SidebarItemId
  label: string
  Icon: Glyph
}

export const SIDEBAR_ITEMS: readonly SidebarItem[] = [
  { id: 'files', label: 'Files', Icon: FolderGlyph },
  { id: 'review', label: 'Review', Icon: BranchGlyph },
  { id: 'terminal', label: 'Terminal', Icon: TerminalGlyph },
  { id: 'web', label: 'Web', Icon: GlobeGlyph },
  { id: 'plugins', label: 'Plugins', Icon: AtGlyph },
  { id: 'scheduled', label: 'Scheduled', Icon: ClockGlyph },
  { id: 'toolbox', label: 'Toolbox', Icon: ToolboxGlyph },
  { id: 'stickies', label: 'Stickies', Icon: StickyGlyph },
  { id: 'browser', label: 'Browser', Icon: CompassGlyph }
]

export function itemTab(id: SidebarItemId): Tab | null {
  if (id === 'plugins' || id === 'scheduled') return id
  return null
}
