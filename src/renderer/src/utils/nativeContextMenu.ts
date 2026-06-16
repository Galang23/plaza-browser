export interface NativeContextMenuItem {
  id?: string
  label?: string
  separator?: boolean
  disabled?: boolean
  shortcut?: string
  submenu?: NativeContextMenuItem[]
}

export function separator(): NativeContextMenuItem {
  return { separator: true }
}

export async function showNativeContextMenu(
  items: NativeContextMenuItem[],
  x: number,
  y: number
): Promise<string | null> {
  return window.electron.showContextMenu(items, x, y)
}
