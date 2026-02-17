"use client"

import { Button } from "@/components/ui/button"
import { PlayerSeat } from "./PlayerSeat"
import { CardSlot } from "./CardSlot"
import type { SelectedSlot, PlayerResult } from "./types"

interface PokerTableLayoutProps {
  players: string[][]
  board: string[]
  selectedSlot: SelectedSlot | null
  results: PlayerResult[]
  onPlayerSeatClick: (playerIndex: number) => void
  onSlotClick: (slot: SelectedSlot) => void
  onReset?: () => void
}

export function PokerTableLayout({
  players,
  board,
  selectedSlot,
  results,
  onPlayerSeatClick,
  onSlotClick,
  onReset,
}: PokerTableLayoutProps) {
  const getResultForPlayer = (playerIndex: number) =>
    results.find((r) => r.playerIndex === playerIndex)

  return (
    <div className="w-full max-w-md mx-auto min-h-[520px] max-h-full">
      {/* Table surface */}
      <div
        className="relative rounded-[44px] overflow-hidden min-h-[520px] w-full"
        style={{
          background:
            "radial-gradient(ellipse 110% 80% at 50% 50%, #1a7d3e 0%, #0d5c2e 35%, #0a4d2e 60%, #062d1a 100%)",
          boxShadow:
            "inset 0 0 80px rgba(0,0,0,0.35), 0 0 50px rgba(10,77,46,0.5), 0 10px 40px rgba(0,0,0,0.4)",
        }}
      >
        {/* Inner border (casino rail) */}
        <div
          className="absolute inset-4 rounded-[36px] border-[3px] border-amber-900/35 pointer-events-none"
          style={{ boxShadow: "inset 0 0 24px rgba(0,0,0,0.2)" }}
        />

        {/* Reset button */}
        {onReset && (
          <div className="absolute top-4 right-4 z-20">
            <Button
              variant="secondary"
              size="sm"
              onClick={onReset}
              className="h-8 px-3 text-xs bg-white/10 hover:bg-white/20 text-white/70 hover:text-white border-0 rounded-lg"
            >
              Reset
            </Button>
          </div>
        )}

        {/* Player 1 - top center */}
        <div
          className="absolute left-1/2 z-10"
          style={{ top: "14%", transform: "translate(-50%, -50%)" }}
        >
          <PlayerSeat
            playerIndex={0}
            cards={players[0] ?? ["", ""]}
            selectedSlot={selectedSlot}
            result={getResultForPlayer(0)}
            onPlayerSeatClick={onPlayerSeatClick}
            onSlotClick={onSlotClick}
          />
        </div>

        {/* Player 2 - top right */}
        <div
          className="absolute z-10"
          style={{ left: "82%", top: "24%", transform: "translate(-50%, -50%)" }}
        >
          <PlayerSeat
            playerIndex={1}
            cards={players[1] ?? ["", ""]}
            selectedSlot={selectedSlot}
            result={getResultForPlayer(1)}
            onPlayerSeatClick={onPlayerSeatClick}
            onSlotClick={onSlotClick}
          />
        </div>

        {/* Player 3 - top left */}
        <div
          className="absolute z-10"
          style={{ left: "18%", top: "24%", transform: "translate(-50%, -50%)" }}
        >
          <PlayerSeat
            playerIndex={2}
            cards={players[2] ?? ["", ""]}
            selectedSlot={selectedSlot}
            result={getResultForPlayer(2)}
            onPlayerSeatClick={onPlayerSeatClick}
            onSlotClick={onSlotClick}
          />
        </div>

        {/* Board - center */}
        <div
          className="absolute left-1/2 top-1/2 flex flex-col items-center gap-2 z-10"
          style={{ transform: "translate(-50%, -50%)" }}
        >
          {/* Flop (3 cards) */}
          <div className="flex gap-2 justify-center">
            {board.slice(0, 3).map((card, index) => (
              <CardSlot
                key={index}
                card={card}
                slot={{ type: "board", index }}
                selectedSlot={selectedSlot}
                onSlotClick={onSlotClick}
                variant="normal"
              />
            ))}
          </div>
          {/* Turn + River (2 cards) */}
          <div className="flex gap-2 justify-center">
            {board.slice(3, 5).map((card, index) => (
              <CardSlot
                key={index + 3}
                card={card}
                slot={{ type: "board", index: index + 3 }}
                selectedSlot={selectedSlot}
                onSlotClick={onSlotClick}
                variant="normal"
              />
            ))}
          </div>
        </div>

        {/* Player 4 - mid left */}
        <div
          className="absolute z-10"
          style={{ left: "18%", top: "58%", transform: "translate(-50%, -50%)" }}
        >
          <PlayerSeat
            playerIndex={3}
            cards={players[3] ?? ["", ""]}
            selectedSlot={selectedSlot}
            result={getResultForPlayer(3)}
            onPlayerSeatClick={onPlayerSeatClick}
            onSlotClick={onSlotClick}
          />
        </div>

        {/* Player 5 - mid right */}
        <div
          className="absolute z-10"
          style={{ left: "82%", top: "58%", transform: "translate(-50%, -50%)" }}
        >
          <PlayerSeat
            playerIndex={4}
            cards={players[4] ?? ["", ""]}
            selectedSlot={selectedSlot}
            result={getResultForPlayer(4)}
            onPlayerSeatClick={onPlayerSeatClick}
            onSlotClick={onSlotClick}
          />
        </div>

        {/* Player 6 - bottom center */}
        <div
          className="absolute left-1/2 z-10"
          style={{ top: "82%", transform: "translate(-50%, -50%)" }}
        >
          <PlayerSeat
            playerIndex={5}
            cards={players[5] ?? ["", ""]}
            selectedSlot={selectedSlot}
            result={getResultForPlayer(5)}
            onPlayerSeatClick={onPlayerSeatClick}
            onSlotClick={onSlotClick}
          />
        </div>
      </div>
    </div>
  )
}
