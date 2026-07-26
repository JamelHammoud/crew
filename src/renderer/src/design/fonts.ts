export type FontCategory = 'system' | 'sans' | 'serif' | 'mono' | 'display' | 'hand'

export interface FontFamily {
  name: string
  label: string
  category: FontCategory
}

const SYSTEM: Record<string, string> = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "SF Pro Text", "Segoe UI", sans-serif',
  serif: 'ui-serif, Georgia, "Times New Roman", serif',
  mono: '"Cascadia Mono", ui-monospace, "SF Mono", Menlo, monospace'
}

const FALLBACK: Record<FontCategory, string> = {
  system: SYSTEM.sans,
  sans: SYSTEM.sans,
  serif: SYSTEM.serif,
  mono: SYSTEM.mono,
  display: SYSTEM.sans,
  hand: 'cursive'
}

function google(names: string[], category: FontCategory): FontFamily[] {
  return names.map(name => ({ name, label: name, category }))
}

export const FONTS: FontFamily[] = [
  { name: 'sans', label: 'System Sans', category: 'system' },
  { name: 'serif', label: 'System Serif', category: 'system' },
  { name: 'mono', label: 'System Mono', category: 'system' },
  ...google(
    [
      'Archivo',
      'Barlow',
      'Chivo',
      'DM Sans',
      'Figtree',
      'IBM Plex Sans',
      'Inter',
      'Karla',
      'Lato',
      'Lexend',
      'Manrope',
      'Montserrat',
      'Mulish',
      'Nunito',
      'Nunito Sans',
      'Onest',
      'Open Sans',
      'Outfit',
      'Plus Jakarta Sans',
      'Poppins',
      'Public Sans',
      'Quicksand',
      'Raleway',
      'Roboto',
      'Rubik',
      'Sora',
      'Source Sans 3',
      'Space Grotesk',
      'Urbanist',
      'Work Sans'
    ],
    'sans'
  ),
  ...google(
    [
      'Bitter',
      'Cormorant Garamond',
      'Crimson Pro',
      'DM Serif Display',
      'EB Garamond',
      'Fraunces',
      'Instrument Serif',
      'Libre Baskerville',
      'Lora',
      'Merriweather',
      'Newsreader',
      'Playfair Display',
      'Source Serif 4',
      'Spectral'
    ],
    'serif'
  ),
  ...google(
    [
      'DM Mono',
      'Fira Code',
      'IBM Plex Mono',
      'Inconsolata',
      'JetBrains Mono',
      'Red Hat Mono',
      'Roboto Mono',
      'Source Code Pro',
      'Space Mono'
    ],
    'mono'
  ),
  ...google(['Abril Fatface', 'Alfa Slab One', 'Anton', 'Bebas Neue', 'Righteous'], 'display'),
  ...google(['Caveat', 'Dancing Script', 'Kalam', 'Pacifico', 'Shadows Into Light'], 'hand')
]

const BY_NAME = new Map(FONTS.map(font => [font.name, font]))

export function fontStack(name: string): string {
  const system = SYSTEM[name]
  if (system) return system
  const font = BY_NAME.get(name)
  return font ? `"${font.name}", ${FALLBACK[font.category]}` : name
}

export function fontLabel(name: string): string {
  return BY_NAME.get(name)?.label ?? name
}

const WEIGHTS = '300,400,500,600,700,400italic,700italic'
const loaded = new Set<string>()

function slug(name: string): string {
  return name.replace(/ /g, '+')
}

export function loadFonts(names: string[]): void {
  if (typeof document === 'undefined') return
  const fresh = names.filter(name => BY_NAME.get(name)?.category !== 'system' && BY_NAME.has(name) && !loaded.has(name))
  if (fresh.length === 0) return
  for (const name of fresh) loaded.add(name)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css?family=${fresh.map(name => `${slug(name)}:${WEIGHTS}`).join('%7C')}&display=swap`
  document.head.append(link)
}
