import { execFile } from 'node:child_process'
import { landingOf, type Landing } from '../shared/scribeLanding'

// Asking the machine what has the caret in it. The rule is in `scribeLanding`, so
// this is the asking and nothing else, and it imports no electron: the check that
// hands it real applications reads it directly.
//
// macOS keeps this behind Accessibility, which Scribe already has to be granted
// for the key and the paste, so there is nothing new here for anybody to turn on.
// Everywhere else there is no way to ask without a native addon of our own, and
// 'unknown' is the honest answer rather than a guess that would hold somebody's
// words back from a field they really were in.

// A focused element that is missing value is two different answers, and the
// focused window is what tells them apart. That one extra read is the whole of the
// difference between a feature that works and one that says "click into a text
// box" over somebody's open composer.
//
// With a focused window, it is a Chromium application that has not built its
// accessibility tree. It builds one only once something asks for it the way it is
// waiting to be asked, and nothing here does, so Crew, Discord, VS Code and Chrome
// all hand back missing value the whole time a caret is sitting in a box. That is
// a silence, and it pastes.
//
// With no focused window, nothing in that application is open. Mail, Messages,
// Terminal and ChatGPT all sit like this with every window shut, and there really
// is nowhere for the words to land, so this is the 'none' the card exists for.
//
// Nothing here ever turns anybody's tree on. AXManualAccessibility is somebody
// else's application and costs them for as long as it is on, it is honoured by
// almost nothing anyway, and Chrome wants AXEnhancedUserInterface and up to
// several seconds to answer after it. Crew is answered without asking macOS at
// all, and every other application is left as it was found.
//
// One place the script lives. `AXRole` is read as an attribute rather than
// through System Events' own `role`, because the two disagree: a page with
// nothing focused comes back as a group from the property and as the web area it
// really is from the attribute, and the web area is the whole case this is for.
//
// Every name in here is short and plain on purpose. AppleScript has a reference
// form for half the words a person would reach for, so `front`, `focused`, `role`
// and `named` are all property forms rather than variables, and each one fails to
// compile in a way that reads as the Accessibility permission being refused.
export const CARET_SCRIPT = `set AppleScript's text item delimiters to ","
tell application "System Events"
  try
    set p to first application process whose frontmost is true
    set el to value of attribute "AXFocusedUIElement" of p
  on error
    return "unknown"
  end try
  if el is missing value then
    try
      set fw to value of attribute "AXFocusedWindow" of p
    on error
      return "unknown"
    end try
    if fw is missing value then return "none"
    return "unknown"
  end if
  try
    set rl to value of attribute "AXRole" of el
    set hl to name of every attribute of el
  on error
    return "unknown"
  end try
  return (rl as text) & linefeed & (hl as text)
end tell`

// Long enough for a machine that is busy, short enough that it is over before
// anybody has finished their first sentence. It is asked as the key goes down, so
// this whole wait sits behind somebody talking and costs the dictation nothing.
const PATIENCE_MS = 1500

// Our own windows, asked before the machine is. It answers null when the caret is
// in another application altogether, which is what sends the question on to macOS,
// and it is asked first because it is the one answer that is never a guess.
export type OwnCaret = () => Promise<Landing | null>

const elsewhere: OwnCaret = () => Promise.resolve(null)

// Nothing here waits forever. The machine is held to PATIENCE_MS by execFile and
// our own windows are held to it by this, because a page that never answers would
// leave a dictation with its words neither pasted nor held: the one way to lose
// them that this whole file exists to stop. A window that has not said by then is
// a window that has said nothing, and the question goes on to macOS.
async function within<T>(work: Promise<T>, instead: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work,
      new Promise<T>(answer => {
        timer = setTimeout(() => answer(instead), PATIENCE_MS)
      })
    ])
  } catch {
    return instead
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function askCaret(ours: OwnCaret = elsewhere, platform: string = process.platform): Promise<Landing> {
  const own = await within(Promise.resolve().then(ours), null)
  if (own) return own
  if (platform !== 'darwin') return 'unknown'
  return new Promise(answer => {
    execFile('osascript', ['-e', CARET_SCRIPT], { timeout: PATIENCE_MS }, (problem, printed) =>
      answer(problem ? 'unknown' : landingOf(printed))
    )
  })
}
