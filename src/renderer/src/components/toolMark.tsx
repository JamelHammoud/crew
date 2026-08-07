import { cleanMark, TOOL_MARKS, type ToolMark } from '../../../shared/toolbox'
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
  copy: CopyGlyph,
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
  send: SendGlyph,
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

// A name this build has never heard of comes back as the default rather than as
// a mark, which is what `cleanMark` already says on the way in. It is asked
// again on the way out because a tool picked in another build is read from the
// log as it was written: a mark that has since been renamed would otherwise fall
// through to the emoji and draw the word.
export const glyphFor = (mark: string): Glyph | null => {
  const known = cleanMark(mark)
  return (TOOL_MARKS as readonly string[]).includes(known) ? GLYPHS[known as ToolMark] : null
}

// A mark is one of the app's own drawings or an emoji, and every tool is shown
// through here, so the two are always the same size. The size is the one the
// class already carries, which is where a glyph reads its own weight from, so
// the drawing and the picture are never asked for separately.
export default function ToolMarkView({ mark, className = 'w-4 h-4' }: { mark: string; className?: string }) {
  const Glyph = glyphFor(mark)
  if (Glyph) return <Glyph className={className} />
  return <Emoji char={mark} size={wornAt(className)} />
}
