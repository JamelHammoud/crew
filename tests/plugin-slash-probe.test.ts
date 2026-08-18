// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { commandsIn } from '../src/shared/commands'
import { pluginTyped, type CrewPlugin } from '../src/shared/plugins'
import { SlashMenu, useSlashCommands } from '../src/renderer/src/components/SlashCommands'

Element.prototype.scrollIntoView = () => {}

const raylight: CrewPlugin = {
  id: 'raylight',
  name: 'raylight',
  label: 'Raylight',
  blurb: 'Make and edit product videos',
  transport: 'http',
  url: 'https://api.raylight.app/mcp',
  appUrl: 'https://www.raylight.app/projects',
  by: 'Jamel',
  ts: 1
}

const figma: CrewPlugin = {
  id: 'figma',
  name: 'figma',
  label: 'Figma',
  blurb: 'Read a design',
  transport: 'http',
  url: 'https://mcp.figma.com/mcp',
  by: 'Jamel',
  ts: 1
}

function Harness({
  plugins,
  open = () => {}
}: {
  plugins: CrewPlugin[]
  open?: (plugin: CrewPlugin) => void
}) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const write = (next: string) => {
    const plugin = pluginTyped(next, plugins)
    if (plugin) {
      open(plugin)
      setValue('')
    } else {
      setValue(next)
    }
  }
  const slash = useSlashCommands(value, write, () => {}, ref, commandsIn('chat'), plugins, open)
  return createElement(
    'div',
    null,
    createElement('textarea', {
      ref,
      value,
      placeholder: 'Message',
      onChange: (event: ChangeEvent<HTMLTextAreaElement>) => write(event.target.value),
      onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => slash.onKeyDown(event)
    }),
    createElement(SlashMenu, {
      matches: slash.matches,
      activeIndex: slash.activeIndex,
      onPick: slash.pick,
      onHover: slash.setActive,
      empty: slash.empty
    })
  )
}

const type = (value: string) => fireEvent.change(screen.getByPlaceholderText('Message'), { target: { value } })

afterEach(cleanup)

describe('the plugin slash launcher', () => {
  it('offers the installed plugins from the root slash menu', () => {
    render(createElement(Harness, { plugins: [raylight, figma] }))
    type('/')
    fireEvent.click(screen.getByText('/plugin'))
    expect((screen.getByPlaceholderText('Message') as HTMLTextAreaElement).value).toBe('/plugin ')
    expect(screen.getByText('/raylight')).toBeTruthy()
    expect(screen.getByText('Figma')).toBeTruthy()
  })

  it('filters the installed list and opens a launchable plugin', () => {
    const open = vi.fn()
    render(createElement(Harness, { plugins: [raylight, figma], open }))
    type('/plugin ray')
    expect(screen.queryByText('Figma')).toBeNull()
    fireEvent.click(screen.getByText('/raylight'))
    expect(open).toHaveBeenCalledWith(raylight)
    expect((screen.getByPlaceholderText('Message') as HTMLTextAreaElement).value).toBe('')
  })

  it('opens a direct plugin alias with the keyboard', () => {
    const open = vi.fn()
    render(createElement(Harness, { plugins: [raylight], open }))
    type('/ray')
    fireEvent.keyDown(screen.getByPlaceholderText('Message'), { key: 'Enter' })
    expect(open).toHaveBeenCalledWith(raylight)
  })

  it('opens a completed direct alias when space is pressed', () => {
    const open = vi.fn()
    render(createElement(Harness, { plugins: [raylight], open }))
    type('/raylight ')
    expect(open).toHaveBeenCalledWith(raylight)
    expect((screen.getByPlaceholderText('Message') as HTMLTextAreaElement).value).toBe('')
  })

  it('opens a legacy Raylight record that has no saved editor address', () => {
    const { appUrl: _appUrl, ...legacy } = raylight
    const open = vi.fn()
    render(createElement(Harness, { plugins: [{ ...legacy, label: 'Old Raylight' }], open }))
    type('/plugin ray')
    expect(screen.getByText('/raylight')).toBeTruthy()
    expect(screen.getByText('Raylight')).toBeTruthy()
    fireEvent.click(screen.getByText('/raylight'))
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ id: 'raylight' }))
  })

  it('shows when there are no installed plugins', () => {
    render(createElement(Harness, { plugins: [] }))
    type('/plugin ')
    expect(screen.getByText('No plugins installed')).toBeTruthy()
  })

  it('keeps an MCP-only plugin in the list without making it a launcher', () => {
    render(createElement(Harness, { plugins: [figma] }))
    type('/plugin ')
    expect(screen.getByRole('button', { name: /Figma/ }).hasAttribute('disabled')).toBe(true)
  })
})
