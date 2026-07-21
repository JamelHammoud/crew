import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { AgentStore } from '../src/main/agents-store'
import { tmpDir } from './helpers/session'

const defs = [{ instanceId: 'uuid-1', provider: 'claude', name: 'Claude Fable', settings: { model: 'fable' } }]

describe('agent store', () => {
  it('treats a missing file as a fresh machine', () => {
    const store = new AgentStore(path.join(tmpDir('store'), 'agents.json'))
    expect(store.load()).toEqual([])
  })

  it('round-trips definitions', () => {
    const store = new AgentStore(path.join(tmpDir('store'), 'agents.json'))
    store.save(defs)
    expect(store.load()).toEqual(defs)
  })

  // A reseed after a bad read is what once destroyed user-created agents: the
  // store must move an unreadable file aside, never leave it to be overwritten.
  it('quarantines a corrupt file instead of exposing it to a reseed', () => {
    const file = path.join(tmpDir('store'), 'agents.json')
    fs.writeFileSync(file, '{ not json')
    const store = new AgentStore(file)
    expect(store.load()).toEqual([])
    expect(fs.existsSync(file)).toBe(false)
    const saved = fs.readdirSync(path.dirname(file)).find(f => f.startsWith('agents.json.corrupt-'))
    expect(saved).toBeTruthy()
    expect(fs.readFileSync(path.join(path.dirname(file), saved!), 'utf8')).toBe('{ not json')
  })

  it('quarantines JSON that is not a def list', () => {
    const file = path.join(tmpDir('store'), 'agents.json')
    fs.writeFileSync(file, '{"agents": true}')
    expect(new AgentStore(file).load()).toEqual([])
    expect(fs.existsSync(file)).toBe(false)
  })
})
