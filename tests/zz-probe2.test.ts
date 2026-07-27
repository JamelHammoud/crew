// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

describe('jsdom focusability', () => {
  it('display none and hidden attribute', () => {
    const box = document.createElement('div')
    box.style.display = 'none'
    const input = document.createElement('input')
    box.appendChild(input)
    document.body.appendChild(box)
    input.focus()
    console.log('display none ->', document.activeElement === input)
    box.style.display = 'block'
    input.focus()
    console.log('after ->', document.activeElement === input)

    const two = document.createElement('input')
    two.hidden = true
    document.body.appendChild(two)
    two.focus()
    console.log('hidden attr ->', document.activeElement === two)
    expect(true).toBe(true)
  })
})
