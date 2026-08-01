import { describe, expect, it } from 'vitest'
import {
  BUG_EMAIL,
  REPORT_LIMIT,
  bugMailto,
  reportBody,
  reportSubject,
  systemLine,
  type SystemDetails
} from '../src/shared/bugReport'

const mac: SystemDetails = { version: '0.1.0', platform: 'darwin', release: '25.5.0', arch: 'arm64' }
const win: SystemDetails = { version: '0.1.0', platform: 'win32', release: '10.0.22631', arch: 'x64' }
const odd: SystemDetails = { version: '0.1.0', platform: 'freebsd', release: '14.0', arch: 'x64' }

describe('a bug report', () => {
  it('names the system the way somebody would say it', () => {
    expect(systemLine(mac)).toBe('macOS 25.5.0 arm64')
    expect(systemLine(win)).toBe('Windows 10.0.22631 x64')
    expect(systemLine(odd)).toBe('freebsd 14.0 x64')
  })

  it('says the version in the subject', () => {
    expect(reportSubject(mac)).toBe('Crew 0.1.0 bug report')
  })

  it('puts what was written first and what it was written on under it', () => {
    expect(reportBody('  The panel went blank  ', mac)).toBe(
      'The panel went blank\n\nCrew 0.1.0\nmacOS 25.5.0 arm64'
    )
  })

  it('draws no empty lines when the machine said nothing about itself', () => {
    const blank: SystemDetails = { version: '', platform: '', release: '', arch: '' }
    expect(reportBody('The panel went blank', blank)).toBe('The panel went blank\n\nCrew')
  })

  it('is one address the shell can open', () => {
    const url = bugMailto('The panel went blank', mac)
    expect(url.startsWith(`mailto:${BUG_EMAIL}?`)).toBe(true)

    const asked = new URL(url).searchParams
    expect(asked.get('subject')).toBe('Crew 0.1.0 bug report')
    expect(asked.get('body')).toBe('The panel went blank\n\nCrew 0.1.0\nmacOS 25.5.0 arm64')
  })

  it('carries a report with anything in it through unhurt', () => {
    const said = 'It broke on "one & two"\n\n50% of the time, #3 + #4'
    expect(new URL(bugMailto(said, mac)).searchParams.get('body')).toContain(said)
  })

  it('stays inside what a shell will read', () => {
    const url = bugMailto('x'.repeat(REPORT_LIMIT), mac)
    expect(url.length).toBeLessThan(2000)
  })
})
