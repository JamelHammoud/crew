import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { toast } from '../../state/toast'
import { CheckGlyph, CopyGlyph } from '../../icons'
import Avatar from '../Avatar'
import HoverCard from '../HoverCard'
import InsetRing from '../InsetRing'
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

const PERSONAL_MAIL_DOMAINS = new Set([
  'aol.com',
  'fastmail.com',
  'gmail.com',
  'googlemail.com',
  'hey.com',
  'hotmail.com',
  'icloud.com',
  'live.com',
  'mac.com',
  'me.com',
  'msn.com',
  'outlook.com',
  'pm.me',
  'proton.me',
  'protonmail.com',
  'yahoo.com'
])

function mailDomain(email: string): string | undefined {
  const domain = email.trim().toLowerCase().slice(email.lastIndexOf('@') + 1).replace(/\.$/, '')
  if (!email.includes('@') || !domain.includes('.') || domain.endsWith('.test') || domain.endsWith('.local')) return
  if (!domain.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return
  if ([...PERSONAL_MAIL_DOMAINS].some(personal => domain === personal || domain.endsWith(`.${personal}`))) return
  return domain
}

export function companyLogoUrls(email: string): string[] {
  const domain = mailDomain(email)
  if (!domain) return []
  const labels = domain.split('.')
  const domains = labels.map((_, index) => labels.slice(index).join('.')).filter(one => one.split('.').length >= 2)
  return domains.map(one =>
    `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(`https://${one}`)}&sz=128`
  )
}

function CompanyLogo({ email }: { email: string }) {
  const urls = companyLogoUrls(email)
  const [index, setIndex] = useState(0)
  const [ready, setReady] = useState(false)
  const src = urls[index]
  if (!src) return null
  const next = () => {
    setReady(false)
    setIndex(value => value + 1)
  }
  return (
    <span
      data-company-logo={ready ? '' : undefined}
      className={`absolute inset-0 overflow-hidden rounded-full bg-white transition-opacity duration-150 ${ready ? 'opacity-100' : 'opacity-0'}`}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        onLoad={event => {
          if (event.currentTarget.naturalWidth <= 16 && event.currentTarget.naturalHeight <= 16) {
            next()
            return
          }
          setReady(true)
        }}
        onError={next}
        className="block w-full h-full object-contain"
      />
      <InsetRing className="ring-1 ring-inset ring-fg/5" />
    </span>
  )
}

export function ContactMark({ name, email, size = 'sm' }: { name?: string; email: string; size?: 'xs' | 'sm' | 'md' }) {
  const label = name?.trim() || email
  return (
    <span className="relative inline-flex shrink-0">
      <Avatar name={label} size={size} />
      <CompanyLogo key={email.trim().toLowerCase()} email={email} />
    </span>
  )
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
    <HoverCard
      hug
      width={320}
      className="min-w-0 max-w-full"
      content={
        <span className="flex items-center gap-2 pl-1 text-xs text-fg/70">
          <span className="whitespace-nowrap select-text">{email}</span>
          <button
            type="button"
            aria-label={copied ? 'Email copied' : 'Copy email address'}
            onClick={() => void copy()}
            className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-fg/45 transition-[background-color,color,transform] hover:bg-fg/[0.07] hover:text-fg active:scale-90"
          >
            {copied ? <CheckGlyph className="w-3.5 h-3.5" /> : <CopyGlyph className="w-3.5 h-3.5" />}
          </button>
        </span>
      }
    >
      <button
        type="button"
        aria-label={`Copy ${fullAddress(name, email)}`}
        onClick={() => void copy()}
        className={`min-w-0 max-w-full truncate text-left transition-colors hover:text-fg focus-visible:outline-none focus-visible:text-fg ${className}`}
      >
        {displayAddress(name, email)}
      </button>
    </HoverCard>
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
