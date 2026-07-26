import type { ToolAction } from '../../../shared/toolbox'
import { FrameGlyph } from '../design/glyphs'
import { ChatGlyph, ClipboardGlyph, DocGlyph, FileGlyph, GlobeGlyph, TerminalGlyph, type Glyph } from '../icons'

export type ToolKind = ToolAction['kind']

// Everything a tool can be. One table, read by the screen that picks a kind and
// by the row in the builder that says which one is picked, so the words a
// person chose from are the words they are shown afterwards.
export const TOOL_KINDS: Array<{ kind: ToolKind; title: string; note: string; mark: Glyph }> = [
  { kind: 'web', title: 'Open a page', note: 'A site, here or in your browser', mark: GlobeGlyph },
  { kind: 'terminal', title: 'Run a command', note: 'Opens a terminal and runs it', mark: TerminalGlyph },
  { kind: 'file', title: 'Open a file', note: 'Anything in the project', mark: FileGlyph },
  { kind: 'doc', title: 'Open a doc', note: 'One of the pages the crew writes', mark: DocGlyph },
  { kind: 'board', title: 'Open a board', note: 'One of the crew’s design boards', mark: FrameGlyph },
  { kind: 'prompt', title: 'Ask an agent', note: 'Puts the work in the chat', mark: ChatGlyph },
  { kind: 'copy', title: 'Copy something', note: 'Puts what you write on the clipboard', mark: ClipboardGlyph }
]

export const kindOf = (kind: ToolKind): (typeof TOOL_KINDS)[number] =>
  TOOL_KINDS.find(entry => entry.kind === kind) ?? TOOL_KINDS[0]
