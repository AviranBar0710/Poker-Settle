"use client"

import { Card, CardContent } from "@/components/ui/card"
import { StatStrip, type StatStripItem } from "@/components/ui/stat-strip"
import { cn } from "@/lib/utils"

/**
 * Hero net-result card (layout_guide.md §3/§5): all-time signed net in
 * display-money type over a strip of supporting tiles. Shared by Profile
 * and the per-player stats screen. Presentational only.
 */
export function NetResultCard({
  label = "All-time net",
  net,
  currencySymbol,
  tiles,
}: {
  label?: string
  net: number
  currencySymbol: string
  tiles: StatStripItem[]
}) {
  const isNegative = net < 0
  const formatted = `${isNegative ? "−" : "+"}${currencySymbol}${Math.abs(net).toLocaleString(
    undefined,
    { minimumFractionDigits: 0, maximumFractionDigits: 0 }
  )}`

  return (
    <Card className="overflow-hidden">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-10 -right-3 select-none text-[150px] leading-none text-primary/5 -rotate-12"
      >
        ♠
      </span>
      <CardContent className="relative space-y-4 p-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              "mt-1 text-[28px] font-extrabold leading-9 tabular-nums",
              isNegative ? "text-destructive" : "text-success"
            )}
          >
            {formatted}
          </p>
        </div>
        <StatStrip items={tiles} />
      </CardContent>
    </Card>
  )
}
