import { kindOf, type AttachmentKind } from '../../../shared/attachments'
import { ArchiveGlyph, DocGlyph, FileGlyph, FilmGlyph, MusicGlyph, PhotoGlyph, type Glyph } from '../icons'

const MARKS: Record<AttachmentKind, Glyph> = {
  image: PhotoGlyph,
  video: FilmGlyph,
  audio: MusicGlyph,
  archive: ArchiveGlyph,
  document: DocGlyph,
  file: FileGlyph
}

export const markFor = (mime: string): Glyph => MARKS[kindOf(mime)]
