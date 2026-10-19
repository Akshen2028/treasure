import { useCallback, useEffect, useRef } from 'react'

/** A release far enough down the sheet, or a quick flick, closes it; anything else snaps back. */
export function shouldDismiss(distance: number, velocity: number, sheetHeight: number) {
  return distance > Math.min(sheetHeight * 0.3, 160) || (distance > 24 && velocity > 0.5)
}

const isFormField = (target: EventTarget | null) =>
  target instanceof Element && target.closest('input, textarea, select, [contenteditable]') != null

/**
 * Lets a bottom sheet be dragged down and dismissed like a native iOS sheet. Returns a callback
 * ref for the sheet element. A drag starts only when the sheet is scrolled to the top, so
 * scrolling its content still works. A swiped-away sheet is marked `data-swiped` so its exit
 * animation can be skipped (it has already slid out).
 */
export function useSwipeToDismiss(onDismiss: () => void) {
  const onDismissRef = useRef(onDismiss)
  useEffect(() => {
    onDismissRef.current = onDismiss
  })

  return useCallback((sheet: HTMLElement | null) => {
    if (!sheet) return

    let startY = 0
    let startX = 0
    let startTime = 0
    let canDrag = false
    let dragging = false
    let distance = 0

    const moveTo = (y: number, animate: boolean) => {
      sheet.style.transition = animate ? 'transform 220ms cubic-bezier(0.32, 0.72, 0, 1)' : 'none'
      sheet.style.transform = y > 0 ? `translateY(${y}px)` : ''
    }

    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch) return
      startY = touch.clientY
      startX = touch.clientX
      startTime = event.timeStamp
      canDrag = event.touches.length === 1 && sheet.scrollTop <= 0 && !isFormField(event.target)
      dragging = false
      distance = 0
    }

    const onMove = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!canDrag || !touch) return
      const dy = touch.clientY - startY
      if (!dragging) {
        // Upward or sideways movement belongs to scrolling, not the sheet.
        if (dy < 0 || Math.abs(touch.clientX - startX) > Math.abs(dy)) {
          canDrag = false
          return
        }
        if (dy < 6) return
        dragging = true
      }
      event.preventDefault()
      distance = Math.max(0, dy)
      moveTo(distance, false)
    }

    const onEnd = (event: TouchEvent) => {
      if (!dragging) return
      dragging = false
      const velocity = distance / Math.max(1, event.timeStamp - startTime)
      if (shouldDismiss(distance, velocity, sheet.offsetHeight)) {
        sheet.dataset.swiped = ''
        moveTo(sheet.offsetHeight, true)
        sheet.addEventListener('transitionend', () => onDismissRef.current(), { once: true })
      } else {
        moveTo(0, true)
      }
    }

    sheet.addEventListener('touchstart', onStart, { passive: true })
    sheet.addEventListener('touchmove', onMove, { passive: false })
    sheet.addEventListener('touchend', onEnd)
    sheet.addEventListener('touchcancel', onEnd)
    return () => {
      sheet.removeEventListener('touchstart', onStart)
      sheet.removeEventListener('touchmove', onMove)
      sheet.removeEventListener('touchend', onEnd)
      sheet.removeEventListener('touchcancel', onEnd)
    }
  }, [])
}
