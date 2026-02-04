"use client"

import { useCallback, useRef } from "react"

const LONG_PRESS_MS = 500
const MOVE_THRESHOLD_PX = 10

function getStartCoords(e: React.TouchEvent | React.MouseEvent): { x: number; y: number } {
  if ("touches" in e && e.touches?.length) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const me = e as React.MouseEvent
  return { x: me.clientX, y: me.clientY }
}

function getEndCoords(e: React.TouchEvent | React.MouseEvent): { x: number; y: number } {
  if ("changedTouches" in e && e.changedTouches?.length) {
    return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
  }
  const me = e as React.MouseEvent
  return { x: me.clientX, y: me.clientY }
}

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1)
}

/**
 * Returns handlers for long-press detection.
 * - onTouchStart/onTouchEnd + onMouseDown/onMouseUp
 * - Short tap: onTap fires (after touchend/mouseup) if movement < 10px
 * - Long press: onLongPress fires (after LONG_PRESS_MS)
 * - If long press fires, onTap is NOT called
 * - Movement > 10px between start/end is treated as scroll; onTap is NOT called
 */
export function useLongPress(
  onTap: () => void,
  onLongPress: () => void
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFiredRef = useRef(false)
  const startRef = useRef<{ x: number; y: number } | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const handleStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    longPressFiredRef.current = false
    startRef.current = getStartCoords(e)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      longPressFiredRef.current = true
      onLongPress()
    }, LONG_PRESS_MS)
  }, [onLongPress])

  const handleEnd = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const start = startRef.current
    startRef.current = null
    clearTimer()
    if (!longPressFiredRef.current && start) {
      const end = getEndCoords(e)
      const moved = distance(start.x, start.y, end.x, end.y)
      if (moved <= MOVE_THRESHOLD_PX) {
        onTap()
      }
    }
  }, [clearTimer, onTap])

  return {
    onTouchStart: (e: React.TouchEvent) => handleStart(e),
    onTouchEnd: (e: React.TouchEvent) => handleEnd(e),
    onMouseDown: (e: React.MouseEvent) => handleStart(e),
    onMouseUp: (e: React.MouseEvent) => handleEnd(e),
    onMouseLeave: clearTimer,
  }
}
