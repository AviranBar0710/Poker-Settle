"use client"

import { Plus } from "lucide-react"
import { PokerCard } from "./Card"
import type { SelectedSlot } from "./types"

interface BoardSlotProps {
  card: string
  index: number
  selectedSlot: SelectedSlot
  onSlotClick: (slot: SelectedSlot) => void
}

export function BoardSlot({
  card,
  index,
  selectedSlot,
  onSlotClick,
}: BoardSlotProps) {
  const slot: SelectedSlot = { type: "board", index }
  const isSelected = selectedSlot?.type === "board" && selectedSlot.index === index
  const isEmpty = !card || card.length < 2

  return (
    <button
      onClick={() => onSlotClick(slot)}
      className={`rounded-lg border-2 transition-all flex items-center justify-center min-w-[48px] overflow-hidden ${
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
}
