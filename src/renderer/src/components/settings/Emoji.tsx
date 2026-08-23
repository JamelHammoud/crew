import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  customEmojiNameFromFile,
  customEmojiRef,
  CUSTOM_EMOJI_NAME_LIMIT,
  CUSTOM_EMOJI_TYPES,
  type CustomEmoji
} from '../../../../shared/customEmoji'
import { MoreGlyph, PencilGlyph, PlusGlyph, TrashGlyph } from '../../icons'
import { useCrew } from '../../state/store'
import Avatar from '../Avatar'
import EmojiChar from '../Emoji'
import Modal from '../Modal'
import { MenuItem, Popover } from '../Popover'
import Spinner from '../Spinner'
import Tooltip from '../Tooltip'
import { Page, Section } from './parts'

// The crew's own emoji. Whoever adds one, everyone here gets it, and anyone here
// can name one again or take one away.

const ACCEPT = Object.keys(CUSTOM_EMOJI_TYPES).join(',')

const FIELD =
  'w-full h-11 px-3.5 rounded-xl bg-fg/[0.07] text-sm text-fg placeholder:text-fg/35 outline-none border-none transition-colors focus:bg-fg/[0.11]'

// One card that asks one thing: what it is called, with the picture standing
// beside the field. Naming a new one and naming an old one again are the same
// question, so they are the same card, and what comes back from the send is said
// here rather than somewhere the person is not looking.
function NameCard({
  open,
  title,
  action,
  picture,
  name: given,
  onClose,
  onSubmit
}: {
  open: boolean
  title: string
  action: string
  picture: ReactNode
  name: string
  onClose: () => void
  onSubmit: (name: string) => string | null | Promise<string | null>
}) {
  const [name, setName] = useState(given)
  const [busy, setBusy] = useState(false)
  const [trouble, setTrouble] = useState('')
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setName(given)
    setTrouble('')
    setBusy(false)
    // Opened on a name that is already there, all of it is selected, so typing
    // replaces it and the caret is still at the end for anyone editing it.
    const box = field.current
    if (!box) return
    box.focus()
    box.select()
  }, [open, given])

  const send = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    setTrouble('')
    const said = await onSubmit(name)
    setBusy(false)
    if (said) setTrouble(said)
    else onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
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
            disabled={!name.trim() || busy}
            className="h-10 px-5 rounded-full bg-fg text-ink-900 text-sm font-semibold flex items-center gap-2 transition-all duration-150 hover:bg-fg/90 active:scale-95 disabled:bg-fg/10 disabled:text-fg/45"
          >
            {busy && <Spinner size={14} />}
            {action}
          </button>
        </div>
      }
    >
      <div className="mt-4 flex items-center gap-3">
        <span className="w-12 h-12 shrink-0 rounded-xl bg-fg/[0.06] flex items-center justify-center overflow-hidden">
          {picture}
        </span>
        <input
          ref={field}
          value={name}
          disabled={busy}
          maxLength={CUSTOM_EMOJI_NAME_LIMIT}
          placeholder="Name"
          aria-label="Name"
          spellCheck={false}
          onChange={event => setName(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') void send()
          }}
          className={FIELD}
        />
      </div>
      {trouble && <p className="mt-2.5 text-sm text-danger">{trouble}</p>}
    </Modal>
  )
}

// One emoji: the picture, what it is written as, and who put it there. What the
// row can do sits at the end of it in a slot that is held whether or not the
// pointer is there, so nothing shuffles sideways under it.
function EmojiRow({ emoji }: { emoji: CustomEmoji }) {
  const renameCustomEmoji = useCrew(s => s.renameCustomEmoji)
  const removeCustomEmoji = useCrew(s => s.removeCustomEmoji)
  const [open, setOpen] = useState(false)
  const [naming, setNaming] = useState(false)
  const ref = customEmojiRef(emoji.name)

  return (
    <div className="group flex items-center gap-3 px-3 py-2 -mx-3 rounded-2xl transition-colors hover:bg-fg/[0.03]">
      <span className="w-7 h-7 shrink-0 flex items-center justify-center">
        <EmojiChar char={ref} size={24} />
      </span>
      <span className="flex-1 min-w-0 truncate text-base font-mono mono-inline text-fg">{ref}</span>
      <span className="shrink-0 flex items-center gap-2 max-w-[160px] text-sm text-fg/45">
        <Avatar name={emoji.by} px={20} />
        <span className="truncate">{emoji.by}</span>
      </span>
      <span className="relative shrink-0 flex">
        <Tooltip label="More" disabled={open}>
          <button
            onClick={() => setOpen(was => !was)}
            aria-label={`More for ${ref}`}
            aria-expanded={open}
            aria-haspopup="menu"
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150 hover:bg-fg/10 hover:text-fg active:scale-95 focus-visible:opacity-100 ${
              open ? 'bg-fg/10 text-fg opacity-100' : 'text-fg/45 opacity-0 group-hover:opacity-100'
            }`}
          >
            <MoreGlyph className="w-4 h-4" />
          </button>
        </Tooltip>
        <Popover open={open} onClose={() => setOpen(false)} className="w-52">
          <MenuItem
            icon={<PencilGlyph />}
            label="Rename emoji"
            onClick={() => {
              setOpen(false)
              setNaming(true)
            }}
          />
          <MenuItem
            icon={<TrashGlyph />}
            danger
            label="Delete emoji"
            onClick={() => {
              setOpen(false)
              removeCustomEmoji(emoji.id)
            }}
          />
        </Popover>
      </span>
      <NameCard
        open={naming}
        title="Rename emoji"
        action="Rename"
        picture={<EmojiChar char={ref} size={32} />}
        name={emoji.name}
        onClose={() => setNaming(false)}
        onSubmit={name => renameCustomEmoji(emoji.id, name)}
      />
    </div>
  )
}

// The way in stands at the end of the list rather than off in a corner of the
// page, so it is the empty state and the way in both. Picking the picture is the
// first of the two steps and naming it is the second, on one card.
function AddEmoji() {
  const addCustomEmoji = useCrew(s => s.addCustomEmoji)
  const input = useRef<HTMLInputElement>(null)
  const [picked, setPicked] = useState<File | null>(null)
  const url = useMemo(() => (picked ? URL.createObjectURL(picked) : ''), [picked])

  useEffect(() => {
    if (!url) return
    return () => URL.revokeObjectURL(url)
  }, [url])

  return (
    <>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={event => {
          setPicked(event.target.files?.[0] ?? null)
          event.target.value = ''
        }}
      />
      <button
        onClick={() => input.current?.click()}
        className="group w-full flex items-center gap-3 px-5 py-4 rounded-card border border-fg/[0.09] text-left transition-colors duration-200 hover:border-fg/20 hover:bg-fg/[0.03] active:scale-[0.995]"
      >
        <span className="w-10 h-10 rounded-full bg-fg/[0.07] flex items-center justify-center text-fg/70 transition-colors duration-200 group-hover:bg-fg/[0.12] group-hover:text-fg">
          <PlusGlyph className="w-[18px] h-[18px]" />
        </span>
        <span className="text-base font-semibold text-fg">Add an emoji</span>
      </button>
      <NameCard
        open={picked !== null}
        title="Add an emoji"
        action="Add"
        // Drawn as it arrived, so a GIF is animating on the card the name is
        // chosen against.
        picture={url ? <img src={url} alt="" className="max-w-10 max-h-10 object-contain" /> : null}
        name={picked ? customEmojiNameFromFile(picked.name) : ''}
        onClose={() => setPicked(null)}
        onSubmit={name => (picked ? addCustomEmoji(name, picked) : null)}
      />
    </>
  )
}

export default function Emoji() {
  const emoji = useCrew(s => s.emoji)
  const sorted = [...emoji].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <Page title="Emoji">
      <Section>
        {sorted.length > 0 && (
          <div className="space-y-0.5 mb-4">
            {sorted.map(one => (
              <EmojiRow key={one.id} emoji={one} />
            ))}
          </div>
        )}
        <AddEmoji />
      </Section>
    </Page>
  )
}
