import { useCallback, useState } from 'react'
import Select from '../Select'
import { Failed, Loading, Note } from './Frame'
import { ROW_CAP, sheetsFrom, type Sheet } from './sheet'
import { useRead } from './useRead'

const FIGURE = /^[-+]?[0-9][0-9,.\s]*%?$/

const cellClass = (value: string): string =>
  FIGURE.test(value.trim()) && value.trim() !== '' ? 'font-mono tabular-nums text-right' : ''

function Table({ sheet }: { sheet: Sheet }) {
  const [head, ...body] = sheet.rows
  if (!head) return <Note>Nothing in this sheet</Note>
  return (
    <table className="w-max border-separate border-spacing-0 text-xs select-text">
      <thead>
        <tr>
          {head.map((value, index) => (
            <th
              key={index}
              className="sticky top-0 z-10 max-w-64 truncate border-b border-ink-700 bg-ink-800 px-3 py-2 text-left font-semibold text-fg"
            >
              {value}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {body.map((row, index) => (
          <tr key={index}>
            {head.map((_, column) => (
              <td
                key={column}
                className={`max-w-64 truncate border-b border-ink-700/60 px-3 py-1.5 text-fg-secondary ${cellClass(row[column] ?? '')}`}
              >
                {row[column] ?? ''}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function SheetPreview({ url, mime }: { url: string; mime: string }) {
  const [at, setAt] = useState('')
  const read = useCallback((bytes: ArrayBuffer) => sheetsFrom(bytes, mime), [mime])
  const { data, failed } = useRead(url, read)

  if (failed) return <Failed label="Could not read this file" />
  if (!data) return <Loading />
  if (data.length === 0) return <Note>Nothing in this file</Note>

  const sheet = data.find(one => one.name === at) ?? data[0]!

  return (
    <div className="absolute inset-0 flex flex-col">
      {data.length > 1 && (
        <div className="shrink-0 px-4 py-2.5 border-b border-ink-700">
          <Select
            value={sheet.name}
            options={data.map(one => ({ value: one.name, label: one.name }))}
            onChange={setAt}
          />
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto">
        <Table sheet={sheet} />
        {sheet.total > ROW_CAP && (
          <Note>
            Showing the first {ROW_CAP.toLocaleString()} of {sheet.total.toLocaleString()} rows
          </Note>
        )}
      </div>
    </div>
  )
}
