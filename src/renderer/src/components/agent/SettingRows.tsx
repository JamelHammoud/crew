import { Fragment } from 'react'
import type { AgentSettingField, AgentSettings } from '../../../../shared/llm'
import { ON, fieldKind, fieldSections, isOn, settingOptions, visibleSettingFields } from '../../../../shared/llm'
import Select from '../Select'
import TextField, { TextArea } from '../TextField'
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
      name={field.label}
      value={value}
      options={settingOptions(field, settings)}
      onChange={next => onChange(field.key, next)}
    />
  )
}

function ParagraphRow({
  field,
  settings,
  onChange
}: {
  field: AgentSettingField
  settings: AgentSettings
  onChange: (key: string, value: string) => void
}) {
  return (
    <div className="-mx-6 px-6 py-3.5 border-b border-fg/[0.06] last:border-b-0">
      <p className="text-base text-fg">{field.label}</p>
      {field.line && <p className="text-sm text-fg/45 mt-0.5">{field.line}</p>}
      <TextArea
        glass
        rows={3}
        value={settings[field.key] ?? field.default}
        placeholder={field.placeholder ?? 'None'}
        onChange={event => onChange(field.key, event.target.value)}
        className="mt-2.5"
      />
    </div>
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
      {visibleSettingFields(fields, settings).map(field =>
        fieldKind(field) === 'paragraph' ? (
          <ParagraphRow key={field.key} field={field} settings={settings} onChange={onChange} />
        ) : (
          <Row key={field.key} label={field.label} line={field.line} bleed>
            <SettingControl field={field} settings={settings} onChange={onChange} />
          </Row>
        )
      )}
    </>
  )
}

export function SettingSections({
  fields,
  settings,
  onChange
}: {
  fields: AgentSettingField[]
  settings: AgentSettings
  onChange: (key: string, value: string) => void
}) {
  const sections = fieldSections(visibleSettingFields(fields, settings))
  return (
    <>
      {sections.map(section => (
        <Fragment key={section.fields[0].key}>
          {section.title && <h4 className="pt-5 pb-1.5 text-sm font-semibold text-fg/45">{section.title}</h4>}
          <SettingRows fields={section.fields} settings={settings} onChange={onChange} />
        </Fragment>
      ))}
    </>
  )
}
