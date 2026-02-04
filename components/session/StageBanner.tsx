"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { AlertTriangle } from "lucide-react"

export type PhaseType = "active_game" | "chip_entry" | "ready_to_finalize" | "finalized"

interface StageBannerProps {
  phase: PhaseType
  subtitle: string
  /** Count of players missing buy-ins (shows warning when > 0) */
  missingBuyinsCount?: number
  /** Callback when user taps to scroll to problematic players */
  onScrollToMissingBuyins?: () => void
  /** Desktop actions slot (e.g., Add Player, Start Chip Entry buttons) */
  actions?: React.ReactNode
  className?: string
}

const PHASE_CONFIG: Record<
  PhaseType,
  { label: string; bgClass: string; borderClass: string; icon: string }
> = {
  active_game: {
    label: "Active Game",
    bgClass: "bg-primary/10",
    borderClass: "border-primary/30",
    icon: "📍",
  },
  chip_entry: {
    label: "Chip Entry",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/30",
    icon: "📋",
  },
  ready_to_finalize: {
    label: "Ready to Finalize",
    bgClass: "bg-green-500/10",
    borderClass: "border-green-500/30",
    icon: "✓",
  },
  finalized: {
    label: "Finalized",
    bgClass: "bg-muted",
    borderClass: "border-muted-foreground/30",
    icon: "🔒",
  },
}

export function StageBanner({
  phase,
  subtitle,
  missingBuyinsCount = 0,
  onScrollToMissingBuyins,
  actions,
  className,
}: StageBannerProps) {
  const config = PHASE_CONFIG[phase]
  const showMissingBuyinsWarning =
    phase === "active_game" && missingBuyinsCount > 0

  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3",
        config.bgClass,
        config.borderClass,
        className
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-base" aria-hidden>
              {config.icon}
            </span>
            <span className="font-semibold text-base">{config.label}</span>
          </div>
          <p className="text-sm text-muted-foreground pl-6 sm:pl-6">
            {subtitle}
          </p>
          {showMissingBuyinsWarning && (
            <button
              type="button"
              onClick={onScrollToMissingBuyins}
              className="flex items-center gap-1.5 mt-2 pl-6 sm:pl-6 text-sm text-amber-600 dark:text-amber-500 hover:underline text-left"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                {missingBuyinsCount} player
                {missingBuyinsCount > 1 ? "s" : ""} need
                {missingBuyinsCount === 1 ? "s" : ""} buy-ins
              </span>
            </button>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 pl-6 sm:pl-0 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
