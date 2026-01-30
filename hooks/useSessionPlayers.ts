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
}

interface UseSessionPlayersReturn {
  // State
  players: Player[]
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>
  playerName: string
  setPlayerName: (name: string) => void
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
  addPlayerWithBuyin: (name: string, buyinAmount?: number | null) => Promise<void>
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
}: UseSessionPlayersParams): UseSessionPlayersReturn {
  // Player state
  const [players, setPlayers] = useState<Player[]>([])
  const [playerName, setPlayerName] = useState("")
  const [isAddingPlayer, setIsAddingPlayer] = useState(false)
  const [pendingPlayerName, setPendingPlayerName] = useState("")
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

  // Add player with optional buy-in
  const addPlayerWithBuyin = useCallback(async (name: string, buyinAmount?: number | null) => {
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
      
      const { data, error } = await supabase
        .from("players")
        .insert({
          id: playerId,
          session_id: sessionId,
          club_id: sessionClubId,
          name: name
        })
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

      // DEBUG: Confirm completion
      console.log("🔵 [DEBUG] Supabase Add Player attempt finished")

      setPlayerName("")
      // Reload transactions first to ensure they're available, then reload players
      await reloadTransactions()
      await reloadPlayers()
    } catch (err) {
      console.error("🔴 [DEBUG] Unexpected error during Supabase player insert:", err)
    } finally {
      setIsAddingPlayer(false)
    }
  }, [sessionId, session, fixedBuyinAmount, setError, reloadTransactions, reloadPlayers])

  // Handle add player form submission
  const handleAddPlayer = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    // DEBUG: Confirm handler execution
    console.log("🔵 [DEBUG] Add Player handler executed")
    
    if (!playerName.trim()) {
      console.log("🔴 [DEBUG] Validation failed: empty player name")
      return
    }

    // If this is the first player and fixed buy-in hasn't been set, show dialog
    if (players.length === 0 && fixedBuyinAmount === null) {
      setPendingPlayerName(playerName.trim())
      setShowFixedBuyinDialog(true)
      return // Wait for user to set fixed buy-in or skip
    }

    // For subsequent players, explicitly pass fixedBuyinAmount if it exists
    // This ensures the fixed buy-in is applied even if state hasn't updated yet
    await addPlayerWithBuyin(playerName.trim(), fixedBuyinAmount ?? undefined)
  }, [playerName, players.length, fixedBuyinAmount, setShowFixedBuyinDialog, addPlayerWithBuyin])

  // Handle fixed buy-in dialog confirmation
  const handleFixedBuyinConfirm = useCallback((amount: number) => {
    setFixedBuyinAmount(amount)
    setShowFixedBuyinDialog(false)
    // Now add the pending player with the buy-in amount passed directly
    if (pendingPlayerName) {
      addPlayerWithBuyin(pendingPlayerName, amount) // Pass amount directly to avoid state timing issue
      setPendingPlayerName("")
    }
  }, [setFixedBuyinAmount, setShowFixedBuyinDialog, pendingPlayerName, addPlayerWithBuyin])

  // Handle fixed buy-in dialog skip
  const handleFixedBuyinSkip = useCallback(() => {
    setFixedBuyinAmount(null) // Explicitly set to null to indicate "no fixed buy-in"
    setShowFixedBuyinDialog(false)
    // Now add the pending player without buy-in
    if (pendingPlayerName) {
      addPlayerWithBuyin(pendingPlayerName, null) // Pass null directly to avoid state timing issue
      setPendingPlayerName("")
    }
  }, [setFixedBuyinAmount, setShowFixedBuyinDialog, pendingPlayerName, addPlayerWithBuyin])

  // Handle "This is me" identity linking - shows confirmation dialog first
  const handleLinkIdentity = useCallback((playerId: string) => {
    if (!user || !user.id) {
      setError("Please log in to link your identity")
      return
    }

    // Check if session is finalized
    if (session?.finalizedAt) {
      setError("Cannot link identity to a finalized session")
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
      const { error: linkError } = await supabase
        .from("players")
        .update({ profile_id: user.id })
        .eq("id", pendingPlayerId)
        .eq("session_id", sessionId)
        .is("profile_id", null) // Only update if profile_id is null

      if (linkError) {
        console.error("Error linking identity:", linkError)
        setError(`Failed to link identity: ${linkError.message}`)
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
    addPlayerWithBuyin,
    handleLinkIdentity,
    confirmLinkIdentity,
    handleFixedBuyinConfirm,
    handleFixedBuyinSkip,
    
    // Computed
    userAlreadyLinkedToAnyPlayer,
  }
}
