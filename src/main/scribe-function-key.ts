import { spawn, type ChildProcessByStdio } from 'node:child_process'
import type { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'

export interface ScribeFunctionKeyEars {
  onDown: () => void
  onUp: () => void
  onLost: () => void
}

export class ScribeFunctionKey {
  private child: ChildProcessByStdio<null, Readable, null> | null = null
  private pending = ''
  private isReady = false

  constructor(private readonly ears: ScribeFunctionKeyEars) {}

  get ready(): boolean {
    return this.isReady
  }

  start(): void {
    if (process.platform !== 'darwin' || this.child) return
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL('./scribe-function-key-listener.js', import.meta.url))],
      {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        stdio: ['ignore', 'pipe', 'ignore']
      }
    )
    this.child = child
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', chunk => this.read(chunk))
    child.once('exit', () => {
      if (this.child !== child) return
      this.child = null
      this.isReady = false
      this.pending = ''
      this.ears.onLost()
    })
  }

  stop(): void {
    const child = this.child
    this.child = null
    this.isReady = false
    this.pending = ''
    child?.kill()
  }

  private read(chunk: string): void {
    this.pending += chunk
    const lines = this.pending.split('\n')
    this.pending = lines.pop() ?? ''
    for (const line of lines) {
      if (line === 'ready') this.isReady = true
      else if (line === 'down') this.ears.onDown()
      else if (line === 'up') this.ears.onUp()
    }
  }
}
