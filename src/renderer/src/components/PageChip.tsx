import { pageName } from '../../../shared/urls'
import { FileGlyph, GlobeGlyph } from '../icons'
import { useBrowser } from '../state/browser'
import type { ShownPage } from './thread'

// A page an agent showed, as it stands in the thread afterwards. It opened by
// itself for whoever was reading at the time, so the row is the way back to it
// rather than the news: pressing it puts the page up again, loaded fresh.

export default function PageChip({ page }: { page: ShownPage }) {
  const showPage = useBrowser(state => state.showPage)
  const where = pageName(page.url)
  const Mark = page.url.startsWith('file://') ? FileGlyph : GlobeGlyph

  // The chip stands in the column the steps stand in, so its mark lines up with
  // theirs: the step row's own pl-14 less the chip's own padding.
  return (
    <div className="flex pl-13 pr-4 py-1 select-none">
      <button
        type="button"
        onClick={() => showPage(page.url)}
        className="group flex items-center gap-2 pl-2.5 pr-3 py-1 rounded-full border border-ink-700 bg-ink-800/60 transition-all active:scale-[0.98] hover:border-ink-600 hover:bg-ink-700"
      >
        <Mark className="w-3.5 h-3.5 shrink-0 text-fg-muted group-hover:text-fg-secondary" />
        <span className="text-sm text-fg-secondary group-hover:text-fg truncate max-w-[16rem]">{page.title}</span>
        {where !== page.title && (
          <span className="text-xs text-fg-faint shrink-0 truncate max-w-[10rem]">{where}</span>
        )}
      </button>
    </div>
  )
}
