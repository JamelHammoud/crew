import { useState } from 'react'
import { MAX_ATTACHMENTS } from '../../../shared/attachments'
import { GifGlyph, PlusGlyph, SignalGlyph, UploadGlyph } from '../icons'
import { useHuddle } from '../state/huddle'
import { useCrew } from '../state/store'
import { ATTACH_SIZES, PLUS_BUTTON, useImagePicker } from './Attachments'
import GifPicker from './GifPicker'
import { gifFile, type Gif } from './gifs'
import { MenuDivider, MenuItem, Popover } from './Popover'
import Tooltip from './Tooltip'

type Screen = 'menu' | 'gif'

export default function AddMenu({
  attachmentKey,
  huddle,
  onSend
}: {
  attachmentKey: string
  huddle?: boolean
  onSend: () => void
}) {
  const count = useCrew(s => (s.pending[attachmentKey] ?? []).length)
  const attach = useCrew(s => s.attach)
  const joined = useHuddle(s => s.joined)
  const live = useHuddle(s => s.room.peers.length > 0)
  const join = useHuddle(s => s.join)
  const { input, choose } = useImagePicker(attachmentKey)
  const [open, setOpen] = useState(false)
  const [screen, setScreen] = useState<Screen>('menu')
  const full = count >= MAX_ATTACHMENTS
  // Once you are in the call the dock is on screen and holds the way out, so
  // the row is only ever a way in.
  const calling = huddle === true && !joined

  const show = () => {
    setScreen('menu')
    setOpen(true)
  }

  const pick = async (gif: Gif) => {
    await attach(attachmentKey, [await gifFile(gif)])
    setOpen(false)
    onSend()
  }

  return (
    <>
      {input}
      <Tooltip label={full ? `Up to ${MAX_ATTACHMENTS} images` : 'Add to your message'} disabled={open}>
        <button
          onClick={() => (open ? setOpen(false) : show())}
          disabled={full}
          aria-label="Add to your message"
          aria-expanded={open}
          data-active={open ? '' : undefined}
          className={`${ATTACH_SIZES.md} ${PLUS_BUTTON}`}
        >
          <PlusGlyph className="w-5 h-5" />
        </button>
      </Tooltip>
      <Popover open={open} onClose={() => setOpen(false)} align="start" side="top" flush>
        {screen === 'menu' ? (
          <div className="p-1.5">
            <MenuItem
              icon={<UploadGlyph />}
              label="Upload a file"
              onClick={() => {
                setOpen(false)
                choose()
              }}
            />
            <MenuItem icon={<GifGlyph />} label="Pick a GIF" onClick={() => setScreen('gif')} />
          </div>
        ) : (
          <GifPicker onPick={pick} />
        )}
      </Popover>
    </>
  )
}
