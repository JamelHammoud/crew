import { TOOL_MARKS, type ToolMark } from '../../../shared/toolbox'
import {
  ArchiveGlyph,
  BoltGlyph,
  ChatGlyph,
  ChecklistGlyph,
  CopyGlyph,
  ClockGlyph,
  CloudGlyph,
  DesktopGlyph,
  DocGlyph,
  EyeGlyph,
  FileGlyph,
  FilmGlyph,
  FolderGlyph,
  GlobeGlyph,
  GroupGlyph,
  LinkGlyph,
  MusicGlyph,
  PencilGlyph,
  PeopleGlyph,
  PhotoGlyph,
  PlayGlyph,
  PromptGlyph,
  SearchGlyph,
  SignalGlyph,
  SparkGlyph,
  SpeakerGlyph,
  StarGlyph,
  SunGlyph,
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
  clipboard: CopyGlyph,
  checklist: ChecklistGlyph,
  archive: ArchiveGlyph,
  photo: PhotoGlyph,
  film: FilmGlyph,
  music: MusicGlyph,
  play: PlayGlyph,
  speaker: SpeakerGlyph,
  desktop: DesktopGlyph,
  cloud: CloudGlyph,
  signal: SignalGlyph,
  chat: ChatGlyph,
  people: PeopleGlyph,
  star: StarGlyph,
  spark: SparkGlyph,
  bolt: BoltGlyph,
  group: GroupGlyph,
  pencil: PencilGlyph,
  sun: SunGlyph,
  clock: ClockGlyph,
  eye: EyeGlyph
}

export const glyphFor = (mark: string): Glyph | null =>
  (TOOL_MARKS as readonly string[]).includes(mark) ? GLYPHS[mark as ToolMark] : null

// A mark is one of the app's own drawings or an emoji, and every tool is shown
// through here, so the two are always the same size. The size is the one the
// class already carries, which is where a glyph reads its own weight from, so
// the drawing and the picture are never asked for separately.
export default function ToolMarkView({ mark, className = 'w-4 h-4' }: { mark: string; className?: string }) {
  const Glyph = glyphFor(mark)
  if (Glyph) return <Glyph className={className} />
  return <Emoji char={mark} size={wornAt(className)} />
}
