import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export const ROW_CAP = 2000

export interface Sheet {
  name: string
  rows: string[][]
  total: number
}

const TSV = 'text/tab-separated-values'

const cell = (value: unknown): string => (value === null || value === undefined ? '' : String(value))

const capped = (rows: unknown[][], name: string): Sheet => ({
  name,
  rows: rows.slice(0, ROW_CAP).map(row => row.map(cell)),
  total: rows.length
})

export function sheetsFrom(bytes: ArrayBuffer, mime: string): Sheet[] {
  if (mime === 'text/csv' || mime === TSV) {
    const parsed = Papa.parse<string[]>(new TextDecoder().decode(bytes), {
      delimiter: mime === TSV ? '\t' : '',
      skipEmptyLines: true
    })
    return [capped(parsed.data, '')]
  }
  const book = XLSX.read(new Uint8Array(bytes), { type: 'array' })
  return book.SheetNames.map(name => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name], {
      header: 1,
      blankrows: false,
      defval: '',
      raw: false
    })
    return capped(rows, name)
  })
}
