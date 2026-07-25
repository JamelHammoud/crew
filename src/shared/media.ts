export type MediaKind = 'microphone' | 'camera' | 'screen'

export type MediaAccess = 'granted' | 'denied' | 'restricted' | 'unknown'

export interface ScreenSource {
  id: string
  name: string
  kind: 'screen' | 'window'
  thumbnail: string
  icon: string | null
}
