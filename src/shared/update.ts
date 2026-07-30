// A new Crew is out. The stages are what the app can say about that, and the
// whole of how one becomes the next lives here rather than in main, so it is
// driven by hand in a test without electron anywhere near it.
export type UpdateStage = 'none' | 'found' | 'getting' | 'ready' | 'failed'

export interface UpdateState {
  stage: UpdateStage
  version: string
  percent: number
}

export const NO_UPDATE: UpdateState = { stage: 'none', version: '', percent: 0 }

export type UpdateWord =
  | { word: 'found'; version: string }
  | { word: 'nothing' }
  | { word: 'getting' }
  | { word: 'progress'; percent: number }
  | { word: 'ready'; version: string }
  | { word: 'error' }

function share(percent: number): number {
  if (!Number.isFinite(percent)) return 0
  return Math.min(100, Math.max(0, Math.round(percent)))
}

export function nextUpdate(state: UpdateState, said: UpdateWord): UpdateState {
  // Landed is the end of it. The app is on its way over and nothing said after
  // that can take the offer of a restart off the screen.
  if (state.stage === 'ready') return state
  switch (said.word) {
    case 'found':
      return state.stage === 'none' || state.stage === 'failed'
        ? { stage: 'found', version: said.version, percent: 0 }
        : state
    // A check that finds nothing never takes back one already found, or a pass
    // made while a download is running would clear the pill out from under it.
    case 'nothing':
      return state
    case 'getting':
      return { ...state, stage: 'getting', percent: 0 }
    // Progress arrives many times a second and most of them land on the number
    // already drawn, so an unchanged one is not news and wakes nobody.
    case 'progress': {
      if (state.stage !== 'getting') return state
      const percent = Math.max(state.percent, share(said.percent))
      return percent === state.percent ? state : { ...state, percent }
    }
    case 'ready':
      return { stage: 'ready', version: said.version || state.version, percent: 100 }
    // A check that could not reach the internet is nothing to say. Only a
    // download somebody asked for and did not get is worth a word.
    case 'error':
      return state.stage === 'getting' ? { ...state, stage: 'failed', percent: 0 } : state
  }
}

export type UpdatePress = 'get' | 'restart' | 'none'

// One press, and what it means is read off where the update has got to. Asking
// again after a failure is the same press as asking the first time.
export function pressDoes(stage: UpdateStage): UpdatePress {
  if (stage === 'found' || stage === 'failed') return 'get'
  if (stage === 'ready') return 'restart'
  return 'none'
}

export function updateStanding(state: UpdateState): boolean {
  return state.stage !== 'none'
}
