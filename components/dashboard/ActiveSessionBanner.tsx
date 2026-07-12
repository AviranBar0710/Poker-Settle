"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatStrip } from "@/components/ui/stat-strip"
import { Play } from "lucide-react"
import { getCurrencySymbol } from "@/lib/currency"
import { formatNumber } from "@/lib/utils"
import type { Session } from "@/types/session"
import Link from "next/link"

interface ActiveSessionBannerProps {
  activeSession: Session | null
  playerCount: number
  totalPot: number
}

function getElapsedTime(createdAt: string): string {
  const start = new Date(createdAt).getTime()
  const now = Date.now()
  const diffMs = now - start
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

/**
 * Dashboard hero (layout_guide.md §2): when a live game exists this is the
 * screen's single hero card — largest type, spade watermark, inset tiles,
 * full-width primary CTA inside the card.
 */
export function ActiveSessionBanner({
  activeSession,
  playerCount,
  totalPot,
}: ActiveSessionBannerProps) {
  const [elapsed, setElapsed] = useState<string>("—")

  useEffect(() => {
    if (!activeSession) {
      return
    }

    const updateElapsed = () => {
      setElapsed(getElapsedTime(activeSession.createdAt))
    }

    updateElapsed()
    const intervalId = window.setInterval(updateElapsed, 60_000)
    return () => window.clearInterval(intervalId)
  }, [activeSession])

  if (!activeSession) {
    return null
  }

  const sym = getCurrencySymbol(activeSession.currency)

  return (
    <Card className="overflow-hidden border-primary/30">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-10 -right-3 select-none text-[150px] leading-none text-primary/5 -rotate-12"
      >
        ♠
      </span>
      <CardContent className="relative p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 flex-1 truncate text-lg font-bold">
            {activeSession.name}
          </h3>
          <Badge variant="live" className="shrink-0 gap-1.5 text-xs font-bold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            Live
          </Badge>
        </div>

        <StatStrip
          items={[
            { label: "Players", value: playerCount },
            {
              label: "On table",
              value: `${sym}${formatNumber(totalPot, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
            },
            { label: "Elapsed", value: elapsed },
          ]}
        />

        <Link href={`/session/${activeSession.id}`} className="block">
          <Button size="lg" className="w-full gap-2 text-base font-semibold">
            <Play className="h-4 w-4" />
            Resume Session
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
