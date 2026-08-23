import { useEffect, useRef, useState } from 'react'
import { PLACE_NAME_LIMIT } from '../../state/placeNames'
import Modal from '../Modal'
import TextField from '../TextField'

export default function PlaceName({
  open,
  given,
  name: standing,
  onClose,
  onSubmit
}: {
  open: boolean
  given: string
  name: string
  onClose: () => void
  onSubmit: (name: string) => void
}) {
  const [name, setName] = useState(standing)
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setName(standing)
    const box = field.current
    if (!box) return
    box.focus()
    box.select()
  }, [open, standing])

  const send = () => {
    onSubmit(name)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Rename"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-full text-sm font-semibold text-fg/45 transition-colors hover:text-fg"
          >
            Cancel
          </button>
          <button
            onClick={send}
            className="h-10 px-5 rounded-full bg-fg text-ink-900 text-sm font-semibold transition-all duration-150 hover:scale-[1.03] active:scale-95"
          >
            Rename
          </button>
        </div>
      }
    >
      <TextField
        glass
        ref={field}
        autoFocus
        value={name}
        maxLength={PLACE_NAME_LIMIT}
        placeholder={given}
        aria-label="Name"
        spellCheck={false}
        onChange={event => setName(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') send()
        }}
        className="mt-4 h-11 rounded-xl"
      />
    </Modal>
  )
}
