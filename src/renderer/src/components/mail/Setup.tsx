import { useMemo, useState, type FormEvent } from 'react'
import { ExternalLinkGlyph, QuestionGlyph } from '../../icons'
import Spinner from '../Spinner'
import TextField from '../TextField'
import Tooltip from '../Tooltip'
import { useMail } from '../../state/mail'

const APP_PASSWORDS = 'https://myaccount.google.com/apppasswords'

export default function MailSetup({ compact = false, onDone }: { compact?: boolean; onDone?: () => void }) {
  const connect = useMail(state => state.connect)
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [appPassword, setAppPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [trouble, setTrouble] = useState('')
  const password = useMemo(() => appPassword.replace(/\s/g, ''), [appPassword])
  const valid = /^\S+@\S+\.\S+$/.test(email.trim()) && displayName.trim().length > 0 && password.length === 16

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setTrouble('')
    const result = await connect(email.trim(), displayName.trim(), password)
    setBusy(false)
    if (result) {
      setTrouble(result)
      return
    }
    onDone?.()
  }

  return (
    <div className={`${compact ? 'px-1 py-2' : 'h-full overflow-y-auto px-6'}`}>
      <div className={`${compact ? '' : 'max-w-[440px] mx-auto pt-24 pb-24'}`}>
        {!compact && (
          <div className="mb-9">
            <h1 className="text-2xl font-semibold text-fg">Mail</h1>
          </div>
        )}

        <form onSubmit={event => void submit(event)} className="space-y-5">
          <label className="block">
            <span className="block text-sm font-medium text-fg-secondary mb-2">Google email</span>
            <TextField
              type="email"
              autoComplete="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="name@gmail.com"
              aria-invalid={Boolean(email) && !/^\S+@\S+\.\S+$/.test(email.trim())}
            />
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-fg-secondary mb-2">Your name</span>
            <TextField
              autoComplete="name"
              value={displayName}
              onChange={event => setDisplayName(event.target.value)}
              placeholder="Name on sent mail"
            />
          </label>

          <label className="block">
            <span className="flex items-center justify-between gap-3 mb-2">
              <span className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-fg-secondary">App password</span>
                <Tooltip label="Your password stays on this computer.">
                  <button
                    type="button"
                    aria-label="About app passwords"
                    className="flex text-fg-faint transition-colors hover:text-fg-secondary active:scale-[0.98]"
                  >
                    <QuestionGlyph className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              </span>
              <button
                type="button"
                onClick={() => void window.crew.openExternal(APP_PASSWORDS)}
                className="flex items-center gap-1.5 text-xs font-medium text-fg-muted transition-colors hover:text-fg active:scale-[0.98]"
              >
                Create one
                <ExternalLinkGlyph className="w-3.5 h-3.5" />
              </button>
            </span>
            <TextField
              type="password"
              autoComplete="off"
              value={appPassword}
              onChange={event => setAppPassword(event.target.value)}
              placeholder="16 characters"
              aria-invalid={Boolean(password) && password.length !== 16}
            />
          </label>

          {trouble && (
            <div role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
              {trouble} Turn on 2-Step Verification and create a new 16-character app password. Managed Google accounts may block app passwords.
            </div>
          )}

          <button
            type="submit"
            disabled={!valid || busy}
            className="w-full h-11 rounded-full bg-fg text-ink-900 text-sm font-semibold flex items-center justify-center gap-2 transition-colors hover:bg-fg/90 active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none"
          >
            {busy && <Spinner size={16} />}
            {busy ? 'Connecting' : 'Connect'}
          </button>
        </form>
      </div>
    </div>
  )
}
