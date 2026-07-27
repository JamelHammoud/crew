import fs from 'node:fs'
import path from 'node:path'

const LEGACY_FILE = 'chat.jsonl'
const SEGMENT_DIR = 'chat'
const SEGMENT_BYTES = 1_000_000
const SEGMENT_NAME = /^(\d{4,})\.jsonl$/

const tails = new Map<string, number>()

function segmentDir(root: string): string {
  return path.join(root, SEGMENT_DIR)
}

function segmentPath(root: string, index: number): string {
  return path.join(segmentDir(root), `${String(index).padStart(4, '0')}.jsonl`)
}

function segmentNumbers(root: string): number[] {
  let entries: string[]
  try {
    entries = fs.readdirSync(segmentDir(root))
  } catch {
    return []
  }
  const numbers: number[] = []
  for (const entry of entries) {
    const match = SEGMENT_NAME.exec(entry)
    if (match) numbers.push(Number(match[1]))
  }
  return numbers.sort((a, b) => a - b)
}

export function chatFiles(root: string): string[] {
  const files: string[] = []
  const legacy = path.join(root, LEGACY_FILE)
  if (fs.existsSync(legacy)) files.push(legacy)
  for (const index of segmentNumbers(root)) files.push(segmentPath(root, index))
  return files
}

export function appendChatLine(root: string, line: string): void {
  fs.mkdirSync(segmentDir(root), { recursive: true })
  let index = tails.get(root) ?? segmentNumbers(root).pop() ?? 1
  const size = fs.statSync(segmentPath(root, index), { throwIfNoEntry: false })?.size ?? 0
  if (size > 0 && size + line.length > SEGMENT_BYTES) index += 1
  tails.set(root, index)
  fs.appendFileSync(segmentPath(root, index), line)
}

export function readChatLines(root: string): string[] {
  const lines: string[] = []
  for (const file of chatFiles(root)) {
    let raw: string
    try {
      raw = fs.readFileSync(file, 'utf8')
    } catch {
      continue
    }
    for (const line of raw.split('\n')) {
      if (line.trim()) lines.push(line)
    }
  }
  return lines
}
