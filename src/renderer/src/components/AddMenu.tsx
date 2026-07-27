import { useState } from 'react'
import { MAX_ATTACHMENTS } from '../../../shared/attachments'
import { GifGlyph, PlusGlyph, UploadGlyph } from '../icons'
import { useCrew } from '../state/store'
import { ATTACH_SIZES, PLUS_BUTTON, useImagePicker } from './Attachments'
import GifPicker from './GifPicker'
import { gifFile, type Gif } from './gifs'
import { MenuItem, Popover } from './Popover'
import Tooltip from './Tooltip'

// Choosing a GIF is a screen inside this popover rather than one of its own. A
// popover opened from inside a popover is outside the first one's box, so the
// click that picks a GIF would close the menu under it.
type Screen = 'menu' | 'gif'

export default function AddMenu({ attachmentKey, onSend }: { attachmentKey: string; onSend: () => void }) {
  const count = useCrew(s => (s.pending[attachmentKey] ?? []).length)
  const attach = useCrew(s => s.attach)
  const { input, choose } = useImagePicker(attachmentKey)
  const [open, setOpen] = useState(false)
  const [screen, setScreen] = useState<Screen>('menu')
  const full = count >= MAX_ATTACHMENTS

  const show = () => {
    setScreen('menu')
    setOpen(true)
  }

  // A GIF goes straight out. It is picked whole rather than written around, so
  // there is nothing left to say once it has been chosen, and the message it
  // lands in is the one the composer was already aimed at.
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
