// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Toolbox from '../src/renderer/src/components/Toolbox'
import { useBrowser } from '../src/renderer/src/state/browser'
import { useCrew } from '../src/renderer/src/state/store'
import type { ClientMessage } from '../src/shared/protocol'
import type { CrewTool } from '../src/shared/toolbox'

Element.prototype.getAnimations ??= () => []

const sent: ClientMessage[] = []

const tool = (extra: Partial<CrewTool> = {}): CrewTool => ({
  id: 'tool-1',
  name: 'Figma',
  mark: 'globe',
  action: { kind: 'web', url: 'https://figma.com' },
  createdBy: 'Jamel',
  ts: 1,
  ...extra
})

let switched = 0

const toolbox = (tools: CrewTool[] = []) => {
  useCrew.setState({
    tools,
    addTool: (name, mark, action) => sent.push({ type: 'tool.add', name, mark, action }),
    editTool: (toolId, name, mark, action) => sent.push({ type: 'tool.edit', toolId, name, mark, action }),
    removeTool: toolId => sent.push({ type: 'tool.remove', toolId })
  })
  return render(
    createElement(Toolbox, { open: true, onClose: () => {}, onSidePanel: () => void (switched += 1) })
  )
}

beforeEach(() => {
  sent.length = 0
  switched = 0
  useBrowser.setState({ tabs: [], activeTabId: null })
})

afterEach(() => cleanup())

describe('the toolbox', () => {
  it('holds the built-in tools, with the ones still coming turned off', () => {
    toolbox()

    expect(screen.getByText('Huddle')).toBeTruthy()
    expect(screen.getByText('Terminal')).toBeTruthy()
    expect(screen.getAllByText('Soon')).toHaveLength(2)
    expect(screen.getByText('Music').closest('button')?.disabled).toBe(true)
    expect(screen.getByText('Files').closest('button')?.disabled).toBe(true)
  })

  it('opens a terminal, and takes you to where it opened', () => {
    toolbox()
    fireEvent.click(screen.getByText('Terminal'))

    const tabs = useBrowser.getState().tabs
    expect(tabs).toHaveLength(1)
    expect(tabs[0]).toMatchObject({ kind: 'terminal', command: null })
    expect(switched).toBe(1)
  })

  it('runs a built tool: a page opens in the side panel, a command opens a terminal', () => {
    toolbox([tool(), tool({ id: 'tool-2', name: 'Dev', mark: 'terminal', action: { kind: 'terminal', command: 'yarn dev' } })])

    fireEvent.click(screen.getByText('Figma'))
    expect(useBrowser.getState().tabs[0]).toMatchObject({ kind: 'web', url: 'https://figma.com' })

    cleanup()
    toolbox([tool({ id: 'tool-2', name: 'Dev', mark: 'terminal', action: { kind: 'terminal', command: 'yarn dev' } })])
    fireEvent.click(screen.getByText('Dev'))
    expect(useBrowser.getState().tabs.at(-1)).toMatchObject({ kind: 'terminal', command: 'yarn dev' })
  })

  it('builds a tool from the form and sends it to the crew', () => {
    toolbox()
    fireEvent.click(screen.getByLabelText('New tool'))

    fireEvent.change(screen.getByPlaceholderText('What to call it'), { target: { value: 'Staging' } })
    fireEvent.click(screen.getByLabelText('cloud'))
    fireEvent.change(screen.getByPlaceholderText('figma.com'), { target: { value: 'crew.dev' } })
    fireEvent.click(screen.getByText('Add to toolbox'))

    expect(sent).toEqual([
      { type: 'tool.add', name: 'Staging', mark: 'cloud', action: { kind: 'web', url: 'crew.dev' } }
    ])
    // Saving puts the grid back.
    expect(screen.getByText('Huddle')).toBeTruthy()
  })

  it('will not build a tool with nothing to press or nowhere to go', () => {
    toolbox()
    fireEvent.click(screen.getByLabelText('New tool'))
    const save = screen.getByText('Add to toolbox').closest('button')
    expect(save?.disabled).toBe(true)

    fireEvent.change(screen.getByPlaceholderText('What to call it'), { target: { value: 'Nowhere' } })
    expect(save?.disabled).toBe(true)

    // A command is optional, so naming it is enough once it runs one.
    fireEvent.click(screen.getByText('Run a command'))
    expect(save?.disabled).toBe(false)
  })

  it('edits and removes a tool that is already there', () => {
    toolbox([tool()])
    fireEvent.click(screen.getByLabelText('Edit Figma'))

    const name = screen.getByPlaceholderText('What to call it') as HTMLInputElement
    expect(name.value).toBe('Figma')
    fireEvent.change(name, { target: { value: 'Design' } })
    fireEvent.click(screen.getByText('Save'))
    expect(sent).toEqual([
      { type: 'tool.edit', toolId: 'tool-1', name: 'Design', mark: 'globe', action: { kind: 'web', url: 'https://figma.com' } }
    ])

    sent.length = 0
    fireEvent.click(screen.getByLabelText('Edit Figma'))
    fireEvent.click(screen.getByLabelText('Remove tool'))
    expect(sent).toEqual([{ type: 'tool.remove', toolId: 'tool-1' }])
  })
})
