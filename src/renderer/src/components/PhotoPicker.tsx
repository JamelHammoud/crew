import { useRef, useState, type ReactNode } from 'react'
import { IMAGE_TYPES } from '../../../shared/attachments'
import { TrashGlyph, UploadGlyph } from '../icons'
import { MenuItem, Popover } from './Popover'

const ACCEPT = Object.keys(IMAGE_TYPES).join(',')

// The face itself is the control, and it is the only one: nothing anywhere
// says photo in words. Hover it and the upload mark comes up, which opens the
// file dialog while there is no photo on, and the two things you can do to one
// when there is. The scrim stops under the presence dot, which stands above it.
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
  const picker = useRef<HTMLInputElement>(null)

  const pick = () => {
    setMenu(false)
    picker.current?.click()
  }

  return (
    <span className="relative inline-flex shrink-0">
      {children}
      <button
        onClick={() => (has ? setMenu(true) : pick())}
        aria-label={has ? 'Change photo' : 'Add a photo'}
        className="absolute inset-0 rounded-full flex items-center justify-center bg-ink-900/70 text-fg opacity-0 transition-all duration-150 hover:opacity-100 focus-visible:opacity-100 active:scale-95"
      >
        <UploadGlyph className="w-4 h-4" />
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
