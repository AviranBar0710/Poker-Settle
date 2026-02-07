import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Plus } from "lucide-react"
import type { SelectedSlot } from "./types"

interface PokerTableProps {
  players: string[][]
  board: string[]
  selectedSlot: SelectedSlot
  onPlayerSeatClick: (playerIndex: number) => void
  onSlotClick: (slot: SelectedSlot) => void
}

export function PokerTable({
  players,
  board,
  selectedSlot,
  onPlayerSeatClick,
  onSlotClick,
}: PokerTableProps) {
  return (
    <>
      {/* Players */}
      <Card>
        <CardHeader>
          <CardTitle>Players</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {players.map((playerCards, playerIndex) => {
            const isPlayerSelected =
              selectedSlot?.type === "player" && selectedSlot.playerIndex === playerIndex
            
            return (
              <div key={playerIndex} className="space-y-2">
                <button
                  onClick={() => onPlayerSeatClick(playerIndex)}
                  className="text-left w-full"
                >
                  <Label className={`cursor-pointer ${isPlayerSelected ? "text-green-500 font-semibold" : ""}`}>
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
                    const card = playerCards[cardIndex]
                    const isEmpty = !card || card.length < 2

                    return (
                      <button
                        key={cardIndex}
                        onClick={() => onSlotClick(slot)}
                        className={`flex-1 h-14 rounded-lg border-2 transition-all ${
                          isSelected
                            ? "border-green-500 border-dashed bg-green-500/10"
                            : isEmpty
                              ? "border-dashed border-muted-foreground/30 bg-muted/20 hover:bg-muted/30"
                              : "border-border bg-card hover:bg-muted/50"
                        } flex items-center justify-center min-w-[48px]`}
                      >
                        {isEmpty ? (
                          <Plus className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <span className="font-mono font-semibold text-sm">{card}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Board */}
      <Card>
        <CardHeader>
          <CardTitle>Board</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {board.slice(0, 3).map((card, index) => {
              const slot: SelectedSlot = { type: "board", index }
              const isSelected = selectedSlot?.type === "board" && selectedSlot.index === index
              const isEmpty = !card || card.length < 2

              return (
                <button
                  key={`flop-${index}`}
                  onClick={() => onSlotClick(slot)}
                  className={`h-14 rounded-lg border-2 transition-all ${
                    isSelected
                      ? "border-green-500 border-dashed bg-green-500/10"
                      : isEmpty
                        ? "border-dashed border-muted-foreground/30 bg-muted/20 hover:bg-muted/30"
                        : "border-border bg-card hover:bg-muted/50"
                  } flex items-center justify-center min-w-[48px]`}
                >
                  {isEmpty ? (
                    <Plus className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <span className="font-mono font-semibold text-sm">{card}</span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {board.slice(3, 5).map((card, index) => {
              const boardIndex = index + 3
              const slot: SelectedSlot = { type: "board", index: boardIndex }
              const isSelected = selectedSlot?.type === "board" && selectedSlot.index === boardIndex
              const isEmpty = !card || card.length < 2

              return (
                <button
                  key={`turn-river-${index}`}
                  onClick={() => onSlotClick(slot)}
                  className={`h-14 rounded-lg border-2 transition-all ${
                    isSelected
                      ? "border-green-500 border-dashed bg-green-500/10"
                      : isEmpty
                        ? "border-dashed border-muted-foreground/30 bg-muted/20 hover:bg-muted/30"
                        : "border-border bg-card hover:bg-muted/50"
                  } flex items-center justify-center min-w-[48px]`}
                >
                  {isEmpty ? (
                    <Plus className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <span className="font-mono font-semibold text-sm">{card}</span>
                  )}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
