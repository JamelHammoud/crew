export type IosNeed = 'ready' | 'mac' | 'xcode' | 'finish'

export interface IosMachine {
  mac: boolean
  xcodes: string[]
  developer: string
  license: boolean
  components: boolean
  runtimes: string[]
}

export interface IosSetup {
  need: IosNeed
  ready: boolean
  says: string
  button: string
}

export const IOS_TARGET = '27'

export const XCODE_STORE = 'macappstores://apps.apple.com/app/xcode/id497799835'

export function pointsAtXcode(developer: string): boolean {
  return /\.app\/Contents\/Developer\/?$/.test(developer.trim())
}

export function runtimeNumber(runtime: string): number {
  const found = /(\d+)(?:[.-](\d+))?/.exec(runtime)
  if (!found) return 0
  return Number(found[1]) * 1000 + Number(found[2] ?? 0)
}

export function newestRuntime(runtimes: readonly string[]): string | null {
  const sorted = [...runtimes].sort((a, b) => runtimeNumber(b) - runtimeNumber(a))
  return sorted[0] ?? null
}

const SAYS: Record<IosNeed, { says: string; button: string }> = {
  ready: { says: '', button: '' },
  mac: { says: 'iPhone apps are built on a Mac.', button: '' },
  xcode: { says: 'Xcode comes from the App Store. Crew does the rest.', button: 'App Store' },
  finish: { says: 'Xcode is here. One password and the simulator is ready.', button: 'Set it up' }
}

export function iosNeed(machine: IosMachine): IosNeed {
  if (!machine.mac) return 'mac'
  if (machine.xcodes.length === 0) return 'xcode'
  const done = pointsAtXcode(machine.developer) && machine.license && machine.components && machine.runtimes.length > 0
  return done ? 'ready' : 'finish'
}

export function iosSetupPlan(machine: IosMachine): IosSetup {
  const need = iosNeed(machine)
  return { need, ready: need === 'ready', ...SAYS[need] }
}
