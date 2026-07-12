"use client"

import { cn } from "@/lib/utils"

export interface StatStripItem {
  label: string
  value: React.ReactNode
  /** Accent only for money that is a result (profit/loss) — neutral facts stay uncolored. */
  accent?: "success" | "danger"
}

/**
 * Single row of compact inset stat tiles (layout_guide.md §1).
 * Replaces "grid of stat cards": secondary numbers share one strip so none
 * competes with the screen's hero. Same tile visual as SessionCard's tiles.
 */
export function StatStrip({
  items,
  className,
}: {
  items: StatStripItem[]
  className?: string
}) {
  return (
    <div className={cn("grid grid-flow-col auto-cols-fr gap-2 overflow-x-auto", className)}>
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-tile border bg-background/45 px-3 py-2.5 min-w-[92px]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground whitespace-nowrap">
            {it.label}
          </p>
          <p
            className={cn(
              "mt-0.5 text-lg font-extrabold tabular-nums truncate",
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
