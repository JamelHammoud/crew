import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import { SAID_LIMIT, cleanSaid, type Said } from '../shared/scribeSaid'

// What was said, held so it can be copied again from the settings page. It is
// handed the file it writes to rather than reaching for one, the way the pill's
// own spot is, so nothing here has to know where the app keeps what it remembers
// for itself and a test can drive it against a folder of its own.
//
// A long dictation is written in stretches as it is spoken, so a take is opened
// once and added to several times. What lands on the page is the whole of what
// somebody said rather than a row for each stretch of it, which is the only
// shape of it anybody would recognise.

export class ScribeHistory {
  private file: string | null = null
  private said: Said[] = []
  private take: string[] | null = null

  remember(file: string): void {
    this.file = file
    try {
      this.said = cleanSaid(JSON.parse(fs.readFileSync(file, 'utf8')))
    } catch {
      this.said = []
    }
  }

  // A take that was never sealed is a dictation that never landed, so opening
  // the next one throws away whatever it was holding. Joined onto the new take
  // instead, a run that failed halfway would come back as the front of one
  // dictation wearing the end of another.
  begin(): void {
    this.take = []
  }

  add(text: string): void {
    if (this.take) this.take.push(text)
  }

  // The stretches already carry the space that keeps them off the end of the one
  // before them, so they join with nothing put between them.
  //
  // A take with nothing in it is not an entry. An empty row on the page is a row
  // spent on a dictation nobody said, and the take is let go of either way, so a
  // second call has nothing left to write.
  seal(): boolean {
    const take = this.take
    this.take = null
    if (!take) return false
    const text = take.join('').trim()
    if (!text) return false
    this.said = [{ id: randomUUID(), text, at: Date.now() }, ...this.said].slice(0, SAID_LIMIT)
    this.save()
    return true
  }

  all(): Said[] {
    return [...this.said]
  }

  // Only asking for no id at all takes the lot. An id that arrived empty is a
  // row nothing can be found under rather than a way to clear the page, which is
  // the one mistake here nobody could undo.
  forget(id?: string): void {
    this.said = id === undefined ? [] : this.said.filter(row => row.id !== id)
    this.save()
  }

  // A disk that will not take it costs the history and never the dictation:
  // whatever was said has already gone where it was going by the time this runs.
  private save(): void {
    if (!this.file) return
    try {
      fs.writeFileSync(this.file, JSON.stringify(this.said))
    } catch {}
  }
}
