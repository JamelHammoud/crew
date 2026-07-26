// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { MenuDivider, Popover } from '../src/renderer/src/components/Popover'

afterEach(cleanup)

const fs = (): typeof import('node:fs') => require('node:fs')

const source = (file: string) => fs().readFileSync(`${process.cwd()}/${file}`, 'utf8')

const renderer = 'src/renderer/src'

const files = fs()
  .readdirSync(`${process.cwd()}/${renderer}`, { recursive: true })
  .map(String)
  .filter(name => name.endsWith('.tsx'))
  .map(name => `${renderer}/${name}`)

const openTag = (text: string, from: number): string => {
  let depth = 0
  for (let at = from; at < text.length; at++) {
    const letter = text[at]
    if (letter === '{') depth++
    else if (letter === '}') depth--
    else if (letter === '>' && depth === 0) return text.slice(from, at)
  }
  return text.slice(from)
}

const popoverTags = (text: string): string[] => {
  const tags: string[] = []
  for (let at = text.indexOf('<Popover'); at >= 0; at = text.indexOf('<Popover', at + 1)) {
    if (/[\s/>]/.test(text[at + 8] ?? '')) tags.push(openTag(text, at))
  }
  return tags
}

const shown = (props: Record<string, unknown>) => {
  render(createElement('div', null, createElement(Popover, { open: true, onClose: () => {}, ...props } as never)))
  return document.querySelector('.glass.fixed') as HTMLElement
}

describe('a popover', () => {
  it('pads its own content', () => {
    expect(shown({ children: 'hello' }).className).toContain('p-1.5')
  })

  it('lets a divider bleed back through exactly that padding', () => {
    render(createElement(MenuDivider))
    const rule = document.querySelector('div') as HTMLElement
    const padding = shown({ children: 'hello' }).className.match(/(?:^|\s)p-([\d.]+)/)![1]
    expect(rule.className).toContain(`-mx-${padding}`)
  })

  it('gives the padding up when the panel inside draws its own rows', () => {
    expect(shown({ flush: true, children: 'hello' }).className).not.toMatch(/(?:^|\s)p-[\d.]/)
  })

  it('is never handed a padding class to cancel the one it wears', () => {
    const offenders = files
      .flatMap(file => popoverTags(source(file)).map(tag => ({ file, tag })))
      .filter(({ tag }) => /["'`\s]!?p[xy]?-/.test(tag))
      .map(({ file }) => file)
    expect(offenders).toEqual([])
  })
})
