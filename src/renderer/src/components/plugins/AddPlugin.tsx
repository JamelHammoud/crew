import { useEffect, useRef, useState } from 'react'
import { pluginFrom } from '../../../../shared/plugins'
import { PlusGlyph } from '../../icons'
import { useCrew } from '../../state/store'
import Modal from '../Modal'
import TextField from '../TextField'

export default function AddPlugin() {
  const addPlugin = useCrew(s => s.addPlugin)
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [where, setWhere] = useState('')
  const [trouble, setTrouble] = useState('')
  const first = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setLabel('')
    setWhere('')
    setTrouble('')
    first.current?.focus()
  }, [open])

  const send = () => {
    if (!label.trim() || !where.trim()) return
    const said = addPlugin(pluginFrom(label, where))
    if (said) setTrouble(said)
    else setOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group w-full flex items-center gap-3 px-5 py-4 rounded-card border border-fg/[0.09] text-left transition-colors duration-200 hover:border-fg/20 hover:bg-fg/[0.03] active:scale-[0.995]"
      >
        <span className="w-10 h-10 rounded-full bg-fg/[0.07] flex items-center justify-center text-fg/70 transition-colors duration-200 group-hover:bg-fg/[0.12] group-hover:text-fg">
          <PlusGlyph className="w-[18px] h-[18px]" />
        </span>
        <span className="text-base font-semibold text-fg">Add one of your own</span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add a plugin">
        <div className="mt-4 space-y-3">
          <TextField
            ref={first}
            value={label}
            placeholder="Name"
            aria-label="Name"
            onChange={event => setLabel(event.target.value)}
          />
          <TextField
            value={where}
            placeholder="https://mcp.example.com/mcp"
            aria-label="Where it runs"
            spellCheck={false}
            onChange={event => setWhere(event.target.value)}
            onKeyDown={event => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              send()
            }}
          />
        </div>
        {trouble && <p className="mt-2.5 text-sm text-danger">{trouble}</p>}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={() => setOpen(false)}
            className="h-10 px-4 rounded-full text-sm font-semibold text-fg/45 transition-colors hover:text-fg"
          >
            Cancel
          </button>
          <button
            onClick={send}
            disabled={!label.trim() || !where.trim()}
            className="h-10 px-5 rounded-full bg-fg text-ink-900 text-sm font-semibold transition-all duration-150 hover:bg-fg/90 active:scale-95 disabled:bg-fg/10 disabled:text-fg/45"
          >
            Add
          </button>
        </div>
      </Modal>
    </>
  )
}
