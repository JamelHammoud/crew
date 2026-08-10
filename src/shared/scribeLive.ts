import { tidy, type ScribeChunk, type TidyRules } from './scribeTidy'

// A dictation written as it is said. What the take hands over is a pause's worth
// of speech, which is a whole thought, so it is tidied on its own and written the
// moment whisper has read it rather than being held for the end.
//
// One stretch at a time is what makes that safe. Tidying the whole of a dictation
// again on every stretch would rewrite what is already on somebody's screen: the
// mark at the end of a sentence is placed from the silence that follows it, and a
// correction reaches back a sentence, so the words already written would change
// under words nothing here can take back. So they do not. A correction reaches
// back over what is still being held and no further, and everything settled goes
// out and stays out.

export class ScribeFlow {
  private wrote = false

  // What to write for a stretch, and nothing at all for one whisper heard no
  // words in. Every stretch after the first carries the space that keeps it off
  // the end of the one before it.
  next(chunks: readonly ScribeChunk[], rules: TidyRules): string {
    return this.mark(tidy(chunks, rules))
  }


  mark(text: string): string {
    if (!text) return ''
    const out = this.wrote ? ` ${text}` : text
    this.wrote = true
    return out
  }

  reset(): void {
    this.wrote = false
  }
}
