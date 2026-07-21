import { spawn } from 'node:child_process'
import type { Provider } from './types'

const INSTALL_TIMEOUT_MS = 5 * 60 * 1000
const OUTPUT_TAIL = 400

export function installCommand(provider: Provider, platform: string = process.platform): string | null {
  return provider.install?.[platform as 'darwin' | 'linux' | 'win32'] ?? null
}

const tail = (output: string): string => {
  const trimmed = output.trim()
  return trimmed.length > OUTPUT_TAIL ? '…' + trimmed.slice(-OUTPUT_TAIL) : trimmed
}

// Runs the vendor's installer for this platform. The installers drop the binary
// into a home dir already on crew's search path (~/.local/bin and friends), so a
// zero exit means detect() finds the CLI without restarting the app.
export function runInstall(provider: Provider, platform: string = process.platform): Promise<void> {
  const command = installCommand(provider, platform)
  if (!command) {
    return Promise.reject(new Error(`crew does not know how to install ${provider.label} on this platform.`))
  }
  return new Promise((resolve, reject) => {
    const child =
      platform === 'win32'
        ? spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command])
        : spawn('/bin/bash', ['-c', command])
    let output = ''
    const capture = (data: Buffer): void => {
      output += data.toString()
    }
    child.stdout?.on('data', capture)
    child.stderr?.on('data', capture)
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`${provider.label} install timed out.`))
    }, INSTALL_TIMEOUT_MS)
    timer.unref()
    child.on('error', err => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', code => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(tail(output) || `${provider.label} installer exited with code ${code}`))
    })
  })
}
