// @vitest-environment jsdom
import { it, expect } from 'vitest'
it('has storage', () => {
  console.log('doc url', document.URL, 'win ls', typeof window.localStorage, 'global ls', typeof localStorage)
  expect(1).toBe(1)
})
