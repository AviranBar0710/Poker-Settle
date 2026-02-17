import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PlayerSlot } from "./PlayerSlot"
import { BoardSlot } from "./BoardSlot"
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
          {players.map((playerCards, playerIndex) => (
            <PlayerSlot
              key={playerIndex}
              cards={playerCards}
              playerIndex={playerIndex}
              selectedSlot={selectedSlot}
              onPlayerSeatClick={onPlayerSeatClick}
              onSlotClick={onSlotClick}
            />
          ))}
        </CardContent>
      </Card>

      {/* Board */}
      <Card>
        <CardHeader>
          <CardTitle>Board</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {board.slice(0, 3).map((card, index) => (
              <BoardSlot
                key={`flop-${index}`}
                card={card}
                index={index}
                selectedSlot={selectedSlot}
                onSlotClick={onSlotClick}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {board.slice(3, 5).map((card, index) => {
              const boardIndex = index + 3
              return (
                <BoardSlot
                  key={`turn-river-${index}`}
                  card={card}
                  index={boardIndex}
                  selectedSlot={selectedSlot}
                  onSlotClick={onSlotClick}
                />
              )
            })}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
