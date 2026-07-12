"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Session } from "@/types/session"
import { getCurrencySymbol } from "@/lib/currency"
import { formatDateDDMMYYYY } from "@/lib/utils"

type SessionCardProps = {
  session: Session
  playerCount: number
  totalBuyins: number
  /** Number of buy-in transactions; tile hidden when omitted. */
  buyinCount?: number
}

/**
 * Session Card — docs/design/DESIGN_SYSTEM.md §4 screen 2/5.
 * Presentational only: all data arrives via props, no fetching here.
 */
export function SessionCard({
  session,
  playerCount,
  totalBuyins,
  buyinCount,
}: SessionCardProps) {
  const sym = getCurrencySymbol(session.currency)
  const isLive = !session.finalizedAt

  return (
    <Card className="overflow-hidden transition-transform active:scale-[0.985]">
      {/* Spade watermark */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-9 -right-3 select-none text-[130px] leading-none text-primary/5 -rotate-12"
      >
        ♠
      </span>
      <CardContent className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold">{session.name}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {formatDateDDMMYYYY(session.createdAt)}
            </p>
          </div>
          {isLive ? (
            <Badge variant="live" className="shrink-0 gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              Live
            </Badge>
          ) : (
            <Badge variant="settled" className="shrink-0">
              Settled
            </Badge>
          )}
        </div>

        <div
          className={`mt-4 grid gap-2.5 ${buyinCount !== undefined ? "grid-cols-3" : "grid-cols-2"}`}
        >
          <div className="rounded-tile border bg-background/45 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Players
            </p>
            <p className="mt-0.5 text-base font-bold tabular-nums">
              {playerCount}
            </p>
          </div>
          <div className="rounded-tile border bg-background/45 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {isLive ? "On table" : "Pot"}
            </p>
            <p className="mt-0.5 truncate text-base font-bold tabular-nums">
              {sym}
              {totalBuyins.toFixed(0)}
            </p>
          </div>
          {buyinCount !== undefined && (
            <div className="rounded-tile border bg-background/45 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Buy-ins
              </p>
              <p className="mt-0.5 text-base font-bold tabular-nums">
                {buyinCount}
              </p>
            </div>
          )}
        </div>

        <Link href={`/session/${session.id}`} className="mt-4 block">
          <Button
            variant={isLive ? "default" : "outline"}
            className="w-full"
          >
            {isLive ? "Open Session" : "View Settlement"}
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
