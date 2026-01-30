"use client"

import { useState, useEffect } from "react"

/**
 * Returns the height offset (px) that the virtual keyboard is taking,
 * so we can add padding-bottom to keep the focused input and CTA visible.
 * Uses visualViewport resize/scroll. Safe to use in bottom sheets.
 */
export function useKeyboardOffset(enabled: boolean): number {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      const heightDiff = window.innerHeight - vv.height
      setOffset(Math.max(0, Math.round(heightDiff)))
    }
    update()
    vv.addEventListener("resize", update)
    vv.addEventListener("scroll", update)
    return () => {
      vv.removeEventListener("resize", update)
      vv.removeEventListener("scroll", update)
    }
  }, [enabled])

  return offset
}
