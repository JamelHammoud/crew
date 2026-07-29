import type { Glyph } from '../../icons'
import { GroupGlyph, PeopleGlyph, SpeakerGlyph, SparkGlyph, SunGlyph } from '../../icons'
import type { SettingsTab } from '../../state/settings'

export interface TabDef {
  id: SettingsTab
  label: string
  group: string
  // The one page that wears a face rather than a mark, because the face is
  // already what says who it is about.
  mark: Glyph | null
}

// The one table of what the settings hold. The rail and the page it opens both
// read it, so the word somebody picked is the word at the top of what they get.
export const SETTINGS_TABS: TabDef[] = [
  { id: 'you', label: 'You', group: 'You', mark: null },
  { id: 'appearance', label: 'Appearance', group: 'You', mark: SunGlyph },
  { id: 'sound', label: 'Sound and video', group: 'You', mark: SpeakerGlyph },
  { id: 'people', label: 'People', group: 'Crew', mark: PeopleGlyph },
  { id: 'agents', label: 'Agents', group: 'Crew', mark: SparkGlyph },
  { id: 'helpers', label: 'Helpers', group: 'Crew', mark: GroupGlyph }
]

export const GROUPS = [...new Set(SETTINGS_TABS.map(tab => tab.group))]

export function tabLabel(tab: TabDef, selfName: string): string {
  return tab.id === 'you' ? selfName || tab.label : tab.label
}
