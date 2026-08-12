import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

// A line of text somebody types. It is the sunken field the app uses wherever
// something is asked for outright, rather than the pill a search wears.
const FIELD =
  'w-full bg-ink-800 rounded-2xl px-4 py-3 text-base text-fg placeholder:text-fg-muted outline-none transition-shadow duration-200 focus:shadow-[0_0_0_1px_rgb(255_255_255/0.12)] light:focus:shadow-[0_0_0_1px_rgb(0_0_0/0.14)]'

// The same field standing on glass, where a sunken surface would be a solid grey
// patch and the muted greys inside it would vanish over whatever is behind. It
// takes the foreground at an opacity instead, the way everything else on a
// floating panel does.
const GLASS =
  'w-full bg-fg/[0.07] rounded-full px-3.5 h-9 text-sm text-fg placeholder:text-fg/30 outline-none transition-colors duration-150 hover:bg-fg/[0.1] focus:bg-fg/[0.14]'

// The same field with room for more than a line. A pill is what a field wears
// wherever it holds one, and a box that holds a paragraph cannot: the curve that
// reads as a pill on a 36 high row reads as a lozenge on a 70 high one, and the
// first line of type sits inside the bend. So it takes the radius a box wears,
// squarer than the pills around it and softer than the card it stands on.
const AREA =
  'w-full resize-none bg-ink-800 rounded-xl px-4 py-3 text-base leading-6 text-fg placeholder:text-fg-muted outline-none transition-shadow duration-200 focus:shadow-[0_0_0_1px_rgb(255_255_255/0.12)] light:focus:shadow-[0_0_0_1px_rgb(0_0_0/0.14)]'

const GLASS_AREA =
  'w-full resize-none bg-fg/[0.07] rounded-xl px-3.5 py-2.5 text-sm leading-5 text-fg placeholder:text-fg/30 outline-none transition-colors duration-150 hover:bg-fg/[0.1] focus:bg-fg/[0.14]'

const TextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { glass?: boolean }>(
  ({ className = '', glass, ...rest }, ref) => (
    <input ref={ref} className={`${glass ? GLASS : FIELD} ${className}`} {...rest} />
  )
)

TextField.displayName = 'TextField'

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { glass?: boolean }
>(({ className = '', glass, ...rest }, ref) => (
  <textarea ref={ref} className={`${glass ? GLASS_AREA : AREA} ${className}`} {...rest} />
))

TextArea.displayName = 'TextArea'

export default TextField
export { FIELD, GLASS as FIELD_GLASS }
