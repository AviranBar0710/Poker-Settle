"use client"

import { cn } from "@/lib/utils"

/**
 * Mobile-only sticky bottom action bar (layout_guide.md §1).
 * Hosts the screen's single primary CTA above the safe area; pages using it
 * must add `pb-28 sm:pb-6` to their content so the last item scrolls clear.
 * On `sm:`+ the same action should render inline in the page header instead.
 */
export function StickyCta({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 sm:hidden",
        "bg-gradient-to-t from-background via-background/95 to-transparent",
        "px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]",
        className
      )}
    >
      {children}
    </div>
  )
}
