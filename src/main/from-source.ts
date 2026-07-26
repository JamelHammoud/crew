// Not app.isPackaged: that only asks whether the binary is still called
// Electron, and `yarn dev` renames it to Crew, so a run from source claims to
// be packaged. A packaged app loads from inside the bundle's resources, and
// nothing run from source does.
export function fromSource(appPath: string): boolean {
  return !/[\\/][Rr]esources[\\/]app(\.asar)?$/.test(appPath)
}

const off = new Set(['', '0', 'false'])

export function wearsBlueprint(appPath: string, env: Record<string, string | undefined>): boolean {
  const asked = env.CREW_SHIPPING_ICON
  if (asked !== undefined && !off.has(asked)) return false
  return fromSource(appPath)
}
