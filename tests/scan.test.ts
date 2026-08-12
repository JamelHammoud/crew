import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Scans } from '../src/main/scan'
import { countsOf, readScan, sortFindings, worstOf, type ScanFinding } from '../src/shared/scan'

const finding = (severity: ScanFinding['severity'], file: string, line: number, title = 'A problem') => ({
  ruleId: 'secret-generic-credential',
  title,
  file,
  line,
  severity,
  confidence: 'evidence',
  message: 'Possible Hardcoded Credential detected',
  consequence: 'A password in source is a password in every clone of that source.',
  cwe: 'CWE-798',
  excerpt: 'const token = "tok_visa"',
  sensitive: true,
  category: 'secret'
})

const answer = (findings: unknown[]) =>
  JSON.stringify({
    tool: 'threatcrush',
    version: '0.11.0',
    target: '.',
    filesScanned: 114,
    unreadable: [],
    suppressed: 0,
    summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    findings
  })

const daemonShaped = (severity: ScanFinding['severity'], file: string, line: number) => ({
  type: 'A problem',
  severity,
  message: 'Something worth reading about',
  location: `${file}:${line}`,
  details: { file, line, snippet: 'const key = "aaa"', ruleId: 'js-rule' }
})

const held = process.env.PATH

afterEach(() => {
  process.env.PATH = held
})

function scannerThatSays(payload: string, code = 0, said = ''): string {
  const dir = mkdtempSync(join(tmpdir(), 'crew-scan-'))
  const binary = join(dir, 'threatcrush')
  writeFileSync(
    binary,
    ['#!/bin/sh', said ? `echo ${JSON.stringify(said)} >&2` : '', `cat <<'JSON'`, payload, 'JSON', `exit ${code}`]
      .filter(Boolean)
      .join('\n')
  )
  chmodSync(binary, 0o755)
  process.env.PATH = [dir, held].filter(Boolean).join(delimiter)
  return dir
}

describe('what the scanner said', () => {
  it('reads a finding off the fields the scanner really writes', () => {
    const findings = readScan(answer([finding('high', 'src/db.ts', 42)]))

    expect(findings).toHaveLength(1)
    expect(findings?.[0]).toMatchObject({ file: 'src/db.ts', line: 42, severity: 'high', title: 'A problem' })
  })

  it('reads the shape the daemon writes as well', () => {
    const findings = readScan(answer([daemonShaped('high', 'src/db.ts', 42)]))

    expect(findings?.[0]).toMatchObject({ file: 'src/db.ts', line: 42, title: 'A problem' })
  })

  it('falls back to where a finding says it is when there are no fields', () => {
    const findings = readScan(answer([{ type: 'A problem', severity: 'low', message: 'x', location: 'src/a:b.ts:7' }]))

    expect(findings?.[0]).toMatchObject({ file: 'src/a:b.ts', line: 7 })
  })

  it('never reports a finding on line zero', () => {
    const findings = readScan(answer([{ ...finding('low', 'README.md', 0), line: 0 }]))

    expect(findings?.[0]?.line).toBe(1)
  })

  it('leaves out anything with nowhere to go', () => {
    const findings = readScan(answer([{ title: 'A problem', severity: 'low' }, finding('low', 'a.ts', 2)]))

    expect(findings).toHaveLength(1)
  })

  it('reads the payload out from under a line the machine printed first', () => {
    expect(readScan(`Scanning...\n${answer([finding('info', 'a.ts', 1)])}`)).toHaveLength(1)
  })

  it('says nothing came back rather than an empty scan', () => {
    expect(readScan('')).toBeNull()
    expect(readScan('command not found')).toBeNull()
    expect(readScan('{ not json')).toBeNull()
  })

  it('takes an unknown severity as the quietest one', () => {
    expect(readScan(answer([{ ...finding('high', 'a.ts', 1), severity: 'spicy' }]))?.[0]?.severity).toBe('info')
  })
})

describe('the order findings are read in', () => {
  const rows = readScan(
    answer([
      finding('low', 'b.ts', 1),
      finding('critical', 'z.ts', 9),
      finding('high', 'a.ts', 5),
      finding('critical', 'a.ts', 2)
    ])
  )

  it('puts the worst first, then walks the files', () => {
    expect(rows?.map(one => `${one.severity} ${one.file}:${one.line}`)).toEqual([
      'critical a.ts:2',
      'critical z.ts:9',
      'high a.ts:5',
      'low b.ts:1'
    ])
  })

  it('counts what there is of each', () => {
    expect(countsOf(rows ?? [])).toEqual({ critical: 2, high: 1, medium: 0, low: 1, info: 0 })
  })

  it('says the worst of them, and nothing at all when there are none', () => {
    expect(worstOf(rows ?? [])).toBe('critical')
    expect(worstOf([])).toBeNull()
  })

  it('leaves what it was handed alone', () => {
    const one = readScan(answer([finding('low', 'b.ts', 1), finding('critical', 'a.ts', 1)])) ?? []
    const copy = [...one]
    sortFindings(one)
    expect(one).toEqual(copy)
  })
})

describe('running the scanner', () => {
  it('scans nothing when no project is open', async () => {
    expect(await new Scans().scan(null)).toEqual({ kind: 'nowhere' })
  })

  it('reads back what a real run wrote out', async () => {
    const dir = scannerThatSays(answer([finding('critical', 'src/db.ts', 42), finding('low', 'src/a.ts', 3)]))

    const report = await new Scans().scan(dir)

    expect(report.kind).toBe('found')
    if (report.kind !== 'found') return
    expect(report.findings.map(one => one.file)).toEqual(['src/db.ts', 'src/a.ts'])
    expect(report.counts.critical).toBe(1)
    expect(report.at).toBeGreaterThan(0)
  })

  it('is a clean scan rather than a failure when there is nothing to say', async () => {
    const dir = scannerThatSays(answer([]))

    expect(await new Scans().scan(dir)).toMatchObject({ kind: 'found', findings: [] })
  })

  it('carries what a run that said nothing printed instead', async () => {
    const dir = scannerThatSays('', 2, 'no such directory')

    expect(await new Scans().scan(dir)).toEqual({ kind: 'failed', message: 'no such directory' })
  })

  it('joins a scan of the same folder that is already going', async () => {
    const dir = scannerThatSays(answer([finding('high', 'a.ts', 1)]))
    const scans = new Scans()

    const [one, two] = await Promise.all([scans.scan(dir), scans.scan(dir)])

    expect(one).toBe(two)
  })
})
