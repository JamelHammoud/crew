type Behavior = 'auto' | 'smooth'

type Box = { top: number; left: number; height: number; width: number }

export function scrollerOf(el: HTMLElement): HTMLElement | null {
  for (let up = el.parentElement; up; up = up.parentElement) {
    const style = getComputedStyle(up)
    if (/auto|scroll/.test(`${style.overflowX} ${style.overflowY}`)) return up
  }
  return null
}

const placeIn = (scroller: HTMLElement, target: HTMLElement): Box => {
  const box = scroller.getBoundingClientRect()
  const at = target.getBoundingClientRect()
  return {
    top: at.top - box.top + scroller.scrollTop,
    left: at.left - box.left + scroller.scrollLeft,
    height: at.height,
    width: at.width
  }
}

const nearest = (start: number, size: number, at: number, view: number): number =>
  start < at ? start : start + size > at + view ? start + size - view : at

const move = (page: HTMLElement, left: number, top: number, behavior: Behavior): void => {
  if (behavior === 'smooth' && typeof page.scrollTo === 'function') {
    page.scrollTo({ left, top, behavior })
    return
  }
  page.scrollLeft = left
  page.scrollTop = top
}

export function bringInto(target: HTMLElement, scroller?: HTMLElement | null, behavior: Behavior = 'auto'): void {
  const page = scroller ?? scrollerOf(target)
  if (!page) return
  const at = placeIn(page, target)
  const left = nearest(at.left, at.width, page.scrollLeft, page.clientWidth)
  const top = nearest(at.top, at.height, page.scrollTop, page.clientHeight)
  if (left === page.scrollLeft && top === page.scrollTop) return
  move(page, left, top, behavior)
}

export function bringIntoY(target: HTMLElement, scroller?: HTMLElement | null, behavior: Behavior = 'auto'): void {
  const page = scroller ?? scrollerOf(target)
  if (!page) return
  const at = placeIn(page, target)
  const top = nearest(at.top, at.height, page.scrollTop, page.clientHeight)
  if (top === page.scrollTop) return
  move(page, page.scrollLeft, top, behavior)
}

export function centerIn(target: HTMLElement, scroller?: HTMLElement | null, behavior: Behavior = 'auto'): void {
  const page = scroller ?? scrollerOf(target)
  if (!page) return
  const at = placeIn(page, target)
  move(page, page.scrollLeft, at.top - (page.clientHeight - at.height) / 2, behavior)
}
