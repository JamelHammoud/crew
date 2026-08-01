// @vitest-environment jsdom
import { expect, it } from 'vitest'
it('style.translate', () => {
  const d = document.createElement('div')
  d.style.translate = '10px 20px'
  console.log('translate:', JSON.stringify(d.style.translate), 'attr:', JSON.stringify(d.getAttribute('style')))
  d.style.transform = 'translate(10px, 20px)'
  console.log('transform:', JSON.stringify(d.style.transform))
  expect(true).toBe(true)
})
