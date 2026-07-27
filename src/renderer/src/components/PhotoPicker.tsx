import { useRef, useState, type ReactNode } from 'react'
import { IMAGE_TYPES } from '../../../shared/attachments'
import { PhotoGlyph, TrashGlyph, UploadGlyph } from '../icons'
import { MenuItem, Popover } from './Popover'

const ACCEPT = Object.keys(IMAGE_TYPES).join(',')

// The file dialog, wherever a photo is chosen from. The input has to stand
// outside any menu that offers it: a popover unmounts on the click that opened
// the dialog, and an input taken off the page takes the dialog with it.
export function usePhotoInput(onPick: (file: File) => void): {
  open: () => void
  input: ReactNode
} {
  const picker = useRef<HTMLInputElement>(null)
  return {
    open: () => picker.current?.click(),
    input: (
      <input
        ref={picker}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={event => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) onPick(file)
        }}
      />
    )
  }
}

// The face itself is the control. Hover it and the camera comes up: with no
// photo on yet that opens the picker straight away, and with one on it opens
// the two things you can do to it.
export default function PhotoPicker({
  has,
  onChange,
  children
}: {
  has: boolean
  onChange: (file: File | null) => void
  children: ReactNode
}) {
  const [menu, setMenu] = useState(false)
  const { open, input } = usePhotoInput(onChange)

  const pick = () => {
    setMenu(false)
    open()
  }

  return (
    <span className="relative inline-flex shrink-0">
      {children}
      <button
        onClick={() => (has ? setMenu(true) : pick())}
        aria-label={has ? 'Change photo' : 'Add a photo'}
        className="absolute inset-0 rounded-full flex items-center justify-center bg-ink-900/70 text-fg opacity-0 transition-all duration-150 hover:opacity-100 focus-visible:opacity-100 active:scale-95"
      >
        <PhotoGlyph className="w-4 h-4" />
      </button>
      <Popover open={menu} onClose={() => setMenu(false)} align="start">
        <MenuItem icon={<UploadGlyph />} label="Change photo" onClick={pick} />
        <MenuItem
          icon={<TrashGlyph />}
          label="Remove photo"
          danger
          onClick={() => {
            setMenu(false)
            onChange(null)
          }}
        />
      </Popover>
      <input
        ref={picker}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={event => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) onChange(file)
        }}
      />
    </span>
  )
}
