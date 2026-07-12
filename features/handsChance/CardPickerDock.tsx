"use client"

import { PokerCard } from "./Card"
import type { SelectedSlot } from "./types"

interface CardPickerDockProps {
  selectedSlot: SelectedSlot | null
  isCardUsed: (card: string) => boolean
  onCardSelect: (card: string) => void
}

// Reference order: ascending ranks, suit after suit, wrapping continuously
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K"]
const SUITS = ["h", "d", "c", "s"]
const ALL_CARDS = SUITS.flatMap((suit) => RANKS.map((rank) => rank + suit))

export function CardPickerDock({
  selectedSlot,
  isCardUsed,
  onCardSelect,
}: CardPickerDockProps) {
  return (
    <div
      className="flex-shrink-0 h-[228px] min-h-[200px] max-h-[248px] bg-background/95 backdrop-blur-sm border-t"
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      <div className="h-full overflow-y-auto px-1.5 py-1.5">
        <div className="grid grid-cols-9 gap-1">
          {ALL_CARDS.map((card) => {
            const used = isCardUsed(card)
            const isClickable = selectedSlot && !used
            const cardState = used
              ? "assigned"
              : selectedSlot
                ? "selectable"
                : "disabled"

            return (
              <button
                key={card}
                type="button"
                onClick={() => isClickable && onCardSelect(card)}
                disabled={!isClickable}
                className="min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background rounded-md"
              >
                <PokerCard
                  card={card}
                  variant="compact"
                  state={cardState}
                  className="w-full h-auto min-w-0 min-h-0 aspect-[5/7] rounded-md"
                />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
