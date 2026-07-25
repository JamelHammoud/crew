// Not app.isPackaged: that only asks whether the binary is still called
// Electron, and `yarn dev` renames it to Crew, so a run from source claims to
// be packaged. A packaged app loads from inside the bundle's resources, and
// nothing run from source does.
export function fromSource(appPath: string): boolean {
  return !/[\\/][Rr]esources[\\/]app(\.asar)?$/.test(appPath)
}
