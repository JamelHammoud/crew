import type { TLDefaultColorStyle as CrewColorStyle } from '../schema'
import type { ShapeEditor } from './ShapeUtil'

export type ShapeColorVariant =
  | 'solid'
  | 'fill'
  | 'linedFill'
  | 'semi'
  | 'pattern'
  | 'noteFill'
  | 'noteText'
  | 'frameStroke'
  | 'frameFill'
  | 'frameText'
  | 'highlightSrgb'
export type ShapeColorMode = 'light' | 'dark'

const NAMES: CrewColorStyle[] = [
  'black',
  'grey',
  'light-violet',
  'violet',
  'blue',
  'light-blue',
  'yellow',
  'orange',
  'green',
  'light-green',
  'light-red',
  'red',
  'white'
]

const LIGHT: Record<ShapeColorVariant, string[]> = {
  solid: [
    '#1d1d1d',
    '#9fa8b2',
    '#e085f4',
    '#ae3ec9',
    '#4465e9',
    '#4ba1f1',
    '#f1ac4b',
    '#e16919',
    '#099268',
    '#4cb05e',
    '#f87777',
    '#e03131',
    '#FFFFFF'
  ],
  fill: [
    '#1d1d1d',
    '#9fa8b2',
    '#e085f4',
    '#ae3ec9',
    '#4465e9',
    '#4ba1f1',
    '#f1ac4b',
    '#e16919',
    '#099268',
    '#4cb05e',
    '#f87777',
    '#e03131',
    '#FFFFFF'
  ],
  linedFill: [
    '#363636',
    '#bbc1c9',
    '#e9abf7',
    '#be68d4',
    '#6580ec',
    '#7abaf5',
    '#f5c27a',
    '#ea8643',
    '#0bad7c',
    '#7ec88c',
    '#f99a9a',
    '#e75f5f',
    '#ffffff'
  ],
  semi: [
    '#e8e8e8',
    '#eceef0',
    '#f5eafa',
    '#ecdcf2',
    '#dce1f8',
    '#ddedfa',
    '#f9f0e6',
    '#f8e2d4',
    '#d3e9e3',
    '#dbf0e0',
    '#f4dadb',
    '#f4dadb',
    '#f5f5f5'
  ],
  pattern: [
    '#494949',
    '#bcc3c9',
    '#e9acf8',
    '#bd63d3',
    '#6681ee',
    '#6fbbf8',
    '#fecb92',
    '#f78438',
    '#39a785',
    '#65cb78',
    '#fe9e9e',
    '#e55959',
    '#f9f9f9'
  ],
  noteFill: [
    '#FCE19C',
    '#C0CAD3',
    '#DFB0F9',
    '#DB91FD',
    '#8AA3FF',
    '#9BC4FD',
    '#FED49A',
    '#FAA475',
    '#6FC896',
    '#98D08A',
    '#F7A5A1',
    '#FC8282',
    '#FFFFFF'
  ],
  noteText: [
    '#000000',
    '#000000',
    '#000000',
    '#000000',
    '#000000',
    '#000000',
    '#000000',
    '#000000',
    '#000000',
    '#000000',
    '#000000',
    '#000000',
    '#000000'
  ],
  frameStroke: [
    '#717171',
    '#aaaaab',
    '#e59bf5',
    '#bc62d3',
    '#6681ec',
    '#6cb2f3',
    '#f3bb6c',
    '#e68544',
    '#37a684',
    '#6dbe7c',
    '#f89090',
    '#e55757',
    '#7d7d7d'
  ],
  frameFill: [
    '#ffffff',
    '#fcfcfd',
    '#fefbff',
    '#fdf9fd',
    '#f9fafe',
    '#fafcff',
    '#fffdfa',
    '#fef9f6',
    '#f8fcfa',
    '#fafdfa',
    '#fffbfb',
    '#fef9f9',
    '#ffffff'
  ],
  frameText: Array(13).fill('#000000'),
  highlightSrgb: [
    '#fddd00',
    '#cbe7f1',
    '#ff88ff',
    '#c77cff',
    '#10acff',
    '#00f4ff',
    '#fddd00',
    '#ffa500',
    '#00ffc8',
    '#65f641',
    '#ff7fa3',
    '#ff636e',
    '#ffffff'
  ]
}

const DARK: Record<ShapeColorVariant, string[]> = {
  solid: [
    '#f2f2f2',
    '#9398b0',
    '#e599f7',
    '#ae3ec9',
    '#4f72fc',
    '#4dabf7',
    '#ffc034',
    '#f76707',
    '#099268',
    '#40c057',
    '#ff8787',
    '#e03131',
    '#f3f3f3'
  ],
  fill: [
    '#f2f2f2',
    '#9398b0',
    '#e599f7',
    '#ae3ec9',
    '#4f72fc',
    '#4dabf7',
    '#ffc034',
    '#f76707',
    '#099268',
    '#40c057',
    '#ff8787',
    '#e03131',
    '#f3f3f3'
  ],
  linedFill: [
    '#ffffff',
    '#8388a5',
    '#dc71f4',
    '#8f2fa7',
    '#3c5cdd',
    '#2793ec',
    '#ffae00',
    '#f54900',
    '#087856',
    '#37a44b',
    '#ff6666',
    '#c31d1d',
    '#f3f3f3'
  ],
  semi: [
    '#2c3036',
    '#33373c',
    '#383442',
    '#342938',
    '#262d40',
    '#2a3642',
    '#3b352b',
    '#3b2e27',
    '#253231',
    '#2a3830',
    '#3c2b2b',
    '#382726',
    '#f5f5f5'
  ],
  pattern: [
    '#989898',
    '#7c8187',
    '#9770a9',
    '#763a8b',
    '#3a4b9e',
    '#4d7aa9',
    '#fecb92',
    '#9f552d',
    '#366a53',
    '#4e874e',
    '#a56767',
    '#8f3734',
    '#f9f9f9'
  ],
  noteFill: [
    '#2c2c2c',
    '#56595F',
    '#762F8E',
    '#5f1c70',
    '#2A3F98',
    '#1F5495',
    '#8a5e1c',
    '#7c3905',
    '#014429',
    '#21581D',
    '#7a3333',
    '#7e201f',
    '#eaeaea'
  ],
  noteText: [
    '#f2f2f2',
    '#f2f2f2',
    '#f2f2f2',
    '#f2f2f2',
    '#f2f2f2',
    '#f2f2f2',
    '#f2f2f2',
    '#f2f2f2',
    '#f2f2f2',
    '#f2f2f2',
    '#f2f2f2',
    '#f2f2f2',
    '#1d1d1d'
  ],
  frameStroke: [
    '#5c5c5c',
    '#42474D',
    '#6c367a',
    '#6d1583',
    '#384994',
    '#075797',
    '#684e12',
    '#773a0e',
    '#10513C',
    '#1C5427',
    '#6f3232',
    '#701e1e',
    '#ffffff'
  ],
  frameFill: [
    '#0c0c0c',
    '#151719',
    '#1C151E',
    '#1b0f21',
    '#11141f',
    '#0B1823',
    '#1e1911',
    '#1c1512',
    '#0E1614',
    '#0F1911',
    '#181212',
    '#1b1313',
    '#ffffff'
  ],
  frameText: [
    '#f2f2f2',
    '#f2f2f2',
    '#f2f2f2',
    '#f2f2f2',
    '#f2f2f2',
    '#f2f2f2',
    '#f2f2f2',
    '#f2f2f2',
    '#f2f2f2',
    '#f2f2f2',
    '#f2f2f2',
    '#f2f2f2',
    '#000000'
  ],
  highlightSrgb: [
    '#d2b700',
    '#9cb4cb',
    '#c400c7',
    '#9e00ee',
    '#0079d2',
    '#00bdc8',
    '#d2b700',
    '#d07a00',
    '#009774',
    '#00a000',
    '#db005b',
    '#de002c',
    '#ffffff'
  ]
}

export function shapeColorMode(editor?: ShapeEditor): ShapeColorMode {
  return editor?.getColorMode?.() === 'dark' ? 'dark' : 'light'
}

export function shapeColor(
  editor: ShapeEditor | undefined,
  color: CrewColorStyle,
  variant: ShapeColorVariant = 'solid'
): string {
  const mode = shapeColorMode(editor)
  const themeId = editor?.getCurrentThemeId?.()
  if (themeId && themeId !== 'default') {
    const entry = editor?.getCurrentTheme?.().colors?.[mode]?.[color] as Record<string, unknown> | undefined
    if (entry && typeof entry === 'object') {
      const value = entry[variant]
      if (typeof value === 'string') return value
    }
  }
  const at = NAMES.indexOf(color)
  return (mode === 'dark' ? DARK : LIGHT)[variant][at < 0 ? 0 : at]
}

export function canvasSurface(editor?: ShapeEditor): string {
  return shapeColorMode(editor) === 'dark' ? '#010403' : '#fcfffe'
}
