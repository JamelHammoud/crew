import { spawn } from 'node:child_process'
import { countsOf, readScan, SCANNER, type ScanReport } from '../shared/scan'
import { crewPath, resolveCommand, searchDirs } from '../runner/providers/path'

const SCAN_MS = 180_000

const OUTPUT_LIMIT = 8_000_000

const tail = (said: string): string => {
  const lines = said.trim().split('\n').filter(Boolean)
  return (lines[lines.length - 1] ?? '').replace(/\s+/g, ' ').trim()
}

function runScanner(binary: string, folder: string): Promise<ScanReport> {
  return new Promise(settle => {
    const dirs = searchDirs()
    const child = spawn(binary, ['scan', folder, '--format', 'json'], {
      cwd: folder,
      env: { ...process.env, PATH: crewPath(dirs) },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let out = ''
    let bad = ''
    let done = false
    const answer = (report: ScanReport): void => {
      if (done) return
      done = true
      clearTimeout(clock)
      settle(report)
    }
    const clock = setTimeout(() => {
      child.kill()
      answer({ kind: 'failed', message: 'The scan took too long and was stopped.' })
    }, SCAN_MS)
    child.stdout.on('data', (chunk: Buffer) => {
      if (out.length < OUTPUT_LIMIT) out += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      if (bad.length < OUTPUT_LIMIT) bad += chunk.toString()
    })
    child.on('error', error => answer({ kind: 'failed', message: (error as Error).message }))
    child.on('close', () => {
      const findings = readScan(out)
      if (!findings) {
        answer({ kind: 'failed', message: tail(bad) || tail(out) || 'The scan said nothing back.' })
        return
      }
      answer({ kind: 'found', findings, counts: countsOf(findings), at: Date.now() })
    })
  })
}

export class Scans {
  private running = new Map<string, Promise<ScanReport>>()

  scan(folder: string | null): Promise<ScanReport> {
    if (!folder) return Promise.resolve({ kind: 'nowhere' })
    const already = this.running.get(folder)
    if (already) return already
    const binary = resolveCommand(SCANNER)
    if (!binary) return Promise.resolve({ kind: 'missing' })
    const run = runScanner(binary, folder).finally(() => {
      this.running.delete(folder)
    })
    this.running.set(folder, run)
    return run
  }
}
