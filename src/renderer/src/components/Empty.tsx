import type { ReactNode } from 'react'

export default function Empty({
  icon,
  label,
  detail
}: {
  icon: ReactNode
  label: string
  detail?: string
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
      {icon}
      <p className="text-sm text-fg-muted">{label}</p>
      {detail && <p className="text-xs font-mono text-fg-faint break-all text-center">{detail}</p>}
    </div>
  )
}
