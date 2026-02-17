"use client"

import { PokerCard } from "./Card"
import type { SelectedSlot } from "./types"

interface CardPickerDockProps {
  selectedSlot: SelectedSlot | null
  isCardUsed: (card: string) => boolean
  onCardSelect: (card: string) => void
}

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"]
const SUITS = ["h", "d", "c", "s"]

export function CardPickerDock({
  selectedSlot,
  isCardUsed,
  onCardSelect,
}: CardPickerDockProps) {
  return (
    <div
      className="flex-shrink-0 h-[200px] min-h-[180px] max-h-[220px] bg-[#0a4d2e]/95 backdrop-blur-sm border-t border-amber-900/40 shadow-[0_-4px_24px_rgba(0,0,0,0.3)]"
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      <div className="overflow-x-auto overflow-y-auto h-full py-2.5 px-3">
        <div className="flex flex-col gap-1.5 min-w-max">
          {SUITS.map((suit) => (
            <div key={suit} className="flex gap-1">
              {RANKS.map((rank) => {
                const card = rank + suit
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
                    className="flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0a4d2e] rounded-md"
                  >
                    <PokerCard
                      card={card}
                      variant="compact"
                      state={cardState}
                    />
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
