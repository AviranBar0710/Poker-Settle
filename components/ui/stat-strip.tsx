"use client"

import { cn } from "@/lib/utils"

export interface StatStripItem {
  label: string
  value: React.ReactNode
  /** Accent only for money that is a result (profit/loss) — neutral facts stay uncolored. */
  accent?: "success" | "danger"
}

/**
 * Compact inset stat tiles (layout_guide.md §1). Replaces "grid of stat
 * cards": secondary numbers share one strip so none competes with the
 * screen's hero. Money is never truncated — with 4+ items the strip wraps
 * to a 2-column grid on small screens instead of clipping values.
 */
export function StatStrip({
  items,
  className,
}: {
  items: StatStripItem[]
  className?: string
}) {
  const cols =
    items.length >= 4
      ? "grid-cols-2 lg:grid-cols-4"
      : items.length === 3
        ? "grid-cols-3"
        : "grid-cols-2"

  return (
    <div className={cn("grid gap-2", cols, className)}>
      {items.map((it) => (
        <div
          key={it.label}
          className="min-w-0 rounded-tile border bg-background/45 px-3 py-3"
        >
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {it.label}
          </p>
          <p
            className={cn(
              "mt-1 text-base sm:text-lg font-extrabold leading-tight tabular-nums",
              it.accent === "success" && "text-success",
              it.accent === "danger" && "text-destructive"
            )}
          >
            {it.value}
          </p>
        </div>
      ))}
    </div>
  )
}
