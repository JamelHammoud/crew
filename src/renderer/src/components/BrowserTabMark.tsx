import { useState } from 'react'
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
  PhotoGlyph,
  QuestionGlyph,
  TerminalGlyph,
  TicketGlyph
} from '../icons'
import { terminalDetail, terminalLabel } from '../../../shared/terminalName'
import { type BrowserTab } from '../state/browser'
import { useCrew } from '../state/store'
import { markFor } from './attachmentMark'
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
