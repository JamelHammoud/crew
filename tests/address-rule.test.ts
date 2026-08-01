import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))

const ADDRESS = /\b\d{1,3}\\*\.\d{1,3}\\*\.\d{1,3}\\*\.\d{1,3}\b/g

const ALLOWED = ['127.0.0.1', '0.0.0.0', '192.0.2.', '198.51.100.', '203.0.113.']

const plain = (address: string): string => address.replace(/\\/g, '')

const allowed = (address: string): boolean => ALLOWED.some(start => address.startsWith(start))

const offenders = (text: string): string[] =>
  (text.match(ADDRESS) ?? []).map(plain).filter(one => !allowed(one))

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const at = path.join(dir, entry.name)
    return entry.isDirectory() ? files(at) : [at]
  })

describe('no real address is written into a suite', () => {
  it('catches an address that is nobody to write down', () => {
    const madeUp = [198, 18, 0, 1].join('.')
    expect(offenders(`ws://${madeUp}:2739/ws`)).toEqual([madeUp])
  })

  it('leaves loopback and the documentation ranges alone', () => {
    expect(offenders('http://127.0.0.1:2739 0.0.0.0 192.0.2.10 198.51.100.4 203.0.113.7')).toEqual([])
  })

  it('holds every suite to it', () => {
    const found = files(here).flatMap(file => {
      const said = offenders(readFileSync(file, 'utf8'))
      return said.map(one => `${path.relative(here, file)}: ${one}`)
    })
    expect(found).toEqual([])
  })
})
