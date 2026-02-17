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
          ? "border-amber-400 border-dashed bg-amber-500/20 ring-2 ring-amber-400/40 shadow-[0_0_12px_rgba(251,191,36,0.3)]"
          : isEmpty
            ? "border-dashed border-white/25 bg-white/5 hover:bg-white/10"
            : "border-transparent bg-transparent p-0"
        }
      `}
    >
      {isEmpty ? (
        <Plus className="h-4 w-4 text-white/40" />
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
