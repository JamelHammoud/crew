import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'

export const HTMLContainer = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function HTMLContainer(
  { className, ...props },
  ref
) {
  return <div ref={ref} className={['crew-shape-html', className].filter(Boolean).join(' ')} {...props} />
})

export interface TLCollaboratorCursorOverlay {
  id: string
  type?: string
  props?: unknown
}

export class CollaboratorCursorOverlayUtil {
  static type = 'collaborator_cursor'

  isActive(): boolean {
    return true
  }

  getOverlays(): TLCollaboratorCursorOverlay[] {
    return []
  }
}

export interface SelectionForegroundOverlayUtil {
  isActive(): boolean
}

export interface TLComponents {
  ContextMenu?: ReactNode | null
  MenuPanel?: ReactNode | null
  NavigationPanel?: ReactNode | null
  StylePanel?: ReactNode | null
  Toolbar?: ReactNode | null
  PageMenu?: ReactNode | null
  QuickActions?: ReactNode | null
  ActionsMenu?: ReactNode | null
  HelpMenu?: ReactNode | null
  ZoomMenu?: ReactNode | null
  MainMenu?: ReactNode | null
  DebugPanel?: ReactNode | null
  DebugMenu?: ReactNode | null
  SharePanel?: ReactNode | null
}

export interface CanvasOptions {
  maxPages?: number
}
