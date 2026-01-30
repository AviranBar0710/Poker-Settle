"use client"

import { useState, useEffect } from "react"

/**
 * Hook to detect if the current viewport is desktop (md breakpoint and up)
 * Uses the same breakpoint as Tailwind's `md:` (768px)
 * 
 * @returns boolean - true if desktop, false if mobile
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(false)

  useEffect(() => {
    // Set initial value on mount
    const checkIsDesktop = () => {
      setIsDesktop(window.innerWidth >= 768) // md breakpoint
    }

    // Check on mount
    checkIsDesktop()

    // Listen for resize events
    const handleResize = () => {
      checkIsDesktop()
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  return isDesktop
}

