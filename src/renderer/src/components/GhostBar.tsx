import { GhostGlyph } from '../icons'

// What a hidden thread says about itself, on the head of the box it is written
// in. A white band across the top of the composer's own header, the mark and the
// words centered on it, so what is hidden is said where the typing happens
// rather than over the thread.
export default function GhostBar() {
  return (
    <div className="h-8 rounded-t-[29px] bg-fg text-ink-900 flex items-center justify-center gap-1.5 text-sm font-semibold">
      <GhostGlyph className="w-4 h-4" />
      Ghost mode
    </div>
  )
}
