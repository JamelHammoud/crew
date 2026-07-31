import { atom, type Atom } from '../signals'
import { Vec } from '../math'
import type { VecLike } from './types'

export class InputsManager {
  private readonly screenPoint: Atom<Vec>
  private readonly pagePoint: Atom<Vec>

  constructor() {
    this.screenPoint = atom('editor.inputs.screenPoint', new Vec())
    this.pagePoint = atom('editor.inputs.pagePoint', new Vec())
  }

  get currentScreenPoint(): Vec {
    return this.screenPoint.get()
  }

  get currentPagePoint(): Vec {
    return this.pagePoint.get()
  }

  getCurrentScreenPoint(): Vec {
    return this.screenPoint.get()
  }

  getCurrentPagePoint(): Vec {
    return this.pagePoint.get()
  }

  update(screenPoint: VecLike, pagePoint: VecLike): void {
    this.screenPoint.set(Vec.From(screenPoint))
    this.pagePoint.set(Vec.From(pagePoint))
  }
}
