import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  forgetServer,
  knownServers,
  rememberServer,
  serverKey,
  setServersPath
} from '../src/runner/providers/local-servers'
import { SERVER_LIMIT } from '../src/shared/modelServers'

let file = ''

const fresh = (): string => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'crew-servers-')), 'model-servers.json')

const reopen = (): void => setServersPath(file)

beforeEach(() => {
  file = fresh()
  setServersPath(file)
})

describe('model server store', () => {
  it('reads back nothing on a machine that has written none', () => {
    expect(knownServers()).toEqual([])
    expect(fs.existsSync(file)).toBe(false)
  })

  it('remembers a server and reads it back off the disk', () => {
    rememberServer({ url: 'http://llm.example.com:39862/v1', key: 'sk-one' })
    reopen()
    expect(knownServers()).toEqual([{ url: 'http://llm.example.com:39862/v1', key: 'sk-one' }])
    expect(serverKey('http://llm.example.com:39862/v1')).toBe('sk-one')
  })

  it('keeps the name a server was given, since it is what the picker calls it', () => {
    rememberServer({ url: 'http://llm.example.com:39862/v1', name: 'The rack', key: 'sk-one' })
    reopen()
    expect(knownServers()[0].name).toBe('The rack')
  })

  it('keeps a key when the same address is written down again without one', () => {
    rememberServer({ url: 'http://llm.example.com:39862/v1', key: 'sk-one' })
    rememberServer({ url: 'http://llm.example.com:39862/v1' })
    expect(serverKey('http://llm.example.com:39862/v1')).toBe('sk-one')
    reopen()
    expect(serverKey('http://llm.example.com:39862/v1')).toBe('sk-one')
  })

  it('forgets one and leaves the rest', () => {
    rememberServer({ url: 'http://one.example.com/v1', key: 'sk-one' })
    rememberServer({ url: 'http://two.example.com/v1', key: 'sk-two' })
    expect(forgetServer('http://one.example.com/v1')).toEqual([{ url: 'http://two.example.com/v1', key: 'sk-two' }])
    reopen()
    expect(knownServers().map(one => one.url)).toEqual(['http://two.example.com/v1'])
    expect(serverKey('http://one.example.com/v1')).toBeUndefined()
  })

  it('holds the newest first and no more than the limit', () => {
    for (let i = 0; i < SERVER_LIMIT + 5; i++) rememberServer({ url: `http://box-${i}.example.com/v1` })
    reopen()
    const held = knownServers()
    expect(held).toHaveLength(SERVER_LIMIT)
    expect(held[0].url).toBe(`http://box-${SERVER_LIMIT + 4}.example.com/v1`)
    expect(held.some(one => one.url === 'http://box-0.example.com/v1')).toBe(false)
  })

  it('writes the file where nobody else can read it', () => {
    rememberServer({ url: 'http://llm.example.com:39862/v1', key: 'sk-one' })
    expect(fs.statSync(file).mode & 0o777).toBe(0o600)
    expect(fs.existsSync(`${file}.tmp`)).toBe(false)
  })

  it('moves a file it cannot parse aside rather than writing over the key in it', () => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, '{ not json')
    reopen()
    expect(knownServers()).toEqual([])
    expect(fs.existsSync(file)).toBe(false)
    const kept = fs.readdirSync(path.dirname(file)).find(one => one.startsWith('model-servers.json.corrupt-'))
    expect(kept).toBeTruthy()
  })
})
