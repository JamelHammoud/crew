import { useState, type ReactNode } from 'react'
import { isImageUrl } from '../../../shared/files'
import { gameFor } from '../../../shared/games'
import {
  BranchGlyph,
  ChecklistGlyph,
  DocGlyph,
  FolderGlyph,
  GameGlyph,
  GlobeGlyph,
  GroupGlyph,
  MusicGlyph,
  PhoneGlyph,
  PhotoGlyph,
  QuestionGlyph,
  TerminalGlyph,
  TicketGlyph
} from '../icons'
import { terminalDetail, terminalEarlier, terminalLabel } from '../../../shared/terminalName'
import { type BrowserTab } from '../state/browser'
import { useCrew } from '../state/store'
import { markFor } from './attachmentMark'
import CardRule from './CardRule'
import PluginMark from './plugins/PluginMark'
import Spinner from './Spinner'
import SubagentMark from './SubagentMark'

export const showsImage = (tab: BrowserTab): boolean =>
  tab.kind === 'image' || (tab.kind === 'web' && isImageUrl(tab.initialUrl))

const imageName = (url: string): string => (url.split(/[?#]/)[0] ?? '').split('/').pop() || 'Image'

export function browserTabLabel(tab: BrowserTab): string {
  if (tab.plugin) return tab.pluginLabel
  if (tab.kind === 'plan') return 'Plan'
  if (tab.kind === 'work') return 'Board'
  if (tab.kind === 'aside') return tab.title || 'Question'
  if (tab.kind === 'agent')
    return tab.threadId ? (useCrew.getState().threads[tab.threadId]?.helper ?? 'Helper') : 'Helpers'
  if (tab.kind === 'review') return 'Review'
  if (tab.kind === 'ios') return 'Simulator'
  if (tab.kind === 'music') return 'Music'
  if (tab.kind === 'game') return gameFor(tab.game ?? '')?.name ?? 'Games'
  if (tab.kind === 'terminal') return terminalLabel(tab)
  if (tab.kind === 'attachment') return tab.title || 'File'
  if (tab.kind === 'file') return tab.path.split('/').pop() || 'Files'
  if (showsImage(tab)) return tab.title || imageName(tab.initialUrl)
  if (tab.title) return tab.title
  if (!tab.url) return 'New tab'
  try {
    return new URL(tab.url).hostname
  } catch {
    return tab.url
  }
}

export function browserTabDetail(tab: BrowserTab): string {
  if (tab.kind === 'file') return tab.path
  if (tab.kind === 'terminal') return terminalDetail(tab) || tab.folder
  if (tab.kind === 'attachment') return tab.initialUrl
  if (tab.kind === 'web' || tab.kind === 'image') return tab.url || tab.initialUrl
  return ''
}

// A tab cut down to fit stands its whole self up on hover: the name uncut,
// where it really points, and for a terminal everything else it has run. A card
// that only says the pill again is a card earning nothing, so one with none of
// those is nothing at all.
export function browserTabCard(tab: BrowserTab, clipped: boolean): ReactNode {
  const label = browserTabLabel(tab)
  const detail = browserTabDetail(tab)
  const line = detail && detail !== label ? detail : ''
  const earlier = tab.kind === 'terminal' ? terminalEarlier(tab) : []
  if (!clipped && !line && earlier.length === 0) return null
  return (
    <span className="block select-text">
      <span className="block break-words text-sm leading-[1.5] text-fg/70">{label}</span>
      {line && <span className="mt-1 block break-words text-xs leading-[1.5] text-fg/45">{line}</span>}
      {earlier.length > 0 && (
        <CardRule className="space-y-1">
          {earlier.map(one => (
            <span key={one} className="block break-words text-xs leading-[1.5] text-fg/45">
              {one}
            </span>
          ))}
        </CardRule>
      )}
    </span>
  )
}

export function browserTabSearchText(tab: BrowserTab): string {
  return [browserTabLabel(tab), browserTabDetail(tab), tab.pluginLabel].join(' ').toLocaleLowerCase()
}

function Favicon({ src }: { src: string }) {
  const [broken, setBroken] = useState(false)
  if (broken) return <GlobeGlyph className="w-4 h-4 shrink-0" />
  return <img src={src} alt="" className="w-4 h-4 shrink-0 rounded-sm" onError={() => setBroken(true)} />
}

export default function BrowserTabMark({ tab }: { tab: BrowserTab }) {
  const FileMark = markFor(tab.mime)

  if (tab.loading) return <Spinner size={14} className="text-fg-muted" />
  if (tab.plugin) return <PluginMark seed={tab.plugin} box={16} />
  if (tab.kind === 'agent')
    return tab.threadId ? <SubagentMark seed={tab.threadId} size={18} /> : <GroupGlyph className="w-4 h-4 shrink-0" />
  if (tab.kind === 'plan') return <ChecklistGlyph className="w-4 h-4 shrink-0" />
  if (tab.kind === 'work') return <TicketGlyph className="w-4 h-4 shrink-0" />
  if (tab.kind === 'aside') return <QuestionGlyph className="w-4 h-4 shrink-0" />
  if (tab.kind === 'review') return <BranchGlyph className="w-4 h-4 shrink-0" />
  if (tab.kind === 'ios') return <PhoneGlyph className="w-4 h-4 shrink-0" />
  if (tab.kind === 'music') return <MusicGlyph className="w-4 h-4 shrink-0" />
  if (tab.kind === 'game') return <GameGlyph className="w-4 h-4 shrink-0" />
  if (tab.kind === 'terminal') return <TerminalGlyph className="w-4 h-4 shrink-0" />
  if (tab.kind === 'attachment') return <FileMark className="w-4 h-4 shrink-0" />
  if (tab.kind === 'file')
    return tab.path ? <DocGlyph className="w-4 h-4 shrink-0" /> : <FolderGlyph className="w-4 h-4 shrink-0" />
  if (showsImage(tab)) return <PhotoGlyph className="w-4 h-4 shrink-0" />
  if (tab.favicon) return <Favicon key={tab.favicon} src={tab.favicon} />
  return <GlobeGlyph className="w-4 h-4 shrink-0" />
}
