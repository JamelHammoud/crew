import { cleanup, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { companyLogoUrls, ContactMark } from '../src/renderer/src/components/mail/parts'
import { useCrew } from '../src/renderer/src/state/store'

beforeEach(() => {
  useCrew.setState({ members: [], httpBase: '' })
})

afterEach(cleanup)

describe('company marks in mail', () => {
  it('asks for the sender domain and then each parent domain', () => {
    expect(companyLogoUrls('news@e.linkedin.com')).toEqual([
      'https://www.google.com/s2/favicons?domain_url=https%3A%2F%2Fe.linkedin.com&sz=128',
      'https://www.google.com/s2/favicons?domain_url=https%3A%2F%2Flinkedin.com&sz=128'
    ])
  })

  it('leaves personal, local, example, and malformed addresses on their generated avatar', () => {
    expect(companyLogoUrls('person@gmail.com')).toEqual([])
    expect(companyLogoUrls('person@mail.gmail.com')).toEqual([])
    expect(companyLogoUrls('person@crew.test')).toEqual([])
    expect(companyLogoUrls('not an address')).toEqual([])
  })

  it('keeps the generated avatar until a company mark has loaded', () => {
    const { container } = render(createElement(ContactMark, { name: 'Going', email: 'hello@going.com', size: 'md' }))
    const image = container.querySelector('img') as HTMLImageElement
    const logo = image.parentElement as HTMLElement

    expect(container.textContent).toBe('G')
    expect(logo.dataset.companyLogo).toBeUndefined()
    expect(logo.className).toContain('opacity-0')

    fireEvent.load(image)

    expect(logo.dataset.companyLogo).toBe('')
    expect(logo.className).toContain('opacity-100')
    expect(logo.querySelector('.ring-inset')).toBeTruthy()
  })

  it('tries a parent domain before returning to the generated avatar', () => {
    const { container } = render(createElement(ContactMark, { name: 'LinkedIn', email: 'news@e.linkedin.com' }))
    let image = container.querySelector('img') as HTMLImageElement
    expect(image.src).toContain('e.linkedin.com')

    fireEvent.error(image)
    image = container.querySelector('img') as HTMLImageElement
    expect(image.src).toContain('linkedin.com')
    expect(image.src).not.toContain('e.linkedin.com')

    fireEvent.error(image)
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toBe('L')
  })
})
