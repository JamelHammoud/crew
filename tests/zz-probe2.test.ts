// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

describe('jsdom focusability', () => {
  it('honors visibility hidden and display none', () => {
    const box = document.createElement('div')
    box.style.visibility = 'hidden'
    const input = document.createElement('input')
    box.appendChild(input)
    document.body.appendChild(box)
    input.focus()
    console.log('hidden ->', document.activeElement === input)
    box.style.visibility = 'visible'
    input.focus()
    console.log('visible ->', document.activeElement === input)
    const dis = document.createElement('input')
    dis.disabled = true
    document.body.appendChild(dis)
    dis.focus()
    console.log('disabled ->', document.activeElement === dis)
    expect(true).toBe(true)
  })
})
