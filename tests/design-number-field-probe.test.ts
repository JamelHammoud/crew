// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

const { NumberInput } = await import('../src/renderer/src/design/InspectorFields')

function field(props: { value: number; min?: number; max?: number; onChange: (value: number) => void }) {
  const view = render(createElement(NumberInput, { label: 'X', ...props }))
  return {
    input: view.getByLabelText('X'),
    handle: view.container.querySelector('[data-scrub="X"]') as HTMLElement
  }
}

describe('design number fields', () => {
  it('steps by one on an arrow key and by ten with shift', () => {
    const onChange = vi.fn()
    const { input } = field({ value: 40, onChange })

    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith(41)

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(onChange).toHaveBeenLastCalledWith(40)

    fireEvent.keyDown(input, { key: 'ArrowUp', shiftKey: true })
    expect(onChange).toHaveBeenLastCalledWith(50)
  })

  it('keeps stepping from where the last step landed', () => {
    const onChange = vi.fn()
    const { input } = field({ value: 0, onChange })

    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith(3)
  })

  it('drags the label sideways to raise and lower the value', () => {
    const onChange = vi.fn()
    const { handle } = field({ value: 100, onChange })

    fireEvent.pointerDown(handle, { clientX: 200, button: 0 })
    fireEvent.pointerMove(handle, { clientX: 212 })
    expect(onChange).toHaveBeenLastCalledWith(112)

    fireEvent.pointerMove(handle, { clientX: 190 })
    expect(onChange).toHaveBeenLastCalledWith(90)

    fireEvent.pointerUp(handle, { clientX: 190 })
    fireEvent.pointerMove(handle, { clientX: 400 })
    expect(onChange).toHaveBeenLastCalledWith(90)
  })

  it('drags ten to the pixel with shift held', () => {
    const onChange = vi.fn()
    const { handle } = field({ value: 0, onChange })

    fireEvent.pointerDown(handle, { clientX: 0, button: 0 })
    fireEvent.pointerMove(handle, { clientX: 3, shiftKey: true })
    expect(onChange).toHaveBeenLastCalledWith(30)
  })

  it('stays inside the range it was given', () => {
    const onChange = vi.fn()
    const { input } = field({ value: 100, min: 10, max: 100, onChange })

    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith(100)

    fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true })
    fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true })
    fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true })
    fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true })
    fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true })
    fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true })
    fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true })
    fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true })
    fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true })
    fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true })
    expect(onChange).toHaveBeenLastCalledWith(10)
  })
})
