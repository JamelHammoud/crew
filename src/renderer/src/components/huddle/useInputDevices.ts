import { useEffect, useState } from 'react'
import { listInputs, onInputsChange, type InputDevice, type InputKind } from '../../media/devices'

// Read while the list is being looked at, and read again when something is
// plugged in or taken out, so a menu left open is never out of date.
export function useInputDevices(kind: InputKind, watching: boolean): InputDevice[] {
  const [devices, setDevices] = useState<InputDevice[]>([])

  useEffect(() => {
    if (!watching) return
    let live = true
    const read = (): void => {
      void listInputs(kind).then(found => {
        if (live) setDevices(found)
      })
    }
    read()
    const off = onInputsChange(read)
    return () => {
      live = false
      off()
    }
  }, [kind, watching])

  return devices
}
