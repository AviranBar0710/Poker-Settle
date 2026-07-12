"use client"

import { Plus } from "lucide-react"
import { PokerCard } from "./Card"
import type { SelectedSlot } from "./types"

type NonNullSlot = Exclude<SelectedSlot, null>

interface CardSlotProps {
  card: string
  slot: NonNullSlot
  selectedSlot: SelectedSlot | null
  onSlotClick: (slot: NonNullSlot) => void
  variant?: "compact" | "normal" | "small"
}

export function CardSlot({
  card,
  slot,
  selectedSlot,
  onSlotClick,
  variant = "normal",
}: CardSlotProps) {
  const isSelected =
    selectedSlot &&
    ((slot.type === "player" &&
      selectedSlot.type === "player" &&
      selectedSlot.playerIndex === slot.playerIndex &&
      selectedSlot.cardIndex === slot.cardIndex) ||
      (slot.type === "board" &&
        selectedSlot.type === "board" &&
        selectedSlot.index === slot.index))

  const isEmpty = !card || card.length < 2

  const sizeClass = {
    compact: "w-[32px] h-[44px] min-w-[32px] min-h-[44px]",
    normal: "w-[52px] h-[72px] min-w-[52px] min-h-[72px]",
    small: "w-[36px] min-w-[36px] h-10 min-h-[2.5rem]",
  }[variant]

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onSlotClick(slot)
      }}
      className={`
        rounded-lg border-2 transition-all duration-200 flex items-center justify-center overflow-hidden flex-shrink-0 box-border
        ${sizeClass}
        ${isSelected
          ? "border-primary border-dashed bg-primary/10 shadow-[0_0_14px_rgba(61,220,132,0.25)]"
          : isEmpty
            ? "border-dashed border-muted-foreground/40 bg-card-raised hover:bg-card"
            : "border-transparent bg-transparent p-0"
        }
      `}
    >
      {isEmpty ? (
        <Plus className={`h-4 w-4 ${isSelected ? "text-primary" : "text-foreground/70"}`} />
      ) : (
        <PokerCard
          card={card}
          variant={variant}
          state={isSelected ? "selected" : "locked"}
        />
      )}
    </button>
  )
}
