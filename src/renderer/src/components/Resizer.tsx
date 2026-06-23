import type { MouseEvent as ReactMouseEvent } from 'react'

/** A vertical drag handle for resizing a side panel. `onResize` gets the live cursor X. */
export default function Resizer({
  side,
  onResize
}: {
  side: 'left' | 'right'
  onResize: (clientX: number) => void
}): JSX.Element {
  const start = (e: ReactMouseEvent): void => {
    e.preventDefault()
    const handle = e.currentTarget as HTMLElement
    handle.classList.add('dragging')
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const move = (ev: globalThis.MouseEvent): void => onResize(ev.clientX)
    const up = (): void => {
      handle.classList.remove('dragging')
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  return <div className={`resizer-x ${side}`} onMouseDown={start} aria-hidden="true" />
}
