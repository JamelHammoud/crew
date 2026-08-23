import { useEffect, useRef, useState } from 'react'
import Modal from '../Modal'
import Spinner from '../Spinner'

export default function CrewRepo({
  open,
  onClose,
  onConnect
}: {
  open: boolean
  onClose: () => void
  onConnect: (remote: string) => Promise<{ ok: boolean; message: string }>
}) {
  const [remote, setRemote] = useState('')
  const [busy, setBusy] = useState(false)
  const [trouble, setTrouble] = useState('')
  const field = useRef<HTMLInputElement>(null)
  const asked = remote.trim()

  useEffect(() => {
    if (!open) return
    setRemote('')
    setTrouble('')
    setBusy(false)
    field.current?.focus()
  }, [open])

  const send = async () => {
    if (!asked || busy) return
    setBusy(true)
    setTrouble('')
    const done = await onConnect(asked)
    setBusy(false)
    if (done.ok) onClose()
    else setTrouble(done.message)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Connect a repo"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-full text-sm font-semibold text-fg/45 transition-colors hover:text-fg"
          >
            Cancel
          </button>
          <button
            onClick={() => void send()}
            disabled={!asked || busy}
            className="h-10 px-5 rounded-full bg-fg text-ink-900 text-sm font-semibold flex items-center gap-2 transition-colors duration-150 hover:bg-fg/90 active:scale-95 disabled:bg-fg/10 disabled:text-fg/45"
          >
            {busy && <Spinner size={14} />}
            Connect
          </button>
        </div>
      }
    >
      <input
        ref={field}
        autoFocus
        value={remote}
        disabled={busy}
        placeholder="Address of an empty repo"
        aria-label="Repo address"
        spellCheck={false}
        onChange={event => setRemote(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') void send()
        }}
        className="mt-4 w-full h-11 px-3.5 rounded-xl bg-fg/[0.07] text-sm text-fg placeholder:text-fg/35 outline-none border-none transition-colors focus:bg-fg/[0.11]"
      />
      {trouble && <p className="mt-3 text-sm text-danger">{trouble}</p>}
    </Modal>
  )
}
