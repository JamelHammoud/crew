import type { CrewHome } from '../../../../shared/project'
import { DesktopGlyph, FolderGlyph } from '../../icons'

function folderName(folder: string): string {
  return folder.split(/[\\/]/).filter(Boolean).at(-1) ?? folder
}

// The one question a project is ever asked, and only the first time it is
// opened. Each row is the answer and the button both, so there is nothing to
// confirm afterwards.
export default function WhereTo({
  folder,
  tracked,
  busy,
  onPick
}: {
  folder: string
  tracked: boolean
  busy: boolean
  onPick: (home: CrewHome) => void
}) {
  const rows: Array<{ home: CrewHome; mark: JSX.Element; title: string; line: string }> = [
    {
      home: 'folder',
      mark: <FolderGlyph className="w-5 h-5" />,
      title: 'In the project',
      line: tracked
        ? 'Chat, docs and boards go out with the project, so everyone who has it gets the crew.'
        : 'Chat, docs and boards are kept in the folder. Nothing is shared until the project is tracked.'
    },
    {
      home: 'private',
      mark: <DesktopGlyph className="w-5 h-5" />,
      title: 'On this machine',
      line: 'Nothing is written into the project and nothing is committed. You can still invite people.'
    }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-fg">Where should this crew live?</h2>
        <p className="text-sm text-fg-muted mt-1 truncate">{folderName(folder)}</p>
      </div>
      <div className="rounded-card bg-ink-800 p-1.5 space-y-0.5">
        {rows.map(row => (
          <button
            key={row.home}
            onClick={() => onPick(row.home)}
            disabled={busy}
            className="group w-full rounded-2xl px-3 py-3 flex items-start gap-3 text-left transition-all duration-150 hover:bg-ink-700 active:scale-[0.99] disabled:opacity-50 disabled:scale-100"
          >
            <span className="w-9 h-9 rounded-full bg-ink-700 flex items-center justify-center shrink-0 text-fg-secondary transition-colors duration-150 group-hover:bg-ink-600 group-hover:text-fg">
              {row.mark}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-fg">{row.title}</span>
              <span className="block text-xs text-fg-muted mt-0.5 leading-relaxed">{row.line}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs text-fg-faint">This is asked once. Crew remembers the answer for this project.</p>
    </div>
  )
}
