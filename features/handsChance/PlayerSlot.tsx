"use client"

import { Label } from "@/components/ui/label"
import { Plus } from "lucide-react"
import { PokerCard } from "./Card"
import type { SelectedSlot } from "./types"

interface PlayerSlotProps {
  cards: string[]
  playerIndex: number
  selectedSlot: SelectedSlot
  onPlayerSeatClick: (playerIndex: number) => void
  onSlotClick: (slot: SelectedSlot) => void
}

export function PlayerSlot({
  cards,
  playerIndex,
  selectedSlot,
  onPlayerSeatClick,
  onSlotClick,
}: PlayerSlotProps) {
  const isPlayerSelected =
    selectedSlot?.type === "player" && selectedSlot.playerIndex === playerIndex

  return (
    <div className="space-y-2">
      <button
        onClick={() => onPlayerSeatClick(playerIndex)}
        className="text-left w-full"
      >
        <Label
          className={`cursor-pointer ${isPlayerSelected ? "text-primary font-semibold" : ""}`}
        >
          Player {playerIndex + 1}
        </Label>
      </button>
      <div className="flex gap-2">
        {[0, 1].map((cardIndex) => {
          const slot: SelectedSlot = { type: "player", playerIndex, cardIndex }
          const isSelected =
            selectedSlot?.type === "player" &&
            selectedSlot.playerIndex === playerIndex &&
            selectedSlot.cardIndex === cardIndex
          const card = cards[cardIndex]
          const isEmpty = !card || card.length < 2

          return (
            <button
              key={cardIndex}
              onClick={() => onSlotClick(slot)}
              className={`flex-1 rounded-lg border-2 transition-all flex items-center justify-center min-w-[48px] overflow-hidden ${
                isSelected
                  ? "border-primary border-dashed bg-primary/10"
                  : isEmpty
                    ? "border-dashed border-muted-foreground/30 bg-muted/20 hover:bg-muted/30 h-14"
                    : "border-border bg-card hover:bg-muted/50 h-14"
              }`}
            >
              {isEmpty ? (
                <Plus className="h-5 w-5 text-muted-foreground" />
              ) : (
                <PokerCard
                  card={card}
                  variant="normal"
                  state={isSelected ? "selected" : "default"}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
