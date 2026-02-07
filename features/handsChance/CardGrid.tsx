import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { normalizeCard } from "./utils"
import type { SelectedSlot } from "./types"

interface CardGridProps {
  selectedSlot: SelectedSlot
  isCardUsed: (card: string) => boolean
  onCardSelect: (card: string) => void
}

const ranks = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"]
const suits = ["h", "d", "c", "s"]

export function CardGrid({ selectedSlot, isCardUsed, onCardSelect }: CardGridProps) {
  const suitLabels: Record<string, string> = {
    h: "♥",
    d: "♦",
    c: "♣",
    s: "♠",
  }
  const suitColors: Record<string, string> = {
    h: "text-red-600",
    d: "text-red-600",
    c: "text-black dark:text-white",
    s: "text-black dark:text-white",
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Card</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {suits.map((suit) => (
            <div key={suit} className="flex gap-2 overflow-x-auto pb-2">
              {ranks.map((rank) => {
                const card = rank + suit
                const used = isCardUsed(card)

                return (
                  <button
                    key={card}
                    onClick={() => onCardSelect(card)}
                    disabled={!selectedSlot && !used}
                    className={`min-w-[48px] h-14 rounded-lg border-2 transition-all flex-shrink-0 ${
                      used
                        ? selectedSlot
                          ? "opacity-60 border-primary bg-primary/10 hover:bg-primary/20 cursor-pointer"
                          : "opacity-40 border-muted-foreground/20 bg-muted/10 hover:bg-muted/20 cursor-pointer"
                        : selectedSlot
                          ? "border-primary bg-primary/10 hover:bg-primary/20 cursor-pointer"
                          : "border-muted-foreground/30 bg-muted/20 opacity-50 cursor-not-allowed"
                    } flex flex-col items-center justify-center`}
                  >
                    <span className={`font-mono font-bold text-xs ${suitColors[suit]}`}>
                      {rank}
                    </span>
                    <span className={`text-lg ${suitColors[suit]}`}>{suitLabels[suit]}</span>
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
  )
}
