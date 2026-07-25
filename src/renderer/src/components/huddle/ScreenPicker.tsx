import { ComputerDesktopIcon, WindowIcon } from '@heroicons/react/16/solid'
import { useEffect, useState } from 'react'
import type { ScreenSource } from '../../../../shared/media'
import { useHuddle } from '../../state/huddle'
import Spinner from '../Spinner'

type Kind = 'screen' | 'window'

const TABS: Array<{ id: Kind; label: string }> = [
  { id: 'screen', label: 'Screens' },
  { id: 'window', label: 'Windows' }
]

export default function ScreenPicker() {
  const share = useHuddle(s => s.share)
  const close = () => useHuddle.getState().setPicking(false)
  const [sources, setSources] = useState<ScreenSource[] | null>(null)
  const [kind, setKind] = useState<Kind>('screen')
  const [chosen, setChosen] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void window.crew
      .screenSources()
      .then(found => {
        if (!live) return
        setSources(found)
        setKind(found.some(source => source.kind === 'screen') ? 'screen' : 'window')
        setChosen(found[0]?.id ?? null)
      })
      .catch(() => live && setSources([]))
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const shown = (sources ?? []).filter(source => source.kind === kind)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/70 p-8" onClick={close}>
      <div
        onClick={event => event.stopPropagation()}
        className="glass rounded-card w-full max-w-3xl max-h-full flex flex-col animate-pop overflow-hidden"
      >
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 shrink-0">
          <h2 className="text-lg font-semibold text-fg flex-1">Share your screen</h2>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setKind(tab.id)}
              className={`h-8 px-3.5 rounded-full text-sm font-medium transition-colors ${
                kind === tab.id ? 'bg-fg text-ink-900' : 'text-fg-muted hover:text-fg hover:bg-fg/[0.06]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5">
          {sources === null && (
            <div className="h-48 flex items-center justify-center">
              <Spinner size={20} className="text-fg-muted" />
            </div>
          )}
          {sources !== null && shown.length === 0 && (
            <div className="h-48 flex flex-col items-center justify-center gap-3 text-center">
              <p className="text-base text-fg-secondary">Nothing to share here yet.</p>
              <button
                onClick={() => void window.crew.openMediaSettings('screen')}
                className="text-sm text-fg underline underline-offset-2 decoration-fg-muted hover:decoration-fg"
              >
                Open screen recording settings
              </button>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3 pb-1">
            {shown.map(source => (
              <button
                key={source.id}
                onClick={() => setChosen(source.id)}
                onDoubleClick={() => void share(source.id)}
                className={`group text-left rounded-2xl overflow-hidden transition-all duration-150 active:scale-[0.98] ${
                  chosen === source.id ? 'ring-2 ring-fg' : 'ring-1 ring-fg/[0.08] hover:ring-fg/25'
                }`}
              >
                <span className="block aspect-video bg-ink-850">
                  <img src={source.thumbnail} alt="" className="w-full h-full object-contain" />
                </span>
                <span className="flex items-center gap-2 px-2.5 py-2 bg-ink-800">
                  {source.icon ? (
                    <img src={source.icon} alt="" className="w-4 h-4 shrink-0 rounded" />
                  ) : source.kind === 'screen' ? (
                    <ComputerDesktopIcon className="w-4 h-4 shrink-0 text-fg-muted" />
                  ) : (
                    <WindowIcon className="w-4 h-4 shrink-0 text-fg-muted" />
                  )}
                  <span className="text-sm text-fg-secondary truncate group-hover:text-fg transition-colors">
                    {source.name}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 shrink-0">
          <button
            onClick={close}
            className="h-9 px-4 rounded-full text-sm font-medium text-fg-secondary hover:text-fg hover:bg-fg/[0.06] transition-colors active:scale-95"
          >
            Cancel
          </button>
          <button
            disabled={!chosen}
            onClick={() => chosen && void share(chosen)}
            className="h-9 px-4 rounded-full text-sm font-semibold bg-fg text-ink-900 transition-all duration-150 hover:bg-fg/90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          >
            Share
          </button>
        </div>
      </div>
    </div>
  )
}
