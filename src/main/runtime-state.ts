import path from 'node:path'

export function runtimeStateDir(userData: string, rendererUrl?: string): string {
  return rendererUrl ? path.join(userData, 'dev') : userData
}
