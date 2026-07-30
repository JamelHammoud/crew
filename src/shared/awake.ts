// Whether this machine stays awake while Crew is open. One machine, one answer,
// and several windows on one folder is normal here, so what decides it is
// whether anybody is asking rather than what the last window happened to say. A
// window that dies has stopped asking, and the last one going is what lets go.
//
// It is the machine that stays up and not the screen: work carries on with the
// display asleep, and a screen lit all night is a cost nobody asked for.
export const AWAKE_HOLD = 'prevent-app-suspension'

export class Awake {
  private asking = new Set<number>()

  // The answer only when it really moved, and null when it did not, so the hold
  // is taken and let go once rather than on every window saying again what it
  // has already said.
  wants(id: number, on: boolean): boolean | null {
    const was = this.on
    if (on) this.asking.add(id)
    else this.asking.delete(id)
    return this.on === was ? null : this.on
  }

  forget(id: number): boolean | null {
    return this.asking.has(id) ? this.wants(id, false) : null
  }

  get on(): boolean {
    return this.asking.size > 0
  }
}
