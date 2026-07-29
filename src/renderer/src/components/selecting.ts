export const selecting = (): boolean => {
  const selection = window.getSelection()
  return Boolean(selection && !selection.isCollapsed && selection.toString().length > 0)
}
