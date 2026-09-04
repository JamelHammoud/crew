import { readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { IosFrame } from '../shared/iosLive'
import { command } from './ios-command'

export const FRAME_GAP = 500

function sizeOf(bytes: Buffer): { width: number; height: number } {
  if (bytes.length < 24 || bytes.readUInt32BE(0) !== 0x89504e47) return { width: 0, height: 0 }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

export class IosFrames {
  private timer: NodeJS.Timeout | null = null
  private busy = false
  private last: Buffer | null = null
  private readonly file: string

  constructor(
    private readonly key: string,
    private readonly send: (frame: IosFrame) => void
  ) {
    this.file = path.join(os.tmpdir(), `crew-ios-${process.pid}-${key}.png`)
  }

  start(deviceId: string, env: NodeJS.ProcessEnv): void {
    this.stop()
    this.last = null
    this.timer = setInterval(() => void this.tick(deviceId, env), FRAME_GAP)
    void this.tick(deviceId, env)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    void rm(this.file, { force: true }).catch(() => undefined)
  }

  private async tick(deviceId: string, env: NodeJS.ProcessEnv): Promise<void> {
    if (this.busy || !this.timer) return
    this.busy = true
    try {
      const taken = await command('/usr/bin/xcrun', ['simctl', 'io', deviceId, 'screenshot', this.file], {
        env,
        timeout: 20_000
      })
      if (!taken.ok || !this.timer) return
      const bytes = await readFile(this.file).catch(() => null)
      if (!bytes || bytes.length === 0) return
      if (this.last && this.last.length === bytes.length && this.last.equals(bytes)) return
      this.last = bytes
      const { width, height } = sizeOf(bytes)
      this.send({ dataUrl: `data:image/png;base64,${bytes.toString('base64')}`, width, height, at: Date.now() })
    } finally {
      this.busy = false
    }
  }
}
