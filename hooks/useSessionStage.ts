"use client"

import { useState, useCallback, useMemo } from "react"
import { Session } from "@/types/session"
import { Player } from "@/types/player"
import { Transaction } from "@/types/transaction"
import { supabase } from "@/lib/supabaseClient"
import {
  SessionStage,
  deriveSessionStage,
  getPlayersMissingBuyins,
  getChipEntryGate,
} from "@/lib/session/stage"

/**
 * Hook: useSessionStage
 * 
 * Provides session stage awareness and stage transition actions.
 * 
 * Contract compliance (docs/session_experience_contract.md):
 * - Explicit stage (not inferred from UI state)
 * - Hard gate: chip entry blocked until all players have buy-ins
 * - Clear reason when blocked
 */

interface UseSessionStageParams {
  sessionId: string
  session: Session | null
  players: Player[]
  transactions: Transaction[]
  setError: (error: string | null) => void
  reloadSession: () => void
}

interface UseSessionStageReturn {
  /** Current session stage */
  stage: SessionStage
  /** Player IDs that are missing buy-ins */
  missingBuyinsPlayerIds: string[]
  /** Can "Start chip entry" be clicked? */
  canStartChipEntry: boolean
  /** Reason chip entry is blocked (null if allowed) */
  startChipEntryBlockedReason: string | null
  /** Action: Start chip entry (Stage 2 → Stage 3 transition) */
  startChipEntry: () => Promise<boolean>
  /** Is startChipEntry in progress? */
  isStartingChipEntry: boolean
}

export function useSessionStage({
  sessionId,
  session,
  players,
  transactions,
  setError,
  reloadSession,
}: UseSessionStageParams): UseSessionStageReturn {
  const [isStartingChipEntry, setIsStartingChipEntry] = useState(false)

  // Derive current stage
  const stage = useMemo(
    () => deriveSessionStage(session, players, transactions),
    [session, players, transactions]
  )

  // Get players missing buy-ins
  const missingBuyinsPlayerIds = useMemo(
    () => getPlayersMissingBuyins(sessionId, players, transactions),
    [sessionId, players, transactions]
  )

  // Check chip entry gate
  const chipEntryGate = useMemo(
    () => getChipEntryGate(sessionId, session, players, transactions),
    [sessionId, session, players, transactions]
  )

  const canStartChipEntry = chipEntryGate.canStart
  const startChipEntryBlockedReason = chipEntryGate.reason

  // Action: Start chip entry
  const startChipEntry = useCallback(async (): Promise<boolean> => {
    if (!session) {
      setError("Session not loaded")
      return false
    }

    if (!canStartChipEntry) {
      setError(startChipEntryBlockedReason ?? "Cannot start chip entry")
      return false
    }

    setIsStartingChipEntry(true)
    setError(null)

    try {
      const { error } = await supabase
        .from("sessions")
        .update({ chip_entry_started_at: new Date().toISOString() })
        .eq("id", sessionId)

      if (error) {
        console.error("Error starting chip entry:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        })
        setError(`Failed to start chip entry: ${error.message || "Unknown error"}`)
        setIsStartingChipEntry(false)
        return false
      }

      // Reload session to get updated chip_entry_started_at
      reloadSession()
      setIsStartingChipEntry(false)
      return true
    } catch (err) {
      console.error("Unexpected error starting chip entry:", err)
      setError("Failed to start chip entry. Please try again.")
      setIsStartingChipEntry(false)
      return false
    }
  }, [
    session,
    sessionId,
    canStartChipEntry,
    startChipEntryBlockedReason,
    setError,
    reloadSession,
  ])

  return {
    stage,
    missingBuyinsPlayerIds,
    canStartChipEntry,
    startChipEntryBlockedReason,
    startChipEntry,
    isStartingChipEntry,
  }
}
