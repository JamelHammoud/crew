import { describe, expect, it } from 'vitest'
import {
  advancedFields,
  changedSettings,
  cleanSetting,
  fieldSections,
  plainFields,
  resolveSettings,
  settingLabel,
  visibleSettingFields,
  type AgentSettingField
} from '../src/shared/llm'

const choice: AgentSettingField = {
  key: 'model',
  label: 'Model',
  options: [
    { value: '', label: 'Default' },
    { value: 'opus', label: 'Opus' }
  ],
  default: 'opus'
}

const toggle: AgentSettingField = { key: 'search', label: 'Web search', kind: 'switch', default: '' }

const number: AgentSettingField = {
  key: 'context',
  label: 'Context',
  kind: 'number',
  default: '',
  min: 1000,
  max: 200000,
  unit: 'tokens'
}

const text: AgentSettingField = { key: 'dirs', label: 'Other folders', kind: 'text', default: '' }

describe('what a setting may be', () => {
  it('keeps a choice its options carry and falls back to the default', () => {
    expect(cleanSetting(choice, 'opus')).toBe('opus')
    expect(cleanSetting(choice, '')).toBe('')
    expect(cleanSetting(choice, 'nonsense')).toBe('opus')
  })

  it('keeps a written value only where the field says it may be written', () => {
    expect(cleanSetting({ ...choice, free: true }, 'http://127.0.0.1:1234')).toBe('http://127.0.0.1:1234')
    expect(cleanSetting(choice, 'http://127.0.0.1:1234')).toBe('opus')
  })

  it('holds a switch to on or off and nothing else', () => {
    expect(cleanSetting(toggle, 'on')).toBe('on')
    expect(cleanSetting(toggle, '')).toBe('')
    expect(cleanSetting(toggle, 'true')).toBe('')
  })

  it('holds a number inside its own bounds', () => {
    expect(cleanSetting(number, '32000')).toBe('32000')
    expect(cleanSetting(number, '10')).toBe('1000')
    expect(cleanSetting(number, '999999')).toBe('200000')
  })

  it('leaves a number empty rather than filling in one nobody asked for', () => {
    expect(cleanSetting(number, '')).toBe('')
    expect(cleanSetting(number, undefined)).toBe('')
  })

  it('refuses a number that is not one', () => {
    expect(cleanSetting(number, 'lots')).toBe('')
  })

  it('takes what was typed and trims it', () => {
    expect(cleanSetting(text, '  ~/notes , ~/spec ')).toBe('~/notes , ~/spec')
  })
})

describe('putting a value into words', () => {
  it('says a choice by the label it was picked under', () => {
    expect(settingLabel(choice, { model: 'opus' })).toBe('Opus')
  })

  it('says a switch as on or off rather than as the word it is stored under', () => {
    expect(settingLabel(toggle, { search: 'on' })).toBe('On')
    expect(settingLabel(toggle, { search: '' })).toBe('Off')
  })

  it('says a number with its unit, and an empty one as the default it really is', () => {
    expect(settingLabel(number, { context: '32000' })).toBe('32000 tokens')
    expect(settingLabel(number, { context: '' })).toBe('Default')
  })
})

describe('what a card has to draw', () => {
  const fields: AgentSettingField[] = [
    choice,
    { ...toggle, advanced: true, section: 'Tools' },
    { ...number, advanced: true, section: 'Limits' },
    { ...text, advanced: true, section: 'Limits' }
  ]

  it('holds the plain fields apart from the advanced ones', () => {
    expect(plainFields(fields).map(f => f.key)).toEqual(['model'])
    expect(advancedFields(fields).map(f => f.key)).toEqual(['search', 'context', 'dirs'])
  })

  it('counts only what somebody really moved off the default', () => {
    expect(changedSettings(fields, resolveSettings(fields, {}))).toEqual([])
    expect(changedSettings(fields, { ...resolveSettings(fields, {}), search: 'on' }).map(f => f.key)).toEqual([
      'search'
    ])
  })

  it('never counts a field the settings have hidden', () => {
    const hidden: AgentSettingField[] = [
      choice,
      { ...number, advanced: true, visibleWhen: { key: 'model', value: 'haiku' } }
    ]
    expect(changedSettings(hidden, { model: 'opus', context: '4000' })).toEqual([])
  })

  it('gathers the sections in the order the fields were written in', () => {
    expect(fieldSections(advancedFields(fields)).map(s => [s.title, s.fields.map(f => f.key)])).toEqual([
      ['Tools', ['search']],
      ['Limits', ['context', 'dirs']]
    ])
  })
})

describe('resolving a whole set', () => {
  const fields: AgentSettingField[] = [choice, toggle, number, text]

  it('answers for every field, whatever kind it is', () => {
    expect(resolveSettings(fields, {})).toEqual({ model: 'opus', search: '', context: '', dirs: '' })
  })

  it('drops a value the field cannot carry and keeps the ones it can', () => {
    expect(resolveSettings(fields, { model: 'gone', search: 'on', context: '8000', dirs: '~/spec' })).toEqual({
      model: 'opus',
      search: 'on',
      context: '8000',
      dirs: '~/spec'
    })
  })

  it('leaves a field standing while what it hangs off is picked', () => {
    const pair: AgentSettingField[] = [choice, { ...number, visibleWhen: { key: 'model', value: 'opus' } }]
    expect(visibleSettingFields(pair, { model: 'opus' }).map(f => f.key)).toEqual(['model', 'context'])
    expect(visibleSettingFields(pair, { model: '' }).map(f => f.key)).toEqual(['model'])
  })
})
