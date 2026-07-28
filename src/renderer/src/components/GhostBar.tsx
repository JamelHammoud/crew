import { GhostGlyph } from '../icons'

// What a hidden thread says about itself, on the head of the box it is written
// in. A white band standing behind the composer's own header, the same shape the
// queue takes above it, so what is hidden is said on the box it is typed in
// rather than floating over the thread.
export default function GhostBar() {
  return (
    <div className="bg-fg text-ink-900 rounded-t-[30px] flex items-center justify-center gap-1.5 pt-2 pb-12 -mb-10 text-sm font-semibold">
      <GhostGlyph className="w-4 h-4" />
      Ghost mode
    </div>
  )
}
