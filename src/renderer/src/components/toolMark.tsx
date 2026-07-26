import { TOOL_MARKS, type ToolMark } from '../../../shared/toolbox'
import {
  ArchiveGlyph,
  ChatGlyph,
  ChecklistGlyph,
  ClipboardGlyph,
  ClockGlyph,
  CloudGlyph,
  DesktopGlyph,
  DocGlyph,
  EyeGlyph,
  FileGlyph,
  FilmGlyph,
  FolderGlyph,
  GlobeGlyph,
  LinkGlyph,
  MusicGlyph,
  PeopleGlyph,
  PhotoGlyph,
  PromptGlyph,
  SearchGlyph,
  SignalGlyph,
  SpeakerGlyph,
  StarGlyph,
  TerminalGlyph,
  WindowGlyph,
  type Glyph
} from '../icons'
import { wornAt } from '../icons/keylines'
import Emoji from './Emoji'

const GLYPHS: Record<ToolMark, Glyph> = {
  globe: GlobeGlyph,
  window: WindowGlyph,
  link: LinkGlyph,
  search: SearchGlyph,
  terminal: TerminalGlyph,
  prompt: PromptGlyph,
  folder: FolderGlyph,
  file: FileGlyph,
  doc: DocGlyph,
  clipboard: ClipboardGlyph,
  checklist: ChecklistGlyph,
  archive: ArchiveGlyph,
  photo: PhotoGlyph,
  film: FilmGlyph,
  music: MusicGlyph,
  speaker: SpeakerGlyph,
  desktop: DesktopGlyph,
  cloud: CloudGlyph,
  signal: SignalGlyph,
  chat: ChatGlyph,
  people: PeopleGlyph,
  star: StarGlyph,
  clock: ClockGlyph,
  eye: EyeGlyph
}

export const glyphFor = (mark: string): Glyph | null =>
  (TOOL_MARKS as readonly string[]).includes(mark) ? GLYPHS[mark as ToolMark] : null

// A mark is one of the app's own drawings or an emoji, and everywhere a tool is
// shown it is shown through here, so the two are always the same size and sit
// on the same middle.
export default function ToolMarkView({ mark, size }: { mark: string; size: number }) {
  const Glyph = glyphFor(mark)
  if (Glyph) return <Glyph style={{ width: size, height: size }} />
  return <Emoji char={mark} size={size} />
}
