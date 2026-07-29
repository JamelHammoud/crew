import { CheckGlyph } from '../../icons'
import { applyTheme, useTheme, type Theme } from '../../state/theme'
import { Page } from './parts'

// The window as it would be, drawn in the theme it is offering rather than in
// the one the app is wearing, the way the design canvas pins its own palette.
const PAPER: Record<Theme, { page: string; raised: string; ink: string }> = {
  dark: { page: '#141414', raised: '#222222', ink: '#ffffff' },
  light: { page: '#ffffff', raised: '#f2f2f2', ink: '#141414' }
}

const DISCS = [0, 1, 2]

function Preview({ theme }: { theme: Theme }) {
  const { page, raised, ink } = PAPER[theme]
  const bar = (width: number, weight: number) => (
    <span className="h-1.5 rounded-full" style={{ width, background: ink, opacity: weight }} />
  )
  return (
    <span className="block rounded-[13px] overflow-hidden select-none" style={{ background: page }}>
      <span className="flex items-center h-8 px-3">
        <span className="flex">
          {DISCS.map(disc => (
            <span
              key={disc}
              className="w-2.5 h-2.5 rounded-full"
              style={{
                background: ink,
                marginLeft: disc ? -5 : 0,
                boxShadow: disc ? `0 0 0 1.5px ${page}` : undefined
              }}
            />
          ))}
        </span>
        <span className="mx-auto flex items-center gap-1">
          <span className="h-3.5 px-1.5 rounded-full flex items-center" style={{ background: raised }}>
            {bar(14, 0.55)}
          </span>
          {bar(14, 0.16)}
          {bar(10, 0.16)}
        </span>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: ink, opacity: 0.28 }} />
      </span>
      <span className="block px-3 pt-1 pb-4 space-y-2.5">
        {[
          [46, 30],
          [34, 52]
        ].map(([first, second], row) => (
          <span key={row} className="flex items-start gap-2">
            <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: ink, opacity: 0.28 }} />
            <span className="flex flex-col gap-1 pt-0.5">
              {bar(first, 0.3)}
              {bar(second, 0.16)}
            </span>
          </span>
        ))}
      </span>
    </span>
  )
}

const CHOICES: Array<{ theme: Theme; label: string }> = [
  { theme: 'dark', label: 'Dark' },
  { theme: 'light', label: 'Light' }
]

export default function Appearance() {
  const theme = useTheme()

  return (
    <Page title="Appearance">
      <div className="grid grid-cols-2 gap-3">
        {CHOICES.map(choice => {
          const on = theme === choice.theme
          return (
            <button
              key={choice.theme}
              onClick={() => applyTheme(choice.theme)}
              aria-pressed={on}
              className={`rounded-card p-1.5 border text-left transition-colors duration-150 active:scale-[0.99] ${
                on ? 'border-fg/40 bg-fg/[0.04]' : 'border-fg/10 hover:border-fg/25'
              }`}
            >
              <Preview theme={choice.theme} />
              <span className="flex items-center gap-1.5 px-2 pt-2.5 pb-1 text-sm font-medium text-fg">
                {choice.label}
                {on && <CheckGlyph className="w-4 h-4" />}
              </span>
            </button>
          )
        })}
      </div>
    </Page>
  )
}
