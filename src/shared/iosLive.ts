import type { IosSetup } from './iosSetup'

export type IosPhase = 'off' | 'setup' | 'booting' | 'building' | 'installing' | 'running' | 'failed'

export interface IosIssue {
  kind: 'error' | 'warning'
  file: string
  line: number
  column: number
  message: string
}

export interface IosLiveDevice {
  id: string
  name: string
  os: string
}

export interface IosLiveState {
  phase: IosPhase
  folder: string
  project: string
  scheme: string
  bundleId: string
  device: IosLiveDevice | null
  message: string
  issues: IosIssue[]
  builds: number
  builtAt: number
  setup: IosSetup | null
}

export interface IosFrame {
  dataUrl: string
  width: number
  height: number
  at: number
}

export const ISSUE_LIMIT = 60

export const WATCHED = [
  '.swift',
  '.m',
  '.mm',
  '.h',
  '.c',
  '.cpp',
  '.metal',
  '.plist',
  '.entitlements',
  '.storyboard',
  '.xib',
  '.xcstrings',
  '.strings',
  '.json',
  '.png',
  '.jpg',
  '.pdf',
  '.svg',
  '.pbxproj'
]

const IGNORED = ['build', 'DerivedData', '.git', 'Pods', '.build', 'node_modules', '.crew']

export function watchedFile(file: string): boolean {
  const at = file.replace(/\\/g, '/')
  if (at.split('/').some(part => IGNORED.includes(part))) return false
  const dot = at.lastIndexOf('.')
  return dot > 0 && WATCHED.includes(at.slice(dot).toLowerCase())
}

const LINE = /^(\/[^\s:][^:]*):(\d+):(\d+):\s+(error|warning):\s+(.+)$/
const BARE = /^(?:.*?:\s+)?(error|warning):\s+(.+)$/

export function iosIssuesIn(text: string): IosIssue[] {
  const found: IosIssue[] = []
  const seen = new Set<string>()
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    const placed = LINE.exec(line)
    const issue = placed
      ? {
          kind: placed[4] as IosIssue['kind'],
          file: placed[1],
          line: Number(placed[2]),
          column: Number(placed[3]),
          message: placed[5].trim()
        }
      : (() => {
          const bare = BARE.exec(line)
          if (!bare || LINE.test(line)) return null
          return { kind: bare[1] as IosIssue['kind'], file: '', line: 0, column: 0, message: bare[2].trim() }
        })()
    if (!issue || !issue.message) continue
    const key = `${issue.kind}:${issue.file}:${issue.line}:${issue.column}:${issue.message}`
    if (seen.has(key)) continue
    seen.add(key)
    found.push(issue)
    if (found.length >= ISSUE_LIMIT) break
  }
  return found.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'error' ? -1 : 1))
}

export function iosSays(state: IosLiveState): string {
  if (state.message) return state.message
  const errors = state.issues.filter(issue => issue.kind === 'error').length
  if (state.phase === 'failed' && errors) return `${errors} ${errors === 1 ? 'error' : 'errors'}`
  if (state.phase === 'booting') return 'Starting the simulator'
  if (state.phase === 'building') return 'Building'
  if (state.phase === 'installing') return 'Installing'
  if (state.phase === 'running') return state.scheme
  return ''
}
