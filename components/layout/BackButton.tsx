"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"

/**
 * Back arrow that returns to the PREVIOUS screen (browser history), falling
 * back to `fallback` when there is no in-app history (deep link / refresh).
 */
export function BackButton({
  fallback = "/",
  variant = "ghost",
  className = "h-12 w-12 min-h-[48px] min-w-[48px] shrink-0",
  iconClassName = "h-6 w-6",
}: {
  fallback?: string
  variant?: "ghost" | "secondary"
  className?: string
  iconClassName?: string
}) {
  const router = useRouter()

  const handleClick = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back()
    } else {
      router.push(fallback)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size="icon"
      onClick={handleClick}
      aria-label="Back"
      className={className}
    >
      <ChevronLeft className={iconClassName} />
    </Button>
  )
}
