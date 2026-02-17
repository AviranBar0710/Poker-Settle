"use client"

import { CardSlot } from "./CardSlot"
import { OddsDisplay } from "./OddsDisplay"
import type { SelectedSlot, PlayerResult } from "./types"

interface PlayerSeatProps {
  playerIndex: number
  cards: string[]
  selectedSlot: SelectedSlot | null
  result: PlayerResult | undefined
  onPlayerSeatClick: (playerIndex: number) => void
  onSlotClick: (slot: SelectedSlot) => void
}

export function PlayerSeat({
  playerIndex,
  cards,
  selectedSlot,
  result,
  onPlayerSeatClick,
  onSlotClick,
}: PlayerSeatProps) {
  const isSeatSelected =
    selectedSlot?.type === "player" && selectedSlot.playerIndex === playerIndex

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onPlayerSeatClick(playerIndex)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onPlayerSeatClick(playerIndex)
        }
      }}
      className={`
        flex flex-col items-center p-2 rounded-xl transition-all duration-200 cursor-pointer
        ${isSeatSelected ? "ring-2 ring-amber-400/60 ring-offset-2 ring-offset-[#0a4d2e]" : ""}
      `}
    >
      <div className="flex gap-2 flex-shrink-0">
        {[0, 1].map((cardIndex) => (
          <CardSlot
            key={cardIndex}
            card={cards[cardIndex] ?? ""}
            slot={{ type: "player", playerIndex, cardIndex }}
            selectedSlot={selectedSlot}
            onSlotClick={onSlotClick}
            variant="normal"
          />
        ))}
      </div>
      <OddsDisplay playerIndex={playerIndex} result={result} />
    </div>
  )
}
