import type { RepoChange, RepoStash } from '../../../../shared/repository'
import { MinusGlyph, PlusGlyph, UndoGlyph } from '../../icons'
import ChangeRow from './ChangeRow'
import { Section, SectionAction } from './parts'
import StashRow from './StashRow'
import type { Groups } from './walk'
import { keyOf } from './walk'

export interface RowHandlers {
  isViewed: (change: RepoChange) => boolean
  reading: string | null
  onOpen: (change: RepoChange) => void
  onViewed: (change: RepoChange, viewed: boolean) => void
  onStage: (paths: string[]) => void
  onUnstage: (paths: string[]) => void
  onDiscard: (paths: string[], what: string) => void
}

const many = (count: number): string => `${count} ${count === 1 ? 'file' : 'files'}`

export default function ChangeList({
  groups,
  stashes,
  shut,
  onFold,
  rows,
  onApplyStash,
  onDropStash
}: {
  groups: Groups
  stashes: RepoStash[]
  shut: string[]
  onFold: (title: string) => void
  rows: RowHandlers
  onApplyStash: (ref: string) => void
  onDropStash: (ref: string) => void
}) {
  const folded = (title: string) => ({ open: !shut.includes(title), onToggle: () => onFold(title) })

  const row = (change: RepoChange) => {
    const key = keyOf(change)
    return (
      <ChangeRow
        key={key}
        change={change}
        reading={rows.reading === key}
        viewed={rows.isViewed(change)}
        onOpen={() => rows.onOpen(change)}
        onViewed={viewed => rows.onViewed(change, viewed)}
        onStage={() => rows.onStage([change.path])}
        onUnstage={() => rows.onUnstage([change.path])}
        onDiscard={() => rows.onDiscard([change.path], change.path)}
      />
    )
  }

  return (
    <div className="space-y-3 px-1.5 pb-6 pt-1.5">
      {groups.clashing.length > 0 && (
        <Section
          title="Merge Changes"
          count={groups.clashing.length}
          {...folded('Merge Changes')}
          actions={
            <SectionAction
              label="Stage all merge changes"
              icon={<PlusGlyph className="w-3.5 h-3.5" />}
              onClick={() => rows.onStage(groups.clashing.map(one => one.path))}
            />
          }
        >
          {groups.clashing.map(row)}
        </Section>
      )}

      {groups.staged.length > 0 && (
        <Section
          title="Staged Changes"
          count={groups.staged.length}
          {...folded('Staged Changes')}
          actions={
            <SectionAction
              label="Unstage all changes"
              icon={<MinusGlyph className="w-3.5 h-3.5" />}
              onClick={() => rows.onUnstage(groups.staged.map(one => one.path))}
            />
          }
        >
          {groups.staged.map(row)}
        </Section>
      )}

      {groups.loose.length > 0 && (
        <Section
          title="Changes"
          count={groups.loose.length}
          {...folded('Changes')}
          actions={
            <>
              <SectionAction
                label="Discard all changes"
                icon={<UndoGlyph className="w-3.5 h-3.5" />}
                danger
                onClick={() =>
                  rows.onDiscard(
                    groups.loose.map(one => one.path),
                    many(groups.loose.length)
                  )
                }
              />
              <SectionAction
                label="Stage all changes"
                icon={<PlusGlyph className="w-3.5 h-3.5" />}
                onClick={() => rows.onStage(groups.loose.map(one => one.path))}
              />
            </>
          }
        >
          {groups.loose.map(row)}
        </Section>
      )}

      {stashes.length > 0 && (
        <Section title="Stashes" count={stashes.length} {...folded('Stashes')}>
          {stashes.map(stash => (
            <StashRow
              key={stash.ref}
              stash={stash}
              onApply={() => onApplyStash(stash.ref)}
              onDrop={() => onDropStash(stash.ref)}
            />
          ))}
        </Section>
      )}
    </div>
  )
}
