import { memo, useState } from 'react'
import { filePathOf, pageName } from '../../../shared/urls'
import { useBrowser } from '../state/browser'
import { isPrivate, PrivateChip, useLocated } from './fileLinks'
import { openShown, shownPaths } from './openShown'
import { Chevron, FilePathLink, Label, rowClass, SUBJECT, SUBJECT_MONO } from './StepRow'
import { sameShown, type Shown } from './thread'
import type { ToolAction } from './toolActions'
import { ShowGlyph } from './toolGlyphs'

const allFiles = (pages: string[]): boolean => shownPaths(pages).length === pages.length

const countOf = (pages: string[]): string => `${pages.length} ${allFiles(pages) ? 'files' : 'pages'}`

function ShownLink({ page }: { page: string }) {
  const path = filePathOf(page)
  if (path !== null) return <FilePathLink path={path} className={SUBJECT_MONO} />
  return (
    <button
      type="button"
      onClick={() => useBrowser.getState().showPage(page)}
      className={`${SUBJECT_MONO} cursor-pointer transition-colors hover:text-fg hover:underline underline-offset-2`}
    >
      {pageName(page)}
    </button>
  )
}

// A run showing its work, as the row it leaves behind. It reads the way every
// other step in the thread reads, because it is one: what the agent did, what
// it did it to, and the rest of it a press away.
function PageRow({ shown, linked }: { shown: Shown; linked?: boolean }) {
  const [open, setOpen] = useState(false)
  const { pages, title } = shown
  useLocated(shownPaths(pages))
  const many = pages.length > 1
  const one = pages[0] ?? ''
  const path = filePathOf(one)
  const away = !many && path !== null && isPrivate(path)
  const where = many ? countOf(pages) : pageName(one)
  const action: ToolAction = { icon: ShowGlyph, run: 'Showing', done: 'Showed', prose: true }
  const press = many ? () => setOpen(!open) : away ? null : () => void openShown(pages)

  return (
    <div className={`animate-rise pl-14 ${linked ? '-mt-3' : ''}`}>
      <button onClick={press ?? undefined} className={rowClass(press !== null)}>
        <ShowGlyph className="w-[18px] h-[18px] shrink-0 text-fg" />
        <Label action={action} running={false} />
        {title && <span className={SUBJECT}>{title}</span>}
        {away ? <PrivateChip /> : where !== title && <span className={SUBJECT_MONO}>{where}</span>}
        {many && <Chevron open={open} />}
      </button>
      {many && open && (
        <div className="mt-1 mb-1.5 pl-7 flex flex-col items-start gap-1">
          {pages.map(page => (
            <ShownLink key={page} page={page} />
          ))}
        </div>
      )}
    </div>
  )
}

export default memo(
  PageRow,
  (before, after) => before.linked === after.linked && sameShown(before.shown, after.shown)
)
