"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Play, Users, Coins, Clock } from "lucide-react"
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
    <Card className="border-primary/30 bg-primary/5 shadow-sm">
      <CardContent className="py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="default" className="bg-green-600 hover:bg-green-600 text-white text-xs font-medium gap-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                </span>
                Live
              </Badge>
              <h3 className="text-lg font-bold truncate">{activeSession.name}</h3>
            </div>

            <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {playerCount} {playerCount === 1 ? "Player" : "Players"}
              </span>
              <span className="flex items-center gap-1.5">
                <Coins className="h-4 w-4" />
                <span className="font-mono font-medium text-foreground">
                  {sym}{formatNumber(totalPot, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {elapsed}
              </span>
            </div>
          </div>

          <Link href={`/session/${activeSession.id}`} className="shrink-0">
            <Button size="lg" className="gap-2 w-full sm:w-auto min-w-[160px] text-base font-semibold">
              <Play className="h-4 w-4" />
              Resume Session
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
