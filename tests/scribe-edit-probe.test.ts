// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { createServer, type Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Scribe from '../src/renderer/src/components/settings/Scribe'
import { setScribeSettings } from '../src/renderer/src/state/scribeSettings'

let server: Server | null = null
let url = ''
let models: string[] = []

const stand = async (): Promise<void> => {
  server = createServer((req, res) => {
    if (req.url === '/v1/models') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ data: models.map(id => ({ id })) }))
      return
    }
    res.writeHead(404).end()
  })
  await new Promise<void>(resolve => server?.listen(0, '127.0.0.1', resolve))
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
}

beforeEach(async () => {
  models = ['qwen3:4b', 'llama3.2']
  await stand()
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  })
  Object.defineProperty(globalThis, 'crew', { value: {}, configurable: true })
  vi.stubGlobal('window', Object.assign(globalThis.window, {
    crew: {
      applyScribe: vi.fn(),
      scribeState: vi.fn().mockResolvedValue({ hooked: true, trusted: true }),
      openScribePermission: vi.fn()
    }
  }))
})

afterEach(async () => {
  cleanup()
  await new Promise<void>(resolve => void server?.close(() => resolve()))
  server = null
  act(() => setScribeSettings({ edit: false, editModel: '' }))
})

const open = async (): Promise<void> => {
  await act(async () => {
    render(createElement(Scribe))
  })
}

describe('the page a dictation is set to be written up on', () => {
  it('says nothing about a server until it is turned on', async () => {
    await open()
    expect(screen.getByText('Use a model on this computer')).toBeTruthy()
    expect(screen.queryByText('Server')).toBe(null)
    expect(screen.queryByText('Model')).toBe(null)
  })

  it('asks the server what it will serve once it is on', async () => {
    await act(async () => setScribeSettings({ edit: true, editUrl: url }))
    await open()
    expect(screen.getByText('Server')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('Model')).toBeTruthy())
    await waitFor(() => expect(screen.getByText('llama3.2')).toBeTruthy())
  })

  it('says so where nothing answers, rather than opening an empty picker', async () => {
    models = []
    await act(async () => setScribeSettings({ edit: true, editUrl: url }))
    await open()
    await waitFor(() => expect(screen.getByText('Nothing answered there')).toBeTruthy())
    expect(screen.getByText('Start it and the models turn up here.')).toBeTruthy()
    expect(screen.queryByText('Model')).toBe(null)
  })

  it('writes the address down once it is settled rather than on every keystroke', async () => {
    await act(async () => setScribeSettings({ edit: true, editUrl: url }))
    await open()
    const field = screen.getByPlaceholderText('Address') as HTMLInputElement
    await act(async () => {
      fireEvent.change(field, { target: { value: '127.0.0.1:1' } })
    })
    expect(field.value).toBe('127.0.0.1:1')
    await act(async () => {
      fireEvent.blur(field)
    })
    await waitFor(() => expect((screen.getByPlaceholderText('Address') as HTMLInputElement).value).toBe(
      'http://127.0.0.1:1'
    ))
  })
})
