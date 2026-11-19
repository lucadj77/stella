import { useState } from 'react'

/**
 * Riordino a trascinamento di un elenco verticale: `itemProps(i)` va sull'elemento della voce.
 * Metà superiore della voce: prima; metà inferiore: dopo. `onMove` riceve la posizione che la voce
 * avrà dopo lo spostamento e la voce su cui è stata lasciata; `dragging` è la voce trascinata.
 */
export function useDragReorder(onMove: (from: number, to: number, target: number) => void): {
  dragging: number | null
  itemProps(i: number): React.HTMLAttributes<HTMLElement> & { draggable: boolean }
} {
  const [dragging, setDragging] = useState<number | null>(null)
  const [drop, setDrop] = useState<{ index: number; after: boolean } | null>(null)
  const reset = (): void => {
    setDragging(null)
    setDrop(null)
  }
  return {
    dragging,
    itemProps: (i) => ({
      draggable: true,
      className:
        dragging === i
          ? 'dragging'
          : drop?.index === i && dragging !== null
            ? drop.after
              ? 'drop-after'
              : 'drop-before'
            : undefined,
      onDragStart: (e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(i))
        setDragging(i)
      },
      onDragEnd: reset,
      onDragOver: (e) => {
        if (dragging === null) return
        e.preventDefault()
        const r = e.currentTarget.getBoundingClientRect()
        const after = e.clientY > r.top + r.height / 2
        if (drop?.index !== i || drop.after !== after) setDrop({ index: i, after })
      },
      onDrop: (e) => {
        e.preventDefault()
        if (dragging !== null && drop) {
          let to = drop.index + (drop.after ? 1 : 0)
          if (dragging < to) to -= 1
          if (to !== dragging || drop.index !== dragging) onMove(dragging, to, drop.index)
        }
        reset()
      }
    })
  }
}

/** L'elenco con la voce `from` spostata al posto `to` */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice()
  const [x] = next.splice(from, 1)
  next.splice(to, 0, x)
  return next
}
