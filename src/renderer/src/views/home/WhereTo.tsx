import type { CrewHome } from '../../../../shared/project'
import { DesktopGlyph, FolderGlyph } from '../../icons'

// The one question a project is ever asked, and only the first time it is
// opened. The two stand side by side rather than stacked, because it is a
// choice between two places and a column of rows reads as a list.
export default function WhereTo({ busy, onPick }: { busy: boolean; onPick: (home: CrewHome) => void }) {
  const options: Array<{ home: CrewHome; mark: JSX.Element; title: string; line: string }> = [
    {
      home: 'folder',
      mark: <FolderGlyph className="w-5 h-5" />,
      title: 'In the project',
      line: 'Everyone who has the project gets the crew.'
    },
    {
      home: 'private',
      mark: <DesktopGlyph className="w-5 h-5" />,
      title: 'Outside the project',
      line: 'Your folder is never written to or committed.'
    }
  ]

  return (
    <div className="space-y-7 text-center">
      <h2 className="text-lg font-semibold text-fg">Where should this crew be saved?</h2>
      <div className="grid grid-cols-2 gap-3">
        {options.map(option => (
          <button
            key={option.home}
            onClick={() => onPick(option.home)}
            disabled={busy}
            className="group rounded-card border border-ink-700 bg-ink-850 px-5 pt-7 pb-6 flex flex-col items-center gap-4 transition-colors duration-150 hover:border-ink-600 hover:bg-ink-800 active:scale-[0.99] disabled:opacity-50 disabled:scale-100"
          >
            <span className="w-12 h-12 rounded-full bg-ink-800 flex items-center justify-center text-fg-secondary transition-colors duration-150 group-hover:bg-ink-700 group-hover:text-fg">
              {option.mark}
            </span>
            <span className="block">
              <span className="block text-sm font-medium text-fg">{option.title}</span>
              <span className="block text-xs text-fg-muted leading-relaxed mt-1.5 text-balance">{option.line}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
