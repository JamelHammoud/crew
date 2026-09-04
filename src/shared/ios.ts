export type IosAction = 'build' | 'run' | 'test' | 'clean'

export interface IosXcode {
  name: string
  path: string
  version: string
  selected: boolean
}

export interface IosProject {
  name: string
  path: string
  kind: 'project' | 'workspace'
  schemes: string[]
  targets: string[]
  configurations: string[]
}

export interface IosDevice {
  id: string
  name: string
  os: string
  state: string
  simulator: boolean
}

export interface IosEnvironment {
  available: boolean
  reason: string | null
  xcodes: IosXcode[]
  sdks: string[]
  projects: IosProject[]
  simulators: IosDevice[]
  devices: IosDevice[]
}

export interface IosRunRequest {
  action: IosAction
  projectPath: string
  scheme: string
  deviceId: string
  xcodePath?: string
  runId: string
}

export interface IosRunResult {
  ok: boolean
  action: IosAction
  exitCode: number | null
  message: string
}

export interface IosOutput {
  runId: string
  stream: 'system' | 'stdout' | 'stderr'
  text: string
  ts: number
}

export interface IosScreenshot {
  deviceId: string
  dataUrl: string
  capturedAt: number
}

export interface IosCreateRequest {
  name: string
  bundleId: string
}

export type IosCreateResult = { ok: true; projectPath: string } | { ok: false; message: string }
