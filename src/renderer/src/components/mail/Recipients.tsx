import { useMemo, useState, type KeyboardEvent } from 'react'
import type { MailAddress } from '../../state/mail'
import { CloseGlyph } from '../../icons'
import { Popover } from '../Popover'
import { ContactMark, displayAddress } from './parts'

function addressFrom(value: string): MailAddress | null {
  const clean = value.trim().replace(/,$/, '')
  const held = clean.match(/^(.*?)\s*<([^>]+)>$/)
  const email = (held?.[2] ?? clean).trim()
  if (!/^\S+@\S+\.\S+$/.test(email)) return null
  const name = held?.[1].trim().replace(/^['"]|['"]$/g, '')
  return { email, name: name || undefined }
}

export default function RecipientField({
  label,
  recipients,
  suggestions,
  onChange,
  autoFocus
}: {
  label: string
  recipients: MailAddress[]
  suggestions: MailAddress[]
  onChange: (recipients: MailAddress[]) => void
  autoFocus?: boolean
}) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const matches = useMemo(() => {
    const find = value.toLowerCase().trim()
    const chosen = new Set(recipients.map(address => address.email.toLowerCase()))
    return suggestions
      .filter(address => !chosen.has(address.email.toLowerCase()))
      .filter(address => !find || `${address.name ?? ''} ${address.email}`.toLowerCase().includes(find))
      .slice(0, 6)
  }, [recipients, suggestions, value])

  const add = (address: MailAddress) => {
    if (!recipients.some(one => one.email.toLowerCase() === address.email.toLowerCase())) onChange([...recipients, address])
    setValue('')
  }

  const commit = () => {
    const values = value.split(/[;,]/).map(addressFrom).filter((address): address is MailAddress => Boolean(address))
    if (values.length > 0) {
      let next = [...recipients]
      for (const address of values) {
        if (!next.some(one => one.email.toLowerCase() === address.email.toLowerCase())) next = [...next, address]
      }
      onChange(next)
      setValue('')
    }
  }

  const key = (event: KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === 'Enter' || event.key === ',' || event.key === ';') && value.trim()) {
      event.preventDefault()
      const address = addressFrom(value)
      if (address) add(address)
      else if (matches[0]) add(matches[0])
      return
    }
    if (event.key === 'Backspace' && !value && recipients.length > 0) onChange(recipients.slice(0, -1))
  }

  return (
    <div className="relative min-h-11 px-3 py-1.5 border-b border-fg/[0.06] flex items-start gap-2">
      <span className="w-7 shrink-0 pt-1.5 text-xs text-fg/35">{label}</span>
      <div className="min-w-0 flex-1 flex flex-wrap items-center gap-1.5">
        {recipients.map(address => (
          <span
            key={address.email.toLowerCase()}
            className="max-w-full h-7 pl-2.5 pr-1 rounded-full bg-fg/[0.07] flex items-center gap-1 text-xs text-fg/70"
          >
            <span className="truncate">{displayAddress(address.name, address.email)}</span>
            <button
              type="button"
              aria-label={`Remove ${address.email}`}
              onClick={() => onChange(recipients.filter(one => one.email !== address.email))}
              className="w-5 h-5 rounded-full flex items-center justify-center text-fg/30 transition-colors hover:text-fg active:scale-90"
            >
              <CloseGlyph className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          value={value}
          onChange={event => setValue(event.target.value)}
          onKeyDown={key}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            window.setTimeout(() => setFocused(false), 100)
            commit()
          }}
          autoFocus={autoFocus}
          aria-label={label}
          className="min-w-[120px] flex-1 h-7 bg-transparent text-sm text-fg outline-none placeholder:text-fg/30"
        />
      </div>
      <Popover open={focused && matches.length > 0} onClose={() => setFocused(false)} align="start" className="w-72">
        {matches.map(address => (
          <button
            key={address.email.toLowerCase()}
            type="button"
            onPointerDown={event => event.preventDefault()}
            onClick={() => add(address)}
            className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-left transition-colors hover:bg-fg/[0.05] active:scale-[0.98]"
          >
            <ContactMark name={address.name} email={address.email} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-fg/75">{displayAddress(address.name, address.email)}</span>
              {address.name && <span className="block truncate text-xs text-fg/35">{address.email}</span>}
            </span>
          </button>
        ))}
      </Popover>
    </div>
  )
}
