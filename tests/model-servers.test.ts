import { describe, expect, it } from 'vitest'
import {
  SERVER_LIMIT,
  keyOf,
  openaiUrl,
  sameServer,
  serverLabel,
  serverUrl,
  withServer,
  withoutServer,
  type ModelServer,
} from '../src/shared/modelServers'

const listOf = (count: number): ModelServer[] =>
  Array.from({ length: count }, (_, i) => ({ url: `http://192.0.2.10:${39000 + i}/v1` }))

describe('reading an address somebody wrote down', () => {
  it('puts a scheme in front of a bare host and port', () => {
    expect(serverUrl('127.0.0.1:11434')).toBe('http://127.0.0.1:11434')
  })

  it('keeps the path exactly as it was given', () => {
    expect(serverUrl('192.0.2.10:39862/v1')).toBe('http://192.0.2.10:39862/v1')
  })

  it('keeps a path deeper than one segment whole', () => {
    expect(serverUrl('192.0.2.10:8000/openai/v1')).toBe('http://192.0.2.10:8000/openai/v1')
  })

  it('takes a trailing slash off', () => {
    expect(serverUrl('http://192.0.2.10:39862/v1/')).toBe('http://192.0.2.10:39862/v1')
    expect(serverUrl('127.0.0.1:11434/')).toBe('http://127.0.0.1:11434')
  })

  it('keeps https where it was written', () => {
    expect(serverUrl('https://llm.example.com/v1')).toBe('https://llm.example.com/v1')
  })

  it('keeps the host of an https address', () => {
    expect(serverUrl('https://llm.example.com:39862/v1')).toBe('https://llm.example.com:39862/v1')
  })

  it('adds no port where none was written', () => {
    expect(serverUrl('llm.example.com/v1')).toBe('http://llm.example.com/v1')
  })

  it('makes nothing of junk', () => {
    expect(serverUrl('not a url')).toBeNull()
  })

  it('makes nothing of an empty string or of whitespace', () => {
    expect(serverUrl('')).toBeNull()
    expect(serverUrl('   ')).toBeNull()
  })

  it('makes nothing of a scheme that is not http', () => {
    expect(serverUrl('ftp://192.0.2.10:39862')).toBeNull()
    expect(serverUrl('file:///etc/hosts')).toBeNull()
  })
})

describe('where the openai routes stand under a base', () => {
  it('takes the rest as it is where the base already names the version', () => {
    expect(openaiUrl('http://192.0.2.10:39862/v1', '/models')).toBe(
      'http://192.0.2.10:39862/v1/models',
    )
    expect(openaiUrl('http://192.0.2.10:39862/v1', '/chat/completions')).toBe(
      'http://192.0.2.10:39862/v1/chat/completions',
    )
  })

  it('never gives one a second version', () => {
    expect(openaiUrl('http://192.0.2.10:39862/v1', '/models')).not.toContain('/v1/v1')
  })

  it('gives a bare host the one every server of this kind serves on', () => {
    expect(openaiUrl('http://127.0.0.1:11434', '/models')).toBe('http://127.0.0.1:11434/v1/models')
    expect(openaiUrl('http://127.0.0.1:11434', '/chat/completions')).toBe(
      'http://127.0.0.1:11434/v1/chat/completions',
    )
  })

  it('reads another version number the same way', () => {
    expect(openaiUrl('http://192.0.2.10:39862/v2', '/models')).toBe(
      'http://192.0.2.10:39862/v2/models',
    )
    expect(openaiUrl('http://192.0.2.10:39862/v2', '/chat/completions')).toBe(
      'http://192.0.2.10:39862/v2/chat/completions',
    )
  })
})

describe('what an address is called where there is no room for it', () => {
  it('takes the scheme off', () => {
    expect(serverLabel('http://127.0.0.1:11434')).toBe('127.0.0.1:11434')
    expect(serverLabel('https://llm.example.com')).toBe('llm.example.com')
  })

  it('takes the version at the end off', () => {
    expect(serverLabel('http://192.0.2.10:39862/v1')).toBe('192.0.2.10:39862')
    expect(serverLabel('https://llm.example.com/v2')).toBe('llm.example.com')
  })

  it('keeps the host and the port', () => {
    expect(serverLabel('https://llm.example.com:39862/v1')).toBe('llm.example.com:39862')
  })

  it('hands back a bare host with nothing to strip as it is', () => {
    expect(serverLabel('127.0.0.1:11434')).toBe('127.0.0.1:11434')
  })
})

describe('whether two addresses are the same server', () => {
  it('reads one written with a trailing slash as the same', () => {
    expect(sameServer('http://192.0.2.10:39862/v1', 'http://192.0.2.10:39862/v1/')).toBe(true)
  })

  it('reads one written in another case as the same', () => {
    expect(sameServer('http://192.0.2.10:39862/v1', 'HTTP://192.0.2.10:39862/V1')).toBe(true)
  })

  it('reads two ports as two servers', () => {
    expect(sameServer('http://192.0.2.10:39862/v1', 'http://192.0.2.10:39863/v1')).toBe(false)
  })

  it('reads a path against no path as two servers', () => {
    expect(sameServer('http://192.0.2.10:39862/v1', 'http://192.0.2.10:39862')).toBe(false)
  })
})

describe('writing a server down', () => {
  it('puts a new one at the front', () => {
    const held = [{ url: 'http://127.0.0.1:11434' }]
    expect(withServer(held, { url: 'http://192.0.2.10:39862/v1' })).toEqual([
      { url: 'http://192.0.2.10:39862/v1' },
      { url: 'http://127.0.0.1:11434' },
    ])
  })

  it('holds one written down twice once, at the front', () => {
    const held = [{ url: 'http://192.0.2.10:39862/v1' }, { url: 'http://127.0.0.1:11434' }]
    expect(withServer(held, { url: 'http://192.0.2.10:39862/v1/' })).toEqual([
      { url: 'http://192.0.2.10:39862/v1/' },
      { url: 'http://127.0.0.1:11434' },
    ])
  })

  it('keeps a key already held where the same address is written down again with none', () => {
    const held = [{ url: 'http://192.0.2.10:39862/v1', key: 'sk-held' }]
    expect(withServer(held, { url: 'http://192.0.2.10:39862/v1' })).toEqual([
      { url: 'http://192.0.2.10:39862/v1', key: 'sk-held' },
    ])
  })

  it('takes a key given again in place of the one before it', () => {
    const held = [{ url: 'http://192.0.2.10:39862/v1', key: 'sk-held' }]
    expect(withServer(held, { url: 'http://192.0.2.10:39862/v1', key: 'sk-new' })).toEqual([
      { url: 'http://192.0.2.10:39862/v1', key: 'sk-new' },
    ])
  })

  it('holds no more than the limit, and it is the oldest that falls off', () => {
    const held = listOf(SERVER_LIMIT)
    const kept = withServer(held, { url: 'http://127.0.0.1:11434' })
    expect(kept).toHaveLength(SERVER_LIMIT)
    expect(kept[0]).toEqual({ url: 'http://127.0.0.1:11434' })
    expect(kept[1]).toEqual(held[0])
    expect(kept.some(one => sameServer(one.url, held[SERVER_LIMIT - 1].url))).toBe(false)
  })
})

describe('taking a server off the list', () => {
  it('leaves the rest where they are', () => {
    const held = [{ url: 'http://192.0.2.10:39862/v1' }, { url: 'http://127.0.0.1:11434' }]
    expect(withoutServer(held, 'http://192.0.2.10:39862/v1')).toEqual([
      { url: 'http://127.0.0.1:11434' },
    ])
  })

  it('takes off one named with a trailing slash or in another case', () => {
    const held = [{ url: 'http://192.0.2.10:39862/v1' }]
    expect(withoutServer(held, 'HTTP://192.0.2.10:39862/V1/')).toEqual([])
  })

  it('makes nothing of one nobody has', () => {
    const held = [{ url: 'http://192.0.2.10:39862/v1' }]
    expect(withoutServer(held, 'http://203.0.113.7:39862/v1')).toEqual(held)
  })
})

describe('the key held for a server', () => {
  it('finds the one written down against the address', () => {
    const held = [{ url: 'http://192.0.2.10:39862/v1', key: 'sk-held' }]
    expect(keyOf(held, 'http://192.0.2.10:39862/v1/')).toBe('sk-held')
  })

  it('says nothing for an address nobody has', () => {
    const held = [{ url: 'http://192.0.2.10:39862/v1', key: 'sk-held' }]
    expect(keyOf(held, 'http://203.0.113.7:39862/v1')).toBeUndefined()
  })

  it('says nothing for one held with no key', () => {
    expect(keyOf([{ url: 'http://127.0.0.1:11434' }], 'http://127.0.0.1:11434')).toBeUndefined()
  })
})
