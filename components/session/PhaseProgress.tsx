"use client"

import { cn } from "@/lib/utils"

export type Phase = "active_game" | "chip_entry" | "ready_to_finalize" | "finalized"

const PHASES: { id: Phase; label: string }[] = [
  { id: "active_game", label: "Buy-ins" },
  { id: "chip_entry", label: "Cash-outs" },
  { id: "ready_to_finalize", label: "Review" },
  { id: "finalized", label: "Settled" },
]

/**
 * Four-bar stage progress (DESIGN_SYSTEM.md §4 screens 7/10/12,
 * layout_guide.md §6). Non-interactive — reflects the session's phase
 * state machine; StageBanner below it carries the label + guidance.
 */
export function PhaseProgress({ phase, className }: { phase: Phase; className?: string }) {
  const currentIndex = PHASES.findIndex((p) => p.id === phase)

  return (
    <div className={cn("flex gap-1.5", className)} aria-label={`Stage: ${PHASES[currentIndex]?.label}`}>
      {PHASES.map((p, index) => (
        <div key={p.id} className="flex-1 space-y-1">
          <div
            className={cn(
              "h-1 rounded-full",
              index < currentIndex
                ? "bg-primary"
                : index === currentIndex
                  ? "bg-primary/70"
                  : "bg-muted-foreground/20"
            )}
          />
          <p
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wide truncate",
              index === currentIndex ? "text-primary" : "text-muted-foreground/70"
            )}
          >
            {p.label}
          </p>
        </div>
      ))}
    </div>
  )
}
