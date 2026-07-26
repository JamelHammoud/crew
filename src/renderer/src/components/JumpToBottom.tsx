import { ArrowDownGlyph } from '../icons'

export default function JumpToBottom({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="glass absolute -top-14 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex items-center gap-1.5 h-9 pl-3 pr-4 rounded-full text-sm font-medium text-fg-secondary transition-all duration-150 hover:text-fg active:scale-95 animate-pop"
    >
      <ArrowDownGlyph className="w-4 h-4" />
      Jump to bottom
    </button>
  )
}
