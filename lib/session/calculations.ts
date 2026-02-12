/**
 * Pure calculation functions for session data.
 * Extracted from app/session/[id]/page.tsx
 * 
 * These functions:
 * - Take data as input
 * - Return computed results
 * - Have NO side effects
 * - Do NOT access React state
 * - Do NOT call Supabase
 * - Do NOT mutate inputs
 */

import { Transaction } from "@/types/transaction"
import { Player } from "@/types/player"
import { BALANCE_TOLERANCE } from "./constants"

/**
 * Transfer represents a payment from a debtor to a creditor.
 */
export type Transfer = {
  debtorId: string
  debtorName: string
  creditorId: string
  creditorName: string
  amount: number
}

/**
 * PlayerResult represents a player's financial summary for a session.
 */
export type PlayerResult = {
  player: Player
  totalBuyins: number
  totalCashouts: number
  pl: number
}

/**
 * SessionTotals represents aggregate totals for a session.
 */
export type SessionTotals = {
  totalBuyins: number
  totalCashouts: number
  totalProfitLoss: number
}

/**
 * Filter transactions to get buyins for a specific player in a session.
 */
export function filterBuyinsByPlayer(
  transactions: Transaction[],
  sessionId: string,
  playerId: string
): Transaction[] {
  return transactions.filter(
    (transaction) =>
      transaction.sessionId === sessionId &&
      transaction.playerId === playerId &&
      transaction.type === "buyin"
  )
}

/**
 * Filter transactions to get cashouts for a specific player in a session.
 */
export function filterCashoutsByPlayer(
  transactions: Transaction[],
  sessionId: string,
  playerId: string
): Transaction[] {
  return transactions.filter(
    (transaction) =>
      transaction.sessionId === sessionId &&
      transaction.playerId === playerId &&
      transaction.type === "cashout"
  )
}

/**
 * Calculate results for each player in a session.
 * Returns array of player results with buyins, cashouts, and P/L.
 */
export function calculatePlayerResults(
  transactions: Transaction[],
  players: Player[],
  sessionId: string
): PlayerResult[] {
  return players.map((player) => {
    const buyins = filterBuyinsByPlayer(transactions, sessionId, player.id)
    const cashouts = filterCashoutsByPlayer(transactions, sessionId, player.id)
    const totalBuyins = buyins.reduce((sum, buyin) => sum + buyin.amount, 0)
    const totalCashouts = cashouts.reduce(
      (sum, cashout) => sum + cashout.amount,
      0
    )
    const pl = totalCashouts - totalBuyins
    return {
      player,
      totalBuyins,
      totalCashouts,
      pl,
    }
  })
}

/**
 * Calculate aggregate totals for a session.
 * Returns total buyins, cashouts, and profit/loss.
 */
export function calculateSessionTotals(
  transactions: Transaction[],
  players: Player[],
  sessionId: string
): SessionTotals {
  let totalPL = 0
  let totalB = 0
  let totalC = 0

  players.forEach((player) => {
    const buyins = filterBuyinsByPlayer(transactions, sessionId, player.id)
    const cashouts = filterCashoutsByPlayer(transactions, sessionId, player.id)
    const playerBuyins = buyins.reduce((sum, buyin) => sum + buyin.amount, 0)
    const playerCashouts = cashouts.reduce(
      (sum, cashout) => sum + cashout.amount,
      0
    )
    totalB += playerBuyins
    totalC += playerCashouts
    totalPL += playerCashouts - playerBuyins
  })

  return { totalProfitLoss: totalPL, totalBuyins: totalB, totalCashouts: totalC }
}

/**
 * Calculate settlement transfers (who pays whom).
 * Uses a greedy algorithm to minimize number of transfers.
 */
export function calculateSettlementTransfers(
  transactions: Transaction[],
  players: Player[],
  sessionId: string
): Transfer[] {
  type PlayerPL = {
    playerId: string
    playerName: string
    pl: number
  }

  const playersPL: PlayerPL[] = players.map((player) => {
    const buyins = filterBuyinsByPlayer(transactions, sessionId, player.id)
    const cashouts = filterCashoutsByPlayer(transactions, sessionId, player.id)
    const totalBuyins = buyins.reduce((sum, buyin) => sum + buyin.amount, 0)
    const totalCashouts = cashouts.reduce(
      (sum, cashout) => sum + cashout.amount,
      0
    )
    const pl = totalCashouts - totalBuyins
    return {
      playerId: player.id,
      playerName: player.name,
      pl: pl,
    }
  })

  const creditors = playersPL
    .filter((p) => p.pl > BALANCE_TOLERANCE)
    .map((p) => ({ ...p, amount: p.pl }))
    .sort((a, b) => b.amount - a.amount)

  const debtors = playersPL
    .filter((p) => p.pl < -BALANCE_TOLERANCE)
    .map((p) => ({ ...p, amount: -p.pl }))
    .sort((a, b) => b.amount - a.amount)

  const transfers: Transfer[] = []
  let i = 0
  let j = 0

  while (j < creditors.length && i < debtors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount)
    transfers.push({
      debtorId: debtors[i].playerId,
      debtorName: debtors[i].playerName,
      creditorId: creditors[j].playerId,
      creditorName: creditors[j].playerName,
      amount: pay,
    })
    debtors[i].amount -= pay
    creditors[j].amount -= pay
    if (creditors[j].amount <= BALANCE_TOLERANCE) {
      j++
    }
    if (debtors[i].amount <= BALANCE_TOLERANCE) {
      i++
    }
  }

  return transfers
}

/**
 * Filter player results to get winners (positive P/L).
 * Sorted by P/L descending (biggest winner first).
 */
export function filterWinners(playerResults: PlayerResult[]): PlayerResult[] {
  return playerResults
    .filter((r) => r.pl > BALANCE_TOLERANCE)
    .sort((a, b) => b.pl - a.pl)
}

/**
 * Filter player results to get losers (negative P/L).
 * Sorted by P/L ascending (biggest loser first).
 */
export function filterLosers(playerResults: PlayerResult[]): PlayerResult[] {
  return playerResults
    .filter((r) => r.pl < -BALANCE_TOLERANCE)
    .sort((a, b) => a.pl - b.pl)
}

/**
 * Filter player results to get break-even players (P/L within tolerance).
 */
export function filterBreakEven(playerResults: PlayerResult[]): PlayerResult[] {
  return playerResults.filter(
    (r) => r.pl >= -BALANCE_TOLERANCE && r.pl <= BALANCE_TOLERANCE
  )
}

/**
 * Sum total winnings from winners array.
 */
export function sumWinnings(winners: PlayerResult[]): number {
  return winners.reduce((sum, w) => sum + w.pl, 0)
}

/**
 * Sum total losses from losers array (returned as positive number).
 */
export function sumLosses(losers: PlayerResult[]): number {
  return Math.abs(losers.reduce((sum, l) => sum + l.pl, 0))
}
