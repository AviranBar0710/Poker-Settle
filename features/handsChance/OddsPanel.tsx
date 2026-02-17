import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PokerCard } from "./Card"
import type { PlayerResult, SelectedSlot } from "./types"

interface OddsPanelProps {
  results: PlayerResult[]
  selectedSlot: SelectedSlot
  players: string[][]
}

export function OddsPanel({ results, selectedSlot, players }: OddsPanelProps) {
  if (results.length === 0) {
    return null
  }

  return (
    <Card className="animate-[fadeIn_0.5s_ease-in-out]">
      <CardHeader>
        <CardTitle>Results</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {results.map((result, index) => {
          const isHighlighted =
            selectedSlot?.type === "player" && selectedSlot.playerIndex === result.playerIndex
          
          return (
            <div
              key={result.playerIndex}
              className={`p-4 rounded-lg border transition-all animate-[slideInLeft_0.5s_ease-in-out] ${
                isHighlighted
                  ? "bg-primary/20 border-primary/50 ring-2 ring-primary/30"
                  : "bg-muted/50 border"
              }`}
              style={{
                animationDelay: `${index * 100}ms`,
                animationFillMode: "both",
              }}
            >
              <div className="font-semibold mb-2 flex items-center gap-2">
                Player {result.playerIndex + 1}
                <div className="flex gap-1">
                  {players[result.playerIndex]?.map(
                    (card, i) =>
                      card &&
                      card.length >= 2 && (
                        <PokerCard
                          key={`${result.playerIndex}-${i}`}
                          card={card}
                          variant="small"
                          state="locked"
                        />
                      )
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Win</div>
                  <div className="font-semibold">{result.win.toFixed(2)}%</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Tie</div>
                  <div className="font-semibold">{result.tie.toFixed(2)}%</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Equity</div>
                  <div className="font-semibold">{result.equity.toFixed(2)}%</div>
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
