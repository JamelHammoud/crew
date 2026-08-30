import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { toast } from '../../state/toast'
import { CopyGlyph } from '../../icons'
import Avatar from '../Avatar'
import Tooltip from '../Tooltip'

export const iconButtonClass =
  'w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-fg/45 transition-[background-color,color,transform] duration-150 hover:bg-fg/[0.07] hover:text-fg active:scale-90 disabled:opacity-35 disabled:pointer-events-none'

export function IconButton({
  label,
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <Tooltip label={label} disabled={props.disabled}>
      <button type="button" aria-label={label} className={`${iconButtonClass} ${className}`} {...props}>
        {children}
      </button>
    </Tooltip>
  )
}

export function ContactMark({ name, email, size = 'sm' }: { name?: string; email: string; size?: 'xs' | 'sm' | 'md' }) {
  return <Avatar name={name?.trim() || email} size={size} />
}

export function AccountMark({ email, color }: { email: string; color?: string }) {
  return (
    <span
      aria-hidden
      className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-ink-900"
      style={{ backgroundColor: color ?? accountColor(email) }}
    />
  )
}

const ACCOUNT_COLORS = ['#f59e8b', '#8dc7bd', '#a7b6ef', '#d9aeec', '#e9c873', '#8ebde5']

export function accountColor(email: string): string {
  let hash = 0
  for (const char of email) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return ACCOUNT_COLORS[Math.abs(hash) % ACCOUNT_COLORS.length]
}

export function displayAddress(name: string | undefined, email: string): string {
  return name?.trim() || email
}

export function fullAddress(name: string | undefined, email: string): string {
  return name?.trim() ? `${name.trim()} <${email}>` : email
}

export function MailAddressButton({
  name,
  email,
  className = ''
}: {
  name?: string
  email: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const reset = useRef<number | null>(null)

  useEffect(() => () => {
    if (reset.current !== null) window.clearTimeout(reset.current)
  }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email)
      setCopied(true)
      if (reset.current !== null) window.clearTimeout(reset.current)
      reset.current = window.setTimeout(() => setCopied(false), 1200)
    } catch {
      toast.fail('Email address could not be copied.')
    }
  }

  return (
    <Tooltip label={copied ? 'Copied' : email} className="min-w-0 max-w-full">
      <button
        type="button"
        aria-label={`Copy ${fullAddress(name, email)}`}
        onClick={() => void copy()}
        className={`group min-w-0 max-w-full flex items-center gap-1 text-left transition-colors hover:text-fg focus-visible:outline-none focus-visible:text-fg ${className}`}
      >
        <span className="min-w-0 truncate">{displayAddress(name, email)}</span>
        <CopyGlyph className="w-3 h-3 shrink-0 text-fg/25 transition-colors group-hover:text-fg/60 group-focus-visible:text-fg/60" />
      </button>
    </Tooltip>
  )
}

export function mailDate(value: string, long = false): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const now = new Date()
  if (long) {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date)
  }
  if (date.toDateString() === now.toDateString()) {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)
  }
  if (date.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
  }
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: '2-digit' }).format(date)
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

export function initials(value: string): string {
  const words = value.trim().split(/\s+/)
  return (words.length > 1 ? `${words[0][0]}${words.at(-1)?.[0] ?? ''}` : words[0]?.slice(0, 2) || '?').toUpperCase()
}
