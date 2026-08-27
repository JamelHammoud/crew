import { describe, expect, it } from 'vitest'
import {
  commandName,
  foregroundOn,
  ranAfter,
  terminalDetail,
  terminalEarlier,
  terminalLabel
} from '../src/shared/terminalName'

const tab = (over: Partial<Parameters<typeof terminalLabel>[0]> = {}) => ({
  title: '',
  running: '',
  ran: [] as string[],
  command: null as string | null,
  ...over
})

describe('what a terminal is called', () => {
  it('says the command rather than the interpreter it was handed to', () => {
    expect(commandName('node /Users/x/.nvm/versions/node/v26.3.0/bin/yarn start')).toBe('yarn start')
    expect(commandName('/usr/bin/vim src/app.ts')).toBe('vim src/app.ts')
    expect(commandName('node -e 1+1')).toBe('node -e 1+1')
  })

  it('reads the foreground of one terminal off a ps that holds every terminal', () => {
    const ps = [
      'ttys001  Ss+  42774 /bin/zsh -l',
      'ttys007  Ss   64406 /bin/zsh -l',
      'ttys007  S+   64500 yarn test tests/schedules.test.ts',
      'ttys009  Ss+  64777 /bin/zsh -l'
    ].join('\n')
    expect(foregroundOn(ps, '/dev/ttys007', 64406)).toBe('yarn test tests/schedules.test.ts')
    expect(foregroundOn(ps, '/dev/ttys009', 64777)).toBe('')
    expect(foregroundOn(ps, '', 64406)).toBe('')
  })

  it('goes on being called what it last ran once the prompt is back', () => {
    const ran = ranAfter(ranAfter([], 'yarn build'), 'yarn dev')
    expect(terminalLabel(tab({ running: 'yarn dev', ran }))).toBe('yarn dev')
    expect(terminalLabel(tab({ ran }))).toBe('yarn dev')
    expect(terminalLabel(tab())).toBe('Terminal')
  })

  it('takes the shell at its word before anything it worked out', () => {
    expect(terminalLabel(tab({ title: 'crew', running: 'yarn dev' }))).toBe('crew')
    expect(terminalDetail(tab({ title: 'crew', running: 'yarn dev' }))).toBe('yarn dev')
  })

  it('names a terminal opened to run something before it has run it', () => {
    expect(terminalLabel(tab({ command: '/usr/bin/yarn dev' }))).toBe('yarn dev')
  })

  it('leaves what it is called out of what else it has run, newest first', () => {
    const ran = ['yarn dev', 'yarn build', 'git log']
    expect(terminalEarlier(tab({ running: 'yarn dev', ran }))).toEqual(['yarn build', 'git log'])
    expect(ranAfter(ran, 'git log')).toEqual(['git log', 'yarn dev', 'yarn build'])
  })
})
