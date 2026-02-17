"use client"

import type { PlayerResult } from "./types"

interface OddsDisplayProps {
  playerIndex: number
  result: PlayerResult | undefined
}

export function OddsDisplay({ result }: OddsDisplayProps) {
  const formatPct = (value: number) => value.toFixed(2)

  return (
    <div className="min-h-[40px] flex flex-col items-center justify-center mt-1">
      {result ? (
        <>
          <span className="text-lg font-bold text-white leading-tight">
            {formatPct(result.win)}% Win
          </span>
          <span className="text-xs text-white/70 leading-tight">
            {formatPct(result.tie)}% Tie
          </span>
        </>
      ) : null}
    </div>
  )
}
