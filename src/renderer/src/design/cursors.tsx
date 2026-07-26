import type { CSSProperties } from 'react'

const ARROW_BODY =
  'M11.8924 23.7113L7.33378 7.71979C7.0984 6.89406 7.95602 6.18103 8.73584 6.5541L23.8385 13.7792C24.6416 14.1633 24.5812 15.3159 23.7425 15.6131L17.5312 17.8139C17.3056 17.8938 17.1164 18.0511 16.9978 18.2573L13.7318 23.9361C13.2908 24.7028 12.1347 24.5616 11.8924 23.7113Z'

const ARROW_EDGE =
  'M6.85075 7.85437C6.49768 6.6158 7.78362 5.54671 8.95335 6.10625L24.0564 13.3314C25.2607 13.9077 25.1699 15.6359 23.9119 16.0816L17.7012 18.2824C17.5885 18.3224 17.4939 18.4011 17.4346 18.5041L14.1679 24.1828C13.5065 25.3329 11.7731 25.1214 11.4093 23.8463L6.85075 7.85437Z'

const BEAM = 'M11 5H17V7H15V23H17V25H11V23H13V7H11Z'

const CROSSHAIR = 'M13.2 4H14.8V14.2H25V15.8H14.8V26H13.2V15.8H3V14.2H13.2Z'

const OPEN_HAND =
  'M10.5 1.875a1.125 1.125 0 0 1 2.25 0v8.219c.517.162 1.02.382 1.5.659V3.375a1.125 1.125 0 0 1 2.25 0v10.937a4.505 4.505 0 0 0-3.25 2.373 8.963 8.963 0 0 1 4-.935A.75.75 0 0 0 18 15v-2.266a3.368 3.368 0 0 1 .988-2.37 1.125 1.125 0 0 1 1.591 1.59 1.118 1.118 0 0 0-.329.79v3.006h-.005a6 6 0 0 1-1.752 4.007l-1.736 1.736a6 6 0 0 1-4.242 1.757H10.5a7.5 7.5 0 0 1-7.5-7.5V6.375a1.125 1.125 0 0 1 2.25 0v5.519c.46-.452.965-.832 1.5-1.141V3.375a1.125 1.125 0 0 1 2.25 0v6.526c.495-.1.997-.151 1.5-.151V1.875Z'

const box = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}h${w - r * 2}a${r} ${r} 0 0 1 ${r} ${r}v${h - r * 2}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - r * 2)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - r * 2)}a${r} ${r} 0 0 1 ${r} ${-r}Z`

const CLOSED_HAND = [
  box(4.4, 10.5, 15.2, 11.5, 5),
  box(5, 5.6, 2.9, 8, 1.45),
  box(8.9, 5.6, 2.9, 8, 1.45),
  box(12.8, 5.6, 2.9, 8, 1.45),
  box(16.7, 5.6, 2.9, 8, 1.45),
  box(3, 12.6, 8.2, 4.8, 2.4)
].join('')

const HAND_PLACE = "translate(3.9 3.86) scale(0.9)"

const SHADOW =
  "<defs><filter id='drop' x='-40%' y='-40%' width='180%' height='180%' color-interpolation-filters='sRGB'><feDropShadow dx='0' dy='1' stdDeviation='1.5' flood-opacity='.4'/></filter></defs>"

const KEYLINE = "paint-order='stroke' stroke='white' stroke-width='2' stroke-linejoin='round' fill='black'"

const svg = (art: string) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='29' height='30' viewBox='0 0 29 30' fill='none'>${SHADOW}<g filter='url(%23drop)'>${art}</g></svg>`

const cursor = (art: string, x: number, y: number, fallback: string) =>
  `url("data:image/svg+xml,${svg(art)}") ${x} ${y}, ${fallback}`

const arrow = cursor(
  `<path d='${ARROW_BODY}' fill='black'/><path d='${ARROW_EDGE}' stroke='white'/>`,
  7,
  6,
  'default'
)

const beam = cursor(`<path d='${BEAM}' ${KEYLINE}/>`, 14, 15, 'text')

const crosshair = cursor(`<path d='${CROSSHAIR}' ${KEYLINE}/>`, 14, 15, 'crosshair')

const hand = (art: string, fallback: string) =>
  cursor(`<path d='${art}' transform='${HAND_PLACE}' ${KEYLINE}/>`, 14, 15, fallback)

export const DESIGN_CURSORS = {
  '--tl-cursor-default': arrow,
  '--tl-cursor-pointer': arrow,
  '--tl-cursor-move': arrow,
  '--tl-cursor-text': beam,
  '--tl-cursor-cross': crosshair,
  '--tl-cursor-grab': hand(OPEN_HAND, 'grab'),
  '--tl-cursor-grabbing': hand(CLOSED_HAND, 'grabbing')
} as CSSProperties

export function CursorArrow({ color }: { color: string }) {
  return (
    <svg
      aria-hidden
      width="29"
      height="30"
      viewBox="0 0 29 30"
      fill="none"
      style={{ filter: 'drop-shadow(0 1px 1.5px rgb(0 0 0 / 0.4))' }}
    >
      <path d={ARROW_BODY} fill={color} />
      <path d={ARROW_EDGE} stroke="white" />
    </svg>
  )
}
