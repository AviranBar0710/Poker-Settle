"use client"

import Link from "next/link"
import { AppShell } from "@/components/layout/AppShell"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
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
  } = useHandsChanceState()

  return (
    <AppShell>
      <div className="flex flex-col h-[100dvh] min-h-[100dvh] max-h-[100dvh] bg-[#062d1a] overflow-hidden">
        {/* Header - fixed height */}
        <div className="flex-shrink-0 flex items-center gap-1 px-4 pt-3 pb-2">
          <Link href="/">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-white/80 hover:text-white hover:bg-white/10"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-bold text-white/90">Hands Chance</h1>
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
              onReset={handleReset}
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
