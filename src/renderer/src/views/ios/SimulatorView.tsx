import { useEffect, useMemo, useRef } from 'react'
import { iosSays, type IosIssue } from '../../../../shared/iosLive'
import { XCODE_STORE } from '../../../../shared/iosSetup'
import { PhoneGlyph, RefreshGlyph, TerminalGlyph, WarningGlyph } from '../../icons'
import InsetRing from '../../components/InsetRing'
import Spinner from '../../components/Spinner'
import Tooltip from '../../components/Tooltip'
import { useBrowser } from '../../state/browser'
import { useIos } from '../../state/ios'

function Action({
  label,
  mark,
  onClick,
  disabled
}: {
  label: string
  mark: React.ReactNode
  onClick: () => void
  disabled?: boolean
}): React.ReactElement {
  return (
    <Tooltip label={label}>
      <button
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className="h-8 w-8 grid place-items-center rounded-full text-fg-muted hover:text-fg hover:bg-ink-hover active:scale-95 disabled:opacity-40"
      >
        {mark}
      </button>
    </Tooltip>
  )
}

function Issues({ issues }: { issues: IosIssue[] }) {
  const errors = issues.filter(issue => issue.kind === 'error')
  if (errors.length === 0) return null
  return (
    <div className="shrink-0 max-h-40 overflow-y-auto no-scrollbar border-t border-ink-700 px-4 py-3 space-y-2 select-text">
      {errors.map((issue, at) => (
        <button
          key={`${issue.file}:${issue.line}:${at}`}
          onClick={() => issue.file && useBrowser.getState().openFile(issue.file, issue.line)}
          className="w-full text-left group"
        >
          <p className="text-sm text-danger">{issue.message}</p>
          {issue.file && (
            <p className="text-xs text-fg-faint group-hover:text-fg-muted">
              {issue.file.split('/').pop()}:{issue.line}
            </p>
          )}
        </button>
      ))}
    </div>
  )
}

export default function SimulatorView(): React.ReactElement {
  const live = useIos(s => s.live)
  const frame = useIos(s => s.frame)
  const log = useIos(s => s.log)
  const starting = useIos(s => s.starting)
  const finishing = useIos(s => s.finishing)
  const problem = useIos(s => s.problem)
  const start = useIos(s => s.start)
  const finish = useIos(s => s.finish)
  const rebuild = useIos(s => s.rebuild)
  const logRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    if (live.phase === 'off' && !starting) void start()
  }, [live.phase, starting, start])

  useEffect(() => {
    const box = logRef.current
    if (box) box.scrollTop = box.scrollHeight
  }, [log])

  const says = useMemo(() => iosSays(live), [live])
  const busy = live.phase === 'booting' || live.phase === 'building' || live.phase === 'installing' || starting

  if (live.phase === 'setup' && live.setup) {
    const setup = live.setup
    return (
      <div className="absolute inset-0 grid place-items-center px-8">
        <div className="max-w-xs text-center">
          <PhoneGlyph className="w-8 h-8 text-fg-faint mx-auto" />
          <p className="mt-4 text-sm text-fg-muted">{setup.says}</p>
          {setup.button && (
            <button
              disabled={finishing}
              onClick={() => (setup.need === 'xcode' ? void window.crew.openExternal(XCODE_STORE) : void finish())}
              className="mt-5 h-9 px-4 rounded-full bg-fg text-ink-900 text-sm font-medium hover:bg-fg/90 active:scale-95 disabled:opacity-40"
            >
              {finishing ? 'Setting up' : setup.button}
            </button>
          )}
          {problem && <p className="mt-4 text-sm text-danger select-text">{problem}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="shrink-0 h-11 px-3 flex items-center gap-2 border-b border-ink-700">
        <span className="grid place-items-center w-5">
          {busy ? <Spinner size={14} /> : <PhoneGlyph className="w-4 h-4 text-fg-muted" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-fg truncate">{live.device?.name || 'Simulator'}</p>
        </div>
        <span className="text-xs text-fg-faint truncate max-w-[9rem]">{says}</span>
        <Action
          label="Build again"
          mark={<RefreshGlyph className="w-4 h-4" />}
          disabled={busy || live.phase === 'off'}
          onClick={rebuild}
        />
        <Action
          label="Open Simulator"
          mark={<TerminalGlyph className="w-4 h-4" />}
          disabled={!live.device}
          onClick={() => void window.crew.openIosSimulator(live.device?.id ?? '')}
        />
      </div>

      <div className="flex-1 min-h-0 grid place-items-center bg-ink-950 p-4">
        {frame ? (
          <div className="relative h-full">
            <img src={frame.dataUrl} alt="" className="h-full w-auto rounded-[2rem] object-contain" draggable={false} />
            <InsetRing className="rounded-[2rem] ring-fg/10" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {busy ? <Spinner size={20} /> : <PhoneGlyph className="w-8 h-8 text-fg-faint" />}
            <p className="text-sm text-fg-muted">{says || 'Nothing on the screen yet'}</p>
          </div>
        )}
      </div>

      {live.phase === 'failed' && (live.message || problem) && (
        <div className="shrink-0 flex items-start gap-2 border-t border-ink-700 px-4 py-3">
          <WarningGlyph className="w-4 h-4 text-danger shrink-0 mt-0.5" />
          <p className="text-sm text-fg select-text">{live.message || problem}</p>
        </div>
      )}
      <Issues issues={live.issues} />

      <pre
        ref={logRef}
        className="shrink-0 h-32 overflow-y-auto no-scrollbar border-t border-ink-700 px-4 py-3 text-xs leading-relaxed text-fg-muted whitespace-pre-wrap break-words select-text"
      >
        {log}
      </pre>
    </div>
  )
}
