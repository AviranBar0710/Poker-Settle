import { TexasHoldem } from "poker-odds-calc"
import { toLibraryFormat } from "./utils"
import type { PlayerResult } from "./types"

export function calculateOdds(
  players: string[][],
  board: string[]
): { results: PlayerResult[]; error: string | null } {
  try {
    // Filter players with at least 2 cards
    const playersWithCards = players.filter(
      (p) => p[0] && p[1] && p[0].length >= 2 && p[1].length >= 2
    )

    if (playersWithCards.length < 2) {
      return {
        results: [],
        error: "Need at least 2 players with 2 cards each",
      }
    }

    // Create table
    const table = new TexasHoldem()

    // Add players
    playersWithCards.forEach((playerCards) => {
      const card1Raw = playerCards[0].length === 2 ? playerCards[0] : playerCards[0].slice(0, 2)
      const card2Raw = playerCards[1].length === 2 ? playerCards[1] : playerCards[1].slice(0, 2)
      const card1 = toLibraryFormat(card1Raw)
      const card2 = toLibraryFormat(card2Raw)
      table.addPlayer([card1, card2])
    })

    // Set board (filter empty cards)
    const boardCards = board.filter((card) => card && card.length >= 2).map((card) => toLibraryFormat(card.slice(0, 2)))
    if (boardCards.length > 0) {
      table.setBoard(boardCards)
    }

    // Calculate
    const result = table.calculate()
    const playersResult = result.getPlayers()

    // Map results back to original player indices
    const mappedResults: PlayerResult[] = []
    let resultIndex = 0
    for (let i = 0; i < players.length; i++) {
      if (players[i][0] && players[i][1] && players[i][0].length >= 2 && players[i][1].length >= 2) {
        const playerResult = playersResult[resultIndex]
        // Library returns percentages (0-100), not decimals (0-1)
        const win = playerResult.getWinsPercentage() || 0
        const tie = playerResult.getTiesPercentage() || 0
        // Equity = Win% + (Tie% / 2) - ties count as half wins
        const equity = win + (tie / 2)
        mappedResults.push({
          playerIndex: i,
          win: win, // Already a percentage (0-100)
          tie: tie, // Already a percentage (0-100)
          equity: equity, // Already a percentage (0-100)
        })
        resultIndex++
      }
    }

    return { results: mappedResults, error: null }
  } catch {
    return {
      results: [],
      error: null,
    }
  }
}

export function canCalculate(players: string[][]): boolean {
  const playersWithCards = players.filter(
    (p) => p[0] && p[1] && p[0].length >= 2 && p[1].length >= 2
  )
  return playersWithCards.length >= 2
}
