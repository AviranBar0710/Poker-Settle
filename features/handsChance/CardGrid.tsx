"use client"

import { useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PokerCard } from "./Card"
import type { SelectedSlot } from "./types"

interface CardGridProps {
  selectedSlot: SelectedSlot
  isCardUsed: (card: string) => boolean
  onCardSelect: (card: string) => void
  isSelectorFocused?: boolean
}

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"]
const SUITS = ["h", "d", "c", "s"]

export function CardGrid({
  selectedSlot,
  isCardUsed,
  onCardSelect,
  isSelectorFocused = true,
}: CardGridProps) {
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isSelectorFocused && selectedSlot && gridRef.current) {
      gridRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [isSelectorFocused, selectedSlot])

  return (
    <div ref={gridRef}>
    <Card>
      <CardHeader>
        <CardTitle>Select Card</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {SUITS.map((suit) => (
            <div key={suit} className="flex gap-2 overflow-x-auto pb-2">
              {RANKS.map((rank) => {
                const card = rank + suit
                const used = isCardUsed(card)
                const isClickable = selectedSlot || used
                const cardState = used
                  ? "assigned"
                  : selectedSlot
                    ? "default"
                    : "disabled"

                return (
                  <button
                    key={card}
                    onClick={() => onCardSelect(card)}
                    disabled={!isClickable}
                    className="flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
                  >
                    <PokerCard
                      card={card}
                      variant="normal"
                      state={cardState}
                    />
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        {!selectedSlot && (
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Tap a slot above, then select a card. Tap a used card to remove it.
          </p>
        )}
      </CardContent>
    </Card>
    </div>
  )
}
