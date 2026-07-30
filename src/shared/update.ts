// A new Crew is out. The stages are what the app can say about that, and the
// whole of how one becomes the next lives here rather than in main, so it is
// driven by hand in a test without electron anywhere near it.
export type UpdateStage = 'none' | 'found' | 'getting' | 'ready' | 'failed'

// The three ways it can go wrong are three different sentences, so what went
// wrong rides in the state and the words are picked off it where they are drawn.
export type UpdateWhy = '' | 'download' | 'install' | 'others'

export interface UpdateState {
  stage: UpdateStage
  version: string
  percent: number
  why: UpdateWhy
}

export const NO_UPDATE: UpdateState = { stage: 'none', version: '', percent: 0, why: '' }

export type UpdateWord =
  | { word: 'found'; version: string }
  | { word: 'nothing' }
  | { word: 'getting' }
  | { word: 'progress'; percent: number }
  | { word: 'ready'; version: string }
  | { word: 'error' }
  | { word: 'stuck'; why: UpdateWhy }

function share(percent: number): number {
  if (!Number.isFinite(percent)) return 0
  return Math.min(100, Math.max(0, Math.round(percent)))
}

export function nextUpdate(state: UpdateState, said: UpdateWord): UpdateState {
  switch (said.word) {
    // Landed is the end of the fetching, so nothing about a check moves it: the
    // bytes are already here and the offer on the screen is the restart.
    case 'found': {
      if (state.stage === 'getting' || state.stage === 'ready') return state
      const standing = state.stage === 'found' && state.version === said.version
      return standing ? state : { stage: 'found', version: said.version, percent: 0, why: '' }
    }
    // A check that finds nothing never takes back one already found, or a pass
    // made while a download is running would clear the pill out from under it.
    case 'nothing':
      return state
    case 'getting':
      return state.stage === 'getting' ? state : { ...state, stage: 'getting', percent: 0, why: '' }
    // Progress arrives many times a second and most of them land on the number
    // already drawn, so an unchanged one is not news and wakes nobody.
    case 'progress': {
      if (state.stage !== 'getting') return state
      const percent = Math.max(state.percent, share(said.percent))
      return percent === state.percent ? state : { ...state, percent }
    }
    case 'ready':
      return state.stage === 'ready'
        ? state
        : { stage: 'ready', version: said.version || state.version, percent: 100, why: '' }
    // A check that could not reach the internet is nothing to say. Only a
    // download somebody asked for and did not get is worth a word.
    case 'error':
      return state.stage === 'getting'
        ? { ...state, stage: 'failed', percent: 0, why: 'download' }
        : state
    // An install that did not happen is the one thing said after it landed. The
    // bytes are still here, so the press offers the whole of it again.
    case 'stuck':
      return state.stage === 'ready'
        ? { ...state, stage: 'failed', percent: 0, why: said.why }
        : state
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
