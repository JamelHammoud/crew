import { create } from 'zustand'
import type { ScanReport } from '../../../shared/scan'

type ScanState = {
  folder: string | null
  report: ScanReport | null
  running: boolean
  scan(folder: string | null, again?: boolean): void
}

export const useScan = create<ScanState>((set, get) => ({
  folder: null,
  report: null,
  running: false,
  scan: (folder, again = false) => {
    const held = get()
    if (held.running) return
    if (!again && held.report && held.folder === folder) return
    const scanProject = window.crew?.scanProject
    if (!scanProject) return
    const moved = held.folder !== folder
    set({ folder, running: true, ...(moved ? { report: null } : {}) })
    const settle = (report: ScanReport): void => {
      if (get().folder === folder) set({ report, running: false })
    }
    void scanProject()
      .then(settle)
      .catch(() => settle({ kind: 'failed', message: 'The scan stopped before it finished.' }))
  }
}))
