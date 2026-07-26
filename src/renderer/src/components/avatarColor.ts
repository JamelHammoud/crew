export interface AvatarColors {
  background: string
  color: string
}

export function avatarHue(name: string): number {
  let hash = 0
  for (const char of name.trim().toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) % 360
  return hash
}

export function avatarColors(name: string, light: boolean): AvatarColors {
  const hue = avatarHue(name)
  return light
    ? { background: `oklch(0.91 0.045 ${hue})`, color: `oklch(0.45 0.09 ${hue})` }
    : { background: `oklch(0.32 0.045 ${hue})`, color: `oklch(0.87 0.06 ${hue})` }
}

export function avatarInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}
