import type { CrewHome } from '../../../../shared/project'
import { DesktopGlyph, FolderGlyph } from '../../icons'

// The one question a project is ever asked, and only the first time it is
// opened. Each option is the answer and the button both, so there is nothing to
// confirm afterwards.
export default function WhereTo({ busy, onPick }: { busy: boolean; onPick: (home: CrewHome) => void }) {
  const options: Array<{ home: CrewHome; mark: JSX.Element; title: string; line: string }> = [
    {
      home: 'folder',
      mark: <FolderGlyph className="w-4 h-4" />,
      title: 'In the project folder',
      line: 'It goes out with the project, so everyone who has it gets the crew.'
    },
    {
      home: 'private',
      mark: <DesktopGlyph className="w-4 h-4" />,
      title: 'Outside the project',
      line: 'Nothing is written into your folder and nothing is committed. You can still invite people.'
    }
  ]

  return (
    <div className="space-y-6 text-center">
      <h2 className="text-lg font-semibold text-fg">Where should this crew be saved?</h2>
      <div className="space-y-2">
        {options.map(option => (
          <button
            key={option.home}
            onClick={() => onPick(option.home)}
            disabled={busy}
            className="group w-full rounded-card bg-ink-800 px-5 py-4 transition-colors duration-150 hover:bg-ink-700 active:scale-[0.99] disabled:opacity-50 disabled:scale-100"
          >
            <span className="flex items-center justify-center gap-2 text-fg-secondary transition-colors duration-150 group-hover:text-fg">
              {option.mark}
              <span className="text-sm font-medium text-fg">{option.title}</span>
            </span>
            <span className="block text-xs text-fg-muted mt-1.5 leading-relaxed">{option.line}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
