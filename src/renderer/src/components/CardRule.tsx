import { type ReactNode } from 'react'

export default function CardRule({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`-mx-3 mt-2.5 border-t border-fg/[0.06] px-3 pt-2.5 ${className}`}>{children}</div>
}
