import { forwardRef, type InputHTMLAttributes } from 'react'

// A line of text somebody types. It is the sunken field the app uses wherever
// something is asked for outright, rather than the pill a search wears.
const FIELD =
  'w-full bg-ink-800 rounded-2xl px-4 py-3 text-base text-fg placeholder:text-fg-muted outline-none transition-shadow duration-200 focus:shadow-[0_0_0_1px_rgb(255_255_255/0.12)] light:focus:shadow-[0_0_0_1px_rgb(0_0_0/0.14)]'

const TextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...rest }, ref) => <input ref={ref} className={`${FIELD} ${className}`} {...rest} />
)

TextField.displayName = 'TextField'

export default TextField
export { FIELD }
