"use client"

import { useState, useMemo, useCallback } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Player } from "@/types/player"
import { Session } from "@/types/session"

// UUID v4 generator for player IDs
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

interface UseSessionPlayersParams {
  sessionId: string
  session: Session | null
  user: { id: string } | null
  fixedBuyinAmount: number | null
  setFixedBuyinAmount: (amount: number | null) => void
  setShowFixedBuyinDialog: (show: boolean) => void
  setError: (error: string | null) => void
  reloadTransactions: () => Promise<void>
  /** Called when batch add completes (e.g. to close Add Player sheet and show success) */
  onBatchAddComplete?: (count: number) => void
}

interface UseSessionPlayersReturn {
  // State
  players: Player[]
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>
  playerName: string
  setPlayerName: (name: string) => void
  selectedProfileId: string | null
  setSelectedProfileId: (id: string | null) => void
  isAddingPlayer: boolean
  pendingPlayerId: string | null
  setPendingPlayerId: (id: string | null) => void
  showLinkIdentityDialog: boolean
  setShowLinkIdentityDialog: (show: boolean) => void
  editingPlayerId: string | "new" | null
  setEditingPlayerId: (id: string | "new" | null) => void
  
  // Handlers
  reloadPlayers: () => Promise<void>
  handleAddPlayer: (e: React.FormEvent<HTMLFormElement>) => Promise<void>
  handleAddMultiplePlayers: (entries: Array<{ name: string; profileId: string | null }>) => Promise<void>
  addPlayerWithBuyin: (name: string, buyinAmount?: number | null, profileId?: string | null) => Promise<void>
  addMultiplePlayersWithBuyin: (entries: Array<{ name: string; profileId: string | null }>, buyinAmount: number | null) => Promise<void>
  handleLinkIdentity: (playerId: string) => void
  confirmLinkIdentity: () => Promise<void>
  handleFixedBuyinConfirm: (amount: number) => void
  handleFixedBuyinSkip: () => void
  
  // Computed
  userAlreadyLinkedToAnyPlayer: boolean
}

export function useSessionPlayers({
  sessionId,
  session,
  user,
  fixedBuyinAmount,
  setFixedBuyinAmount,
  setShowFixedBuyinDialog,
  setError,
  reloadTransactions,
  onBatchAddComplete,
}: UseSessionPlayersParams): UseSessionPlayersReturn {
  // Player state
  const [players, setPlayers] = useState<Player[]>([])
  const [playerName, setPlayerName] = useState("")
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [isAddingPlayer, setIsAddingPlayer] = useState(false)
  const [pendingPlayerName, setPendingPlayerName] = useState("")
  const [pendingProfileId, setPendingProfileId] = useState<string | null>(null)
  const [pendingPlayers, setPendingPlayers] = useState<Array<{ name: string; profileId: string | null }>>([])
  const [pendingPlayerId, setPendingPlayerId] = useState<string | null>(null)
  const [showLinkIdentityDialog, setShowLinkIdentityDialog] = useState(false)
  const [editingPlayerId, setEditingPlayerId] = useState<string | "new" | null>(null)

  // Reload players from Supabase
  const reloadPlayers = useCallback(async () => {
    console.log("🔵 [DEBUG] Reloading players from Supabase for session:", sessionId)
    
    try {
      const { data: playersData, error: playersError } = await supabase
        .from("players")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })

      if (playersError) {
        console.error("🔴 [DEBUG] Reload players ERROR:", playersError)
        return
      }

      if (playersData) {
        const players: Player[] = playersData.map((p) => ({
          id: p.id,
          sessionId: p.session_id,
          name: p.name,
          createdAt: p.created_at,
          profileId: p.profile_id || null,
        }))
        setPlayers(players)
      }
    } catch (err) {
      console.error("🔴 [DEBUG] Unexpected error reloading players:", err)
    }
  }, [sessionId])

  // Add player with optional buy-in and optional profile link
  const addPlayerWithBuyin = useCallback(async (name: string, buyinAmount?: number | null, profileId?: string | null) => {
    setIsAddingPlayer(true)

    // DEBUG: Generate UUID v4 for player ID
    const playerId = generateUUID()

    // Use the passed buyinAmount, or fall back to fixedBuyinAmount state
    // If buyinAmount is explicitly null, use null; if undefined, use fixedBuyinAmount
    const amountToUse = buyinAmount !== undefined 
      ? buyinAmount 
      : (fixedBuyinAmount !== null ? fixedBuyinAmount : null)

    // DEBUG: Log values before insert
    console.log("🔵 [DEBUG] Adding player with buy-in:", {
      name,
      buyinAmount,
      fixedBuyinAmount,
      amountToUse,
      buyinAmountUndefined: buyinAmount === undefined,
      buyinAmountNull: buyinAmount === null
    })
    console.log("🔵 [DEBUG] Player values prepared:", {
      id: playerId,
      session_id: sessionId,
      name: name,
      buyinAmount: amountToUse,
      isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(playerId)
    })

    try {
      // DEBUG: Supabase insert with full logging
      console.log("🔵 [DEBUG] Attempting Supabase player insert...")
      
      // Get club_id from session (required for multi-tenant)
      const sessionClubId = session?.clubId
      if (!sessionClubId) {
        console.error("🔴 [DEBUG] Session has no clubId, cannot add player")
        setError("Session error: missing club information")
        setIsAddingPlayer(false)
        return
      }
      
      const insertPayload: Record<string, unknown> = {
        id: playerId,
        session_id: sessionId,
        club_id: sessionClubId,
        name: name,
      }
      if (profileId) {
        insertPayload.profile_id = profileId
      }

      const { data, error } = await supabase
        .from("players")
        .insert(insertPayload)
        .select()

      // DEBUG: Log both data and error
      console.log("🔵 [DEBUG] Supabase player insert response:", {
        data: data,
        error: error,
        hasData: !!data,
        hasError: !!error
      })

      if (error) {
        console.error("🔴 [DEBUG] Supabase player insert ERROR:", error)
        console.error("🔴 [DEBUG] Error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        setIsAddingPlayer(false)
        return
      }

      if (data && data.length > 0) {
        console.log("✅ [DEBUG] Supabase player insert SUCCESS:", data[0])
      } else {
        console.warn("⚠️ [DEBUG] Supabase player insert returned no data")
      }

      // If buy-in amount is provided, automatically create buy-in transaction
      if (amountToUse !== null && amountToUse !== undefined && amountToUse > 0) {
        const transactionId = generateUUID()
        // Get club_id from session (required for multi-tenant)
        const sessionClubId = session?.clubId
        if (!sessionClubId) {
          console.error("🔴 [DEBUG] Session has no clubId, cannot add transaction")
          return
        }

        const { data: transactionData, error: transactionError } = await supabase
          .from("transactions")
          .insert({
            id: transactionId,
            session_id: sessionId,
            club_id: sessionClubId,
            player_id: playerId,
            type: "buyin",
            amount: amountToUse
          })
          .select()

        if (transactionError) {
          console.error("🔴 [DEBUG] Error adding fixed buy-in:", transactionError)
          // Player was created, but buy-in failed - user can add manually
        } else {
          console.log("✅ [DEBUG] Fixed buy-in added successfully:", amountToUse, transactionData)
        }
      }

      console.log("🔵 [DEBUG] Supabase Add Player attempt finished")

      setPlayerName("")
      setSelectedProfileId(null)
      await reloadTransactions()
      await reloadPlayers()
    } catch (err) {
      console.error("🔴 [DEBUG] Unexpected error during Supabase player insert:", err)
    } finally {
      setIsAddingPlayer(false)
    }
  }, [sessionId, session, fixedBuyinAmount, setError, reloadTransactions, reloadPlayers])

  // Bulk add multiple players with optional buy-in (single Supabase insert per table)
  const addMultiplePlayersWithBuyin = useCallback(async (
    entries: Array<{ name: string; profileId: string | null }>,
    buyinAmount: number | null
  ) => {
    if (entries.length === 0) return

    setIsAddingPlayer(true)

    const sessionClubId = session?.clubId
    if (!sessionClubId) {
      setError("Session error: missing club information")
      setIsAddingPlayer(false)
      return
    }

    try {
      const playerRows = entries.map(({ name, profileId }) => {
        const playerId = generateUUID()
        const row: Record<string, unknown> = {
          id: playerId,
          session_id: sessionId,
          club_id: sessionClubId,
          name,
        }
        if (profileId) row.profile_id = profileId
        return { row, playerId }
      })

      const playersPayload = playerRows.map(({ row }) => row)
      const { error: playersError } = await supabase
        .from("players")
        .insert(playersPayload)

      if (playersError) {
        console.error("Bulk player insert error:", playersError)
        setError(playersError.message)
        setIsAddingPlayer(false)
        return
      }

      if (buyinAmount !== null && buyinAmount > 0) {
        const transactionsPayload = playerRows.map(({ row }) => ({
          id: generateUUID(),
          session_id: sessionId,
          club_id: sessionClubId,
          player_id: row.id,
          type: "buyin" as const,
          amount: buyinAmount,
        }))

        const { error: txError } = await supabase
          .from("transactions")
          .insert(transactionsPayload)

        if (txError) {
          console.error("Bulk transaction insert error:", txError)
          setError(txError.message)
        }
      }

      setPlayerName("")
      setSelectedProfileId(null)
      await reloadTransactions()
      await reloadPlayers()
    } catch (err) {
      console.error("Unexpected error during bulk player insert:", err)
      setError("Failed to add players. Please try again.")
    } finally {
      setIsAddingPlayer(false)
    }
  }, [sessionId, session, setError, reloadTransactions, reloadPlayers])

  // Handle add player form submission
  const handleAddPlayer = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    console.log("🔵 [DEBUG] Add Player handler executed")
    
    if (!playerName.trim()) {
      console.log("🔴 [DEBUG] Validation failed: empty player name")
      return
    }

    // If this is the first player and fixed buy-in hasn't been set, show dialog
    if (players.length === 0 && fixedBuyinAmount === null) {
      setPendingPlayerName(playerName.trim())
      setPendingProfileId(selectedProfileId)
      setShowFixedBuyinDialog(true)
      return
    }

    await addPlayerWithBuyin(playerName.trim(), fixedBuyinAmount ?? undefined, selectedProfileId)
    setSelectedProfileId(null)
  }, [playerName, selectedProfileId, players.length, fixedBuyinAmount, setShowFixedBuyinDialog, addPlayerWithBuyin])

  // Handle batch add (multi-select flow)
  const handleAddMultiplePlayers = useCallback(async (entries: Array<{ name: string; profileId: string | null }>) => {
    if (entries.length === 0) return

    if (players.length === 0 && fixedBuyinAmount === null) {
      setPendingPlayers(entries)
      setShowFixedBuyinDialog(true)
      return
    }

    await addMultiplePlayersWithBuyin(entries, fixedBuyinAmount)
    onBatchAddComplete?.(entries.length)
  }, [players.length, fixedBuyinAmount, setShowFixedBuyinDialog, addMultiplePlayersWithBuyin, onBatchAddComplete])

  // Handle fixed buy-in dialog confirmation
  const handleFixedBuyinConfirm = useCallback(async (amount: number) => {
    setFixedBuyinAmount(amount)
    setShowFixedBuyinDialog(false)
    const count = pendingPlayers.length
    if (count > 0) {
      const entries = [...pendingPlayers]
      setPendingPlayers([])
      await addMultiplePlayersWithBuyin(entries, amount)
      onBatchAddComplete?.(count)
    } else if (pendingPlayerName) {
      addPlayerWithBuyin(pendingPlayerName, amount, pendingProfileId)
      setPendingPlayerName("")
      setPendingProfileId(null)
      setSelectedProfileId(null)
    }
  }, [setFixedBuyinAmount, setShowFixedBuyinDialog, pendingPlayers, pendingPlayerName, pendingProfileId, addMultiplePlayersWithBuyin, addPlayerWithBuyin, onBatchAddComplete])

  // Handle fixed buy-in dialog skip
  const handleFixedBuyinSkip = useCallback(async () => {
    setFixedBuyinAmount(null)
    setShowFixedBuyinDialog(false)
    const count = pendingPlayers.length
    if (count > 0) {
      const entries = [...pendingPlayers]
      setPendingPlayers([])
      await addMultiplePlayersWithBuyin(entries, null)
      onBatchAddComplete?.(count)
    } else if (pendingPlayerName) {
      addPlayerWithBuyin(pendingPlayerName, null, pendingProfileId)
      setPendingPlayerName("")
      setPendingProfileId(null)
      setSelectedProfileId(null)
    }
  }, [setFixedBuyinAmount, setShowFixedBuyinDialog, pendingPlayers, pendingPlayerName, pendingProfileId, addMultiplePlayersWithBuyin, addPlayerWithBuyin, onBatchAddComplete])

  // Handle "This is me" identity linking - shows confirmation dialog first
  const handleLinkIdentity = useCallback((playerId: string) => {
    if (!user || !user.id) {
      setError("Please log in to link your identity")
      return
    }

    // Check if player is already linked
    const player = players.find((p) => p.id === playerId)
    if (player?.profileId) {
      setError("This player is already linked to another account")
      return
    }

    // Check if user is already linked to another player in this session
    const userAlreadyLinked = players.some(
      (p) => p.id !== playerId && p.profileId === user.id
    )
    if (userAlreadyLinked) {
      const linkedPlayer = players.find((p) => p.profileId === user.id)
      setError(
        `You are already linked to "${linkedPlayer?.name}" in this session. ` +
        `You can only link to one player per session.`
      )
      return
    }

    // Show confirmation dialog instead of immediate action
    setPendingPlayerId(playerId)
    setShowLinkIdentityDialog(true)
  }, [user, session, players, setError])

  // Actually perform the identity link after confirmation
  const confirmLinkIdentity = useCallback(async () => {
    if (!pendingPlayerId || !user?.id) return

    setError(null)

    // Double-check before updating (in case state changed)
    const userAlreadyLinked = players.some(
      (p) => p.id !== pendingPlayerId && p.profileId === user.id
    )
    if (userAlreadyLinked) {
      const linkedPlayer = players.find((p) => p.profileId === user.id)
      setError(
        `You are already linked to "${linkedPlayer?.name}" in this session. ` +
        `You can only link to one player per session.`
      )
      setShowLinkIdentityDialog(false)
      setPendingPlayerId(null)
      await reloadPlayers() // Refresh to show current state
      return
    }

    try {
      const { data, error: linkError } = await supabase
        .from("players")
        .update({ profile_id: user.id })
        .eq("id", pendingPlayerId)
        .eq("session_id", sessionId)
        .is("profile_id", null) // Only update if profile_id is null
        .select("id")

      if (linkError) {
        console.error("Error linking identity:", linkError)
        setError(`Failed to link identity: ${linkError.message}`)
        return
      }

      if (!data || data.length === 0) {
        setError("Could not link identity. The player may already be linked or you may not have permission.")
        return
      }

      // Reload players to get updated profile_id
      await reloadPlayers()
      setError(null)
      setShowLinkIdentityDialog(false)
      setPendingPlayerId(null)
    } catch (err) {
      console.error("Unexpected error linking identity:", err)
      setError("Failed to link identity. Please try again.")
    }
  }, [pendingPlayerId, user, players, sessionId, setError, reloadPlayers])

  // Calculate if user is already linked to any player in this session
  const userAlreadyLinkedToAnyPlayer = useMemo(() => {
    if (!user?.id) return false
    return players.some((p) => p.profileId === user.id)
  }, [players, user?.id])

  return {
    // State
    players,
    setPlayers,
    playerName,
    setPlayerName,
    selectedProfileId,
    setSelectedProfileId,
    isAddingPlayer,
    pendingPlayerId,
    setPendingPlayerId,
    showLinkIdentityDialog,
    setShowLinkIdentityDialog,
    editingPlayerId,
    setEditingPlayerId,
    
    // Handlers
    reloadPlayers,
    handleAddPlayer,
    handleAddMultiplePlayers,
    addPlayerWithBuyin,
    addMultiplePlayersWithBuyin,
    handleLinkIdentity,
    confirmLinkIdentity,
    handleFixedBuyinConfirm,
    handleFixedBuyinSkip,
    
    // Computed
    userAlreadyLinkedToAnyPlayer,
  }
}
