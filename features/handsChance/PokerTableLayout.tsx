"use client"

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
}

export function PokerTableLayout({
  players,
  board,
  selectedSlot,
  results,
  onPlayerSeatClick,
  onSlotClick,
}: PokerTableLayoutProps) {
  const getResultForPlayer = (playerIndex: number) =>
    results.find((r) => r.playerIndex === playerIndex)

  return (
    <div className="w-full max-w-md mx-auto min-h-[520px] max-h-full">
      {/* Table area — dark, no felt: subtle oval rail + spade ornament (reference) */}
      <div className="relative min-h-[520px] w-full">
        {/* Oval rail */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[88%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-[6px] border-foreground/[0.05]"
        />
        {/* Spade ornament behind the board */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none text-[200px] leading-none text-primary/[0.07]"
        >
          ♠
        </span>

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
