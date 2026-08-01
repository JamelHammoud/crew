import { atom, type Atom } from '../signals'
import type { TLTheme, TLThemeColor, TLThemePalette, TLThemes } from './types'

const lightColors: Record<string, string> = {
  black: '#1d1d1d',
  blue: '#4465e9',
  green: '#099268',
  grey: '#9fa8b2',
  'light-blue': '#4ba1f1',
  'light-green': '#4cb05e',
  'light-red': '#f87777',
  'light-violet': '#e085f4',
  orange: '#e16919',
  red: '#e03131',
  violet: '#ae3ec9',
  yellow: '#f1ac4b',
  white: '#FFFFFF'
}

const darkColors: Record<string, string> = {
  black: '#f2f2f2',
  blue: '#4f72fc',
  green: '#099268',
  grey: '#9398b0',
  'light-blue': '#4dabf7',
  'light-green': '#40c057',
  'light-red': '#ff8787',
  'light-violet': '#e599f7',
  orange: '#f76707',
  red: '#e03131',
  violet: '#ae3ec9',
  yellow: '#ffc034',
  white: '#f3f3f3'
}

const lightVariants: Partial<Record<string, Partial<TLThemeColor>>> = {
  black: { fill: '#1d1d1d', linedFill: '#363636', semi: '#e8e8e8', pattern: '#494949' },
  blue: { fill: '#4465e9', linedFill: '#6580ec', semi: '#dce1f8', pattern: '#6681ee' },
  green: { fill: '#099268', linedFill: '#0bad7c', semi: '#d3e9e3', pattern: '#39a785' },
  grey: { fill: '#9fa8b2', linedFill: '#bbc1c9', semi: '#eceef0', pattern: '#bcc3c9' },
  'light-blue': { fill: '#4ba1f1', linedFill: '#7abaf5', semi: '#ddedfa', pattern: '#6fbbf8' },
  'light-green': { fill: '#4cb05e', linedFill: '#7ec88c', semi: '#dbf0e0', pattern: '#65cb78' },
  'light-red': { fill: '#f87777', linedFill: '#f99a9a', semi: '#f4dadb', pattern: '#fe9e9e' },
  'light-violet': { fill: '#e085f4', linedFill: '#e9abf7', semi: '#f5eafa', pattern: '#e9acf8' },
  orange: { fill: '#e16919', linedFill: '#ea8643', semi: '#f8e2d4', pattern: '#f78438' },
  red: { fill: '#e03131', linedFill: '#e75f5f', semi: '#f4dadb', pattern: '#e55959' },
  violet: { fill: '#ae3ec9', linedFill: '#be68d4', semi: '#ecdcf2', pattern: '#bd63d3' },
  yellow: { fill: '#f1ac4b', linedFill: '#f5c27a', semi: '#f9f0e6', pattern: '#fecb92' },
  white: { fill: '#FFFFFF', linedFill: '#ffffff', semi: '#f5f5f5', pattern: '#f9f9f9' }
}

const darkVariants: Partial<Record<string, Partial<TLThemeColor>>> = {
  black: { fill: '#f2f2f2', linedFill: '#ffffff', semi: '#2c3036', pattern: '#989898' },
  blue: { fill: '#4f72fc', linedFill: '#3c5cdd', semi: '#262d40', pattern: '#3a4b9e' },
  green: { fill: '#099268', linedFill: '#087856', semi: '#253231', pattern: '#366a53' },
  grey: { fill: '#9398b0', linedFill: '#8388a5', semi: '#33373c', pattern: '#7c8187' },
  'light-blue': { fill: '#4dabf7', linedFill: '#2793ec', semi: '#2a3642', pattern: '#4d7aa9' },
  'light-green': { fill: '#40c057', linedFill: '#37a44b', semi: '#2a3830', pattern: '#4e874e' },
  'light-red': { fill: '#ff8787', linedFill: '#ff6666', semi: '#3c2b2b', pattern: '#a56767' },
  'light-violet': { fill: '#e599f7', linedFill: '#dc71f4', semi: '#383442', pattern: '#9770a9' },
  orange: { fill: '#f76707', linedFill: '#f54900', semi: '#3b2e27', pattern: '#9f552d' },
  red: { fill: '#e03131', linedFill: '#c31d1d', semi: '#382726', pattern: '#8f3734' },
  violet: { fill: '#ae3ec9', linedFill: '#8f2fa7', semi: '#342938', pattern: '#763a8b' },
  yellow: { fill: '#ffc034', linedFill: '#ffae00', semi: '#3b352b', pattern: '#fecb92' },
  white: { fill: '#f3f3f3', linedFill: '#f3f3f3', semi: '#f5f5f5', pattern: '#f9f9f9' }
}

const colorNames = [
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
] as const

const lightUtilityVariants = utilityVariants({
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
  noteText: Array(13).fill('#000000'),
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
})

const darkUtilityVariants = utilityVariants({
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
})

function utilityVariants(values: Record<string, string[]>): Record<string, Partial<TLThemeColor>> {
  return Object.fromEntries(
    colorNames.map((name, index) => [
      name,
      Object.fromEntries(Object.entries(values).map(([variant, entries]) => [variant, entries[index]]))
    ])
  )
}

function colorEntries(
  colors: Record<string, string>,
  variants: Partial<Record<string, Partial<TLThemeColor>>>,
  utilities: Record<string, Partial<TLThemeColor>>
): Record<string, TLThemeColor> {
  return Object.fromEntries(
    Object.entries(colors).map(([name, solid]) => [name, { solid, ...variants[name], ...utilities[name] }])
  )
}

const light: TLThemePalette = {
  text: '#000000',
  background: '#f9fafb',
  negativeSpace: '#f9fafb',
  solid: '#fcfffe',
  cursor: 'black',
  noteBorder: 'rgb(144, 144, 144)',
  snap: '#f24822',
  selectionStroke: 'hsl(214, 84%, 56%)',
  selectionFill: 'hsl(210, 100%, 56%, 24%)',
  brushFill: 'hsl(0, 0%, 56%, 10.2%)',
  brushStroke: 'hsl(0, 0%, 56%, 25.1%)',
  selectedContrast: '#ffffff',
  laser: 'hsl(0, 100%, 50%)',
  ...colorEntries(lightColors, lightVariants, lightUtilityVariants)
}

const dark: TLThemePalette = {
  text: 'hsl(210, 17%, 98%)',
  background: 'hsl(240, 5%, 6.5%)',
  negativeSpace: 'hsl(240, 5%, 6.5%)',
  solid: '#010403',
  cursor: 'white',
  noteBorder: 'rgb(20, 20, 20)',
  snap: '#f24822',
  selectionStroke: 'hsl(214, 84%, 56%)',
  selectionFill: 'hsl(209, 100%, 57%, 20%)',
  brushFill: 'hsl(0, 0%, 56%, 10.2%)',
  brushStroke: 'hsl(0, 0%, 56%, 25.1%)',
  selectedContrast: '#ffffff',
  laser: 'hsl(0, 100%, 50%)',
  ...colorEntries(darkColors, darkVariants, darkUtilityVariants)
}

export const defaultTheme: TLTheme = {
  id: 'default',
  colors: { light, dark },
  fontSize: 16,
  lineHeight: 1.35,
  strokeWidth: 2
}

export class ThemeManager {
  private readonly themes: TLThemes
  private readonly current: Atom<string>

  constructor(themes?: Partial<TLThemes>, initial = 'default') {
    this.themes = { default: defaultTheme, ...themes }
    this.current = atom('editor.theme', this.themes[initial] ? initial : 'default')
  }

  getCurrentThemeId(): string {
    return this.current.get()
  }

  getCurrentTheme(): TLTheme {
    return this.themes[this.current.get()] ?? defaultTheme
  }

  setCurrentTheme(id: string): void {
    if (this.themes[id]) this.current.set(id)
  }
}
