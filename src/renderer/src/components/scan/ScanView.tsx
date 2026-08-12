import { useEffect } from 'react'
import { sayCount, SCANNER_HOME, type ScanFinding, type ScanReport } from '../../../../shared/scan'
import { RefreshGlyph, ShieldGlyph } from '../../icons'
import { useBrowser } from '../../state/browser'
import { useScan } from '../../state/scan'
import { useCrew } from '../../state/store'
import Empty from '../Empty'
import Spinner from '../Spinner'
import Tooltip from '../Tooltip'

const HEAVY = new Set(['critical', 'high'])

function Finding({ finding }: { finding: ScanFinding }) {
  return (
    <button
      onClick={() => useBrowser.getState().openFile(finding.file, finding.line)}
      className="w-full rounded-card px-2 py-1.5 text-left transition-colors hover:bg-fg/[0.04] active:scale-[0.99]"
    >
      <span className="flex items-center gap-2">
        <span
          className={`shrink-0 text-[11px] font-medium ${HEAVY.has(finding.severity) ? 'text-danger' : 'text-fg-muted'}`}
        >
          {finding.severity}
        </span>
        <span className="truncate text-sm text-fg">{finding.title}</span>
      </span>
      <span className="mt-0.5 block truncate font-mono text-xs text-fg-faint">
        {finding.file}:{finding.line}
      </span>
    </button>
  )
}

function Said({ report }: { report: ScanReport }) {
  if (report.kind === 'nowhere')
    return <Empty icon={<ShieldGlyph className="w-8 h-8 text-fg-faint" />} label="Open a project to scan it" />
  if (report.kind === 'missing')
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
        <ShieldGlyph className="w-8 h-8 text-fg-faint" />
        <p className="text-sm text-fg-muted">The scanner is not on this computer</p>
        <button
          onClick={() => void window.crew?.openExternal?.(SCANNER_HOME)}
          className="rounded-full bg-fg px-3 py-1.5 text-xs font-medium text-ink-900 transition-colors hover:bg-fg/90 active:scale-95"
        >
          Get ThreatCrush
        </button>
      </div>
    )
  if (report.kind === 'failed')
    return (
      <Empty
        icon={<ShieldGlyph className="w-8 h-8 text-fg-faint" />}
        label="The scan did not finish"
        detail={report.message}
      />
    )
  if (report.findings.length === 0)
    return <Empty icon={<ShieldGlyph className="w-8 h-8 text-fg-faint" />} label="Nothing found" />
  return (
    <div className="flex flex-col gap-0.5 px-1.5 pb-3">
      {report.findings.map(finding => (
        <Finding key={finding.id} finding={finding} />
      ))}
    </div>
  )
}

export default function ScanView() {
  const report = useScan(s => s.report)
  const running = useScan(s => s.running)
  const folder = useCrew(s => s.folder)
  const found = report?.kind === 'found' ? report.findings.length : 0

  useEffect(() => {
    useScan.getState().scan(folder)
  }, [folder])

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 pl-3 pr-1.5">
        <span className="truncate text-xs font-medium text-fg-muted">
          {running ? 'Scanning' : found > 0 ? sayCount(found, 'problem', 'problems') : 'Security'}
        </span>
        <span className="flex-1" />
        <Tooltip label="Scan again">
          <button
            aria-label="Scan again"
            onClick={() => useScan.getState().scan(folder, true)}
            disabled={running}
            className="flex h-7 w-7 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-fg/10 hover:text-fg active:scale-90 disabled:pointer-events-none disabled:opacity-30"
          >
            {running ? <Spinner size={13} /> : <RefreshGlyph className="w-4 h-4" />}
          </button>
        </Tooltip>
      </div>
      <div className="relative flex-1 overflow-y-auto">{report && <Said report={report} />}</div>
    </div>
  )
}
