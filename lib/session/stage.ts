/**
 * Session Stage Engine
 * 
 * Implements the canonical session stages per docs/session_experience_contract.md
 * 
 * Stage flow:
 * 1. player_setup → at least one player exists
 * 2. buyins → every player has ≥1 buy-in (HARD GATE)
 * 3. chip_entry → "Start chip entry" clicked
 * 4. review → (future: explicit review step before finalization)
 * 5. finalized → session.finalized_at set
 */

import { Session } from "@/types/session"
import { Player } from "@/types/player"
import { Transaction } from "@/types/transaction"

export type SessionStage =
  | "player_setup"
  | "buyins"
  | "chip_entry"
  | "review"
  | "finalized"

/**
 * Derive the current session stage from session state.
 * 
 * Rules (in order):
 * 1. If finalized_at set → finalized
 * 2. If chip_entry_started_at set → chip_entry
 * 3. If no players → player_setup
 * 4. Else → buyins (waiting for all players to have buy-ins)
 */
export function deriveSessionStage(
  session: Session | null,
  players: Player[],
  transactions: Transaction[]
): SessionStage {
  if (!session) return "player_setup"

  // Stage 5: Finalized
  if (session.finalizedAt) return "finalized"

  // Stage 3: Chip Entry (started)
  // @ts-expect-error - chip_entry_started_at will be added in migration
  if (session.chip_entry_started_at) return "chip_entry"

  // Stage 1: Player Setup (no players yet)
  if (players.length === 0) return "player_setup"

  // Stage 2: Buy-ins (default - waiting for all players to have buy-ins)
  return "buyins"
}

/**
 * Get players who are missing buy-ins.
 * 
 * A player is missing buy-ins if they have zero buy-in transactions
 * in this session.
 */
export function getPlayersMissingBuyins(
  sessionId: string,
  players: Player[],
  transactions: Transaction[]
): string[] {
  return players
    .filter((player) => {
      const buyins = transactions.filter(
        (t) =>
          t.sessionId === sessionId &&
          t.playerId === player.id &&
          t.type === "buyin"
      )
      return buyins.length === 0
    })
    .map((p) => p.id)
}

/**
 * Check if "Start chip entry" is allowed.
 * 
 * Hard gate per contract:
 * - Every remaining player must have ≥1 buy-in
 * 
 * Returns { canStart: true } or { canStart: false, reason: string }
 */
export function getChipEntryGate(
  sessionId: string,
  session: Session | null,
  players: Player[],
  transactions: Transaction[]
): { canStart: boolean; reason: string | null } {
  if (!session) {
    return { canStart: false, reason: "Session not loaded" }
  }

  // Already started
  // @ts-expect-error - chip_entry_started_at will be added in migration
  if (session.chip_entry_started_at) {
    return { canStart: false, reason: "Chip entry already started" }
  }

  // No players
  if (players.length === 0) {
    return { canStart: false, reason: "Add at least one player first" }
  }

  // Check for players without buy-ins
  const missingBuyins = getPlayersMissingBuyins(sessionId, players, transactions)
  if (missingBuyins.length > 0) {
    const count = missingBuyins.length
    return {
      canStart: false,
      reason: `${count} player${count > 1 ? "s" : ""} missing buy-ins`,
    }
  }

  return { canStart: true, reason: null }
}
