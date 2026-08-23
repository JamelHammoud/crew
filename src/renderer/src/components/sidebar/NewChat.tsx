import { PlusGlyph } from '../../icons'
import Tooltip from '../Tooltip'

export default function NewChat({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip label="New personal chat">
      <button
        onClick={onClick}
        aria-label="New personal chat"
        className="app-no-drag pointer-events-auto h-6 w-6 rounded-lg flex items-center justify-center opacity-0 text-fg/45 transition-[color,background-color,opacity] duration-150 active:scale-[0.95] group-hover:opacity-100 focus-visible:opacity-100 hover:bg-fg/[0.10] hover:text-fg"
      >
        <PlusGlyph className="w-4 h-4" />
      </button>
    </Tooltip>
  )
}
