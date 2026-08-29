import { useEffect, useState } from 'react'
import type { MailAccount } from '../../state/mail'
import { useMail } from '../../state/mail'
import { CheckGlyph, RefreshGlyph, TrashGlyph } from '../../icons'
import Modal from '../Modal'
import Spinner from '../Spinner'
import TextField, { TextArea } from '../TextField'
import MailSetup from './Setup'

export function AddAccount({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Add account" width={460}>
      <div className="pt-5">
        <MailSetup compact onDone={onClose} />
      </div>
    </Modal>
  )
}

export function AccountSettings({
  account,
  open,
  onClose
}: {
  account: MailAccount | null
  open: boolean
  onClose: () => void
}) {
  const updateAccount = useMail(state => state.updateAccount)
  const removeAccount = useMail(state => state.removeAccount)
  const reconnect = useMail(state => state.reconnect)
  const [displayName, setDisplayName] = useState('')
  const [signature, setSignature] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<'save' | 'reconnect' | 'remove' | ''>('')
  const [trouble, setTrouble] = useState('')

  useEffect(() => {
    setDisplayName(account?.displayName ?? '')
    setSignature(account?.signature ?? '')
    setPassword('')
    setTrouble('')
  }, [account])

  if (!account) return null

  const save = async () => {
    setBusy('save')
    setTrouble('')
    const result = await updateAccount(account.id, { displayName: displayName.trim(), signature })
    setBusy('')
    if (result) setTrouble(`${result} Try again.`)
    else onClose()
  }

  const connect = async () => {
    setBusy('reconnect')
    setTrouble('')
    const result = await reconnect(account.id, password.replace(/\s/g, '') || undefined)
    setBusy('')
    if (result) setTrouble(`${result} Check the app password, then try again.`)
    else setPassword('')
  }

  const remove = async () => {
    setBusy('remove')
    setTrouble('')
    const result = await removeAccount(account.id)
    setBusy('')
    if (result) {
      setTrouble(`${result} Try again.`)
      return
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={account.email}
      width={480}
      footer={
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => void remove()}
            disabled={Boolean(busy)}
            className="h-9 px-4 rounded-full flex items-center gap-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10 active:scale-95 disabled:opacity-40"
          >
            {busy === 'remove' ? <Spinner size={15} /> : <TrashGlyph className="w-4 h-4" />}
            Remove
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={Boolean(busy) || !displayName.trim()}
            className="h-9 px-5 rounded-full bg-fg text-ink-900 flex items-center gap-2 text-sm font-semibold transition-colors hover:bg-fg/90 active:scale-95 disabled:opacity-40"
          >
            {busy === 'save' ? <Spinner size={15} /> : <CheckGlyph className="w-4 h-4" />}
            Save
          </button>
        </div>
      }
    >
      <div className="pt-5 space-y-5">
        <label className="block">
          <span className="block text-sm font-medium text-fg-secondary mb-2">Your name</span>
          <TextField value={displayName} onChange={event => setDisplayName(event.target.value)} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-fg-secondary mb-2">Signature</span>
          <TextArea
            value={signature}
            onChange={event => setSignature(event.target.value)}
            rows={4}
            placeholder="Added to new mail"
          />
        </label>
        <div>
          <span className="block text-sm font-medium text-fg-secondary mb-2">Reconnect</span>
          <div className="flex items-center gap-2">
            <TextField
              type="password"
              autoComplete="off"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="New app password"
            />
            <button
              type="button"
              onClick={() => void connect()}
              disabled={Boolean(busy) || (Boolean(password) && password.replace(/\s/g, '').length !== 16)}
              className="h-11 px-4 shrink-0 rounded-full border border-fg/[0.09] flex items-center gap-2 text-sm font-medium text-fg-secondary transition-colors hover:bg-fg/[0.05] hover:text-fg hover:border-fg/20 active:scale-95 disabled:opacity-40"
            >
              {busy === 'reconnect' ? <Spinner size={15} /> : <RefreshGlyph className="w-4 h-4" />}
              Reconnect
            </button>
          </div>
        </div>
        {trouble && (
          <div role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {trouble}
          </div>
        )}
      </div>
    </Modal>
  )
}
