export type CanvasEventName =
  | 'wheel'
  | 'pointer_down'
  | 'pointer_move'
  | 'long_press'
  | 'pointer_up'
  | 'double_click'
  | 'right_click'
  | 'middle_click'
  | 'key_down'
  | 'key_up'
  | 'key_repeat'
  | 'cancel'
  | 'complete'
  | 'interrupt'
  | 'tick'

export interface CanvasEventInfo {
  name: CanvasEventName
  [key: string]: any
}

export const EVENT_NAME_MAP = {
  wheel: 'onWheel',
  pointer_down: 'onPointerDown',
  pointer_move: 'onPointerMove',
  long_press: 'onLongPress',
  pointer_up: 'onPointerUp',
  double_click: 'onDoubleClick',
  right_click: 'onRightClick',
  middle_click: 'onMiddleClick',
  key_down: 'onKeyDown',
  key_up: 'onKeyUp',
  key_repeat: 'onKeyRepeat',
  cancel: 'onCancel',
  complete: 'onComplete',
  interrupt: 'onInterrupt',
  tick: 'onTick'
} as const satisfies Record<CanvasEventName, string>

export type StateEventHandler = (info: any) => void

export type StateEventHandlers = Partial<
  Record<(typeof EVENT_NAME_MAP)[CanvasEventName], StateEventHandler>
>
