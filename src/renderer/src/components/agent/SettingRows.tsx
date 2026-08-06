import type { AgentSettingField, AgentSettings } from '../../../../shared/llm'
import { ON, fieldKind, isOn, visibleSettingFields } from '../../../../shared/llm'
import Select from '../Select'
import TextField from '../TextField'
import Toggle from '../Toggle'
import { Row } from '../settings/parts'
import NumberField from './NumberField'

export function SettingControl({
  field,
  settings,
  onChange
}: {
  field: AgentSettingField
  settings: AgentSettings
  onChange: (key: string, value: string) => void
}) {
  const value = settings[field.key] ?? field.default
  const kind = fieldKind(field)

  if (kind === 'switch') {
    return <Toggle on={isOn(value)} label={field.label} onChange={on => onChange(field.key, on ? ON : '')} />
  }
  if (kind === 'number') {
    return (
      <NumberField
        value={value}
        label={field.label}
        unit={field.unit}
        min={field.min}
        max={field.max}
        step={field.step}
        placeholder={field.placeholder}
        onChange={next => onChange(field.key, next)}
      />
    )
  }
  if (kind === 'text') {
    return (
      <TextField
        glass
        value={value}
        placeholder={field.placeholder ?? 'Default'}
        onChange={event => onChange(field.key, event.target.value)}
        className="w-56"
      />
    )
  }
  return (
    <Select
      value={value}
      options={field.options ?? []}
      onChange={next => onChange(field.key, next)}
    />
  )
}

export default function SettingRows({
  fields,
  settings,
  onChange
}: {
  fields: AgentSettingField[]
  settings: AgentSettings
  onChange: (key: string, value: string) => void
}) {
  return (
    <>
      {visibleSettingFields(fields, settings).map(field => (
        <Row key={field.key} label={field.label} line={field.line}>
          <SettingControl field={field} settings={settings} onChange={onChange} />
        </Row>
      ))}
    </>
  )
}
