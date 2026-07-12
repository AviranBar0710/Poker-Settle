"use client"

import Link from "next/link"
import { AppShell } from "@/components/layout/AppShell"
import { Button } from "@/components/ui/button"
import { ChevronLeft, RotateCcw } from "lucide-react"
import { useHandsChanceState } from "./useHandsChanceState"
import { PokerTableLayout } from "./PokerTableLayout"
import { CardPickerDock } from "./CardPickerDock"

export function HandsChancePage() {
  const {
    players,
    board,
    selectedSlot,
    results,
    isCardUsed,
    handleCardSelect,
    handlePlayerSeatClick,
    handleSlotClick,
    handleReset,
    handleUndo,
    canUndo,
  } = useHandsChanceState()

  return (
    <AppShell>
      <div className="flex flex-col h-[100dvh] min-h-[100dvh] max-h-[100dvh] overflow-hidden">
        {/* Header — back circle, title, Reset pill + undo circle (reference layout) */}
        <div className="flex-shrink-0 flex items-center gap-3 px-4 pt-4 pb-2">
          <Link href="/">
            <Button
              variant="secondary"
              size="icon"
              className="h-11 w-11 rounded-full shrink-0"
              aria-label="Back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold flex-1 min-w-0 truncate">Hands Chance</h1>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleReset}
            className="h-11 rounded-full px-5 text-sm font-semibold shrink-0"
          >
            Reset
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={handleUndo}
            disabled={!canUndo}
            className="h-11 w-11 rounded-full shrink-0"
            aria-label="Undo"
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
        </div>

        {/* Table area - flex-1, scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <div className="container mx-auto px-4 max-w-lg">
            <PokerTableLayout
              players={players}
              board={board}
              selectedSlot={selectedSlot}
              results={results}
              onPlayerSeatClick={handlePlayerSeatClick}
              onSlotClick={handleSlotClick}
            />
          </div>
        </div>

        {/* Card picker - flex child at bottom */}
        <CardPickerDock
          selectedSlot={selectedSlot}
          isCardUsed={isCardUsed}
          onCardSelect={handleCardSelect}
        />
      </div>
    </AppShell>
  )
}
