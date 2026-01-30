"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

// DEBUG: Generate UUID v4 for player ID
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}
import { Session } from "@/types/session"
import { Player } from "@/types/player"
import { Transaction } from "@/types/transaction"
import { useAuth } from "@/contexts/AuthContext"
import { useUIState } from "@/contexts/UIStateContext"
import { useClub } from "@/contexts/ClubContext"
import { useIsDesktop } from "@/hooks/useIsDesktop"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { AppShell } from "@/components/layout/AppShell"
import { Copy, Check, Pencil, X, Plus, ChevronDown, ChevronRight, Trophy, TrendingUp, TrendingDown, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

type Step = "setup" | "buyins" | "cashouts" | "results" | "share"

type Transfer = {
  debtorId: string
  debtorName: string
  creditorId: string
  creditorName: string
  amount: number
}

export default function SessionPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = params.id as string
  const currentStep = (searchParams.get("step") || "setup") as Step
  const { user } = useAuth()
  const { isSidebarOpen, closeAllOverlays } = useUIState()
  const { activeClubId, loading: isLoadingClubs } = useClub()
  const isDesktop = useIsDesktop()

  const [session, setSession] = useState<Session | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [playerName, setPlayerName] = useState("")
  const [isAddingPlayer, setIsAddingPlayer] = useState(false)
  const [transactionUpdateCounter, setTransactionUpdateCounter] = useState(0)
  const [copiedSummary, setCopiedSummary] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [editingPlayerId, setEditingPlayerId] = useState<string | "new" | null>(null)
  const [chipEntryMode, setChipEntryMode] = useState(false) // UI-only state for chip entry phase
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [fixedBuyinAmount, setFixedBuyinAmount] = useState<number | null>(null)
  const [showFixedBuyinDialog, setShowFixedBuyinDialog] = useState(false)
  const [pendingPlayerName, setPendingPlayerName] = useState("") // Store player name while waiting for fixed buy-in decision
  const [showLinkIdentityDialog, setShowLinkIdentityDialog] = useState(false)
  const [pendingPlayerId, setPendingPlayerId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const hasLoadedOnce = useRef(false)

  // Reset load tracking when sessionId changes
  useEffect(() => {
    hasLoadedOnce.current = false
    setIsLoading(true)
  }, [sessionId])

  // Close all dialogs when sidebar opens (to prevent blocking)
  useEffect(() => {
    if (isSidebarOpen) {
      setEditingPlayerId(null)
      setShowFixedBuyinDialog(false)
      setShowShareDialog(false)
      setShowLinkIdentityDialog(false)
    }
  }, [isSidebarOpen])

  // Redirect if session doesn't belong to active club
  useEffect(() => {
    // Wait for clubs to load and activeClubId to be set
    if (isLoadingClubs || !activeClubId) return
    
    // Only redirect if we've attempted to load at least once (avoid redirect on initial mount)
    if (!isLoading && hasLoadedOnce.current) {
      let shouldRedirect = false
      let redirectReason = ""
      
      if (session && session.clubId && session.clubId !== activeClubId) {
        // Session loaded but belongs to different club - redirect immediately
        shouldRedirect = true
        redirectReason = "Session belongs to different club"
      } else if (!session && activeClubId && hasLoadedOnce.current) {
        // Session might not belong to active club (RLS blocked) - redirect
        shouldRedirect = true
        redirectReason = "Session not found or not accessible in active club"
      }
      
      if (shouldRedirect) {
        console.warn(`${redirectReason}, redirecting to sessions list`)
        // Use replace instead of push to avoid adding to history
        router.replace("/sessions")
      }
    }
  }, [activeClubId, session, isLoadingClubs, isLoading, router])

  // DEBUG: Load session from Supabase
  useEffect(() => {
    // Wait for clubs to load and activeClubId to be set before fetching session
    if (isLoadingClubs || !activeClubId) return
    
    const loadSession = async () => {
      console.log("🔵 [DEBUG] Loading session from Supabase:", sessionId)
      
      try {
        const { data, error } = await supabase
          .from("sessions")
          .select("*")
          .eq("id", sessionId)
          .single()

        console.log("🔵 [DEBUG] Supabase session query response:", {
          data: data,
          error: error,
          hasData: !!data,
          hasError: !!error
        })

        if (error) {
          console.error("🔴 [DEBUG] Supabase session query ERROR:", error)
          console.error("🔴 [DEBUG] Error details:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          })
          setSession(null)
          
          // If error is 401/403 (RLS blocked) and we have activeClubId, redirect
          if (activeClubId && (
            error.code === 'PGRST301' || 
            error.code === '42501' || 
            error.message?.includes('permission') ||
            error.message?.includes('row-level security')
          )) {
            console.warn("Session access denied (RLS), redirecting to sessions list")
            router.replace("/sessions")
          }
        } else if (data) {
          console.log("✅ [DEBUG] Session loaded successfully:", data)
          // Convert Supabase format to app format
          const session: Session = {
            id: data.id,
            name: data.name,
            currency: data.currency as "USD" | "ILS" | "EUR",
            createdAt: data.created_at,
            finalizedAt: data.finalized_at || undefined,
            clubId: data.club_id, // Store for inserts
          }
          
          // Immediately check if session belongs to active club
          if (session.clubId && activeClubId && session.clubId !== activeClubId) {
            console.warn("Session belongs to different club, redirecting immediately")
            router.replace("/sessions")
            return // Don't set session state
          }
          
          setSession(session)
        } else {
          console.warn("⚠️ [DEBUG] No session data returned")
          setSession(null)
        }
      } catch (err) {
        console.error("🔴 [DEBUG] Unexpected error loading session:", err)
        setSession(null)
      }

      // DEBUG: Load players from Supabase
      console.log("🔵 [DEBUG] Loading players from Supabase for session:", sessionId)
      
      try {
        const { data: playersData, error: playersError } = await supabase
          .from("players")
          .select("*")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true })

        console.log("🔵 [DEBUG] Supabase players query response:", {
          data: playersData,
          error: playersError,
          hasData: !!playersData,
          hasError: !!playersError,
          count: playersData?.length || 0
        })

        if (playersError) {
          console.error("🔴 [DEBUG] Supabase players query ERROR:", playersError)
          console.error("🔴 [DEBUG] Error details:", {
            message: playersError.message,
            details: playersError.details,
            hint: playersError.hint,
            code: playersError.code
          })
          setPlayers([])
        } else if (playersData) {
          console.log("✅ [DEBUG] Players loaded successfully:", playersData)
          // Convert Supabase format to app format
          const players: Player[] = playersData.map((p) => ({
            id: p.id,
            sessionId: p.session_id,
            name: p.name,
            createdAt: p.created_at,
            profileId: p.profile_id || null,
          }))
          setPlayers(players)
        } else {
          console.warn("⚠️ [DEBUG] No players data returned")
          setPlayers([])
        }
      } catch (err) {
        console.error("🔴 [DEBUG] Unexpected error loading players:", err)
        setPlayers([])
      }

      // DEBUG: Load transactions from Supabase
      console.log("🔵 [DEBUG] Loading transactions from Supabase for session:", sessionId)
      
      try {
        const { data: transactionsData, error: transactionsError } = await supabase
          .from("transactions")
          .select("*")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true })

        console.log("🔵 [DEBUG] Supabase transactions query response:", {
          data: transactionsData,
          error: transactionsError,
          hasData: !!transactionsData,
          hasError: !!transactionsError,
          count: transactionsData?.length || 0
        })

        if (transactionsError) {
          console.error("🔴 [DEBUG] Supabase transactions query ERROR:", transactionsError)
          console.error("🔴 [DEBUG] Error details:", {
            message: transactionsError.message,
            details: transactionsError.details,
            hint: transactionsError.hint,
            code: transactionsError.code
          })
          setTransactions([])
        } else if (transactionsData) {
          console.log("✅ [DEBUG] Transactions loaded successfully:", transactionsData)
          // Convert Supabase format to app format
          const transactions: Transaction[] = transactionsData.map((t) => ({
            id: t.id,
            sessionId: t.session_id,
            playerId: t.player_id,
            type: t.type as "buyin" | "cashout",
            amount: parseFloat(t.amount.toString()),
            createdAt: t.created_at,
          }))
          setTransactions(transactions)
        } else {
          console.warn("⚠️ [DEBUG] No transactions data returned")
          setTransactions([])
        }
      } catch (err) {
        console.error("🔴 [DEBUG] Unexpected error loading transactions:", err)
        setTransactions([])
      }

      setIsLoading(false)
      hasLoadedOnce.current = true // Mark that we've attempted to load at least once
    }

      loadSession()
  }, [sessionId, isLoadingClubs, activeClubId, router])

  const reloadSession = async () => {
    console.log("🔵 [DEBUG] Reloading session from Supabase:", sessionId)
    
    try {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .single()

      if (error) {
        console.error("🔴 [DEBUG] Reload session ERROR:", error)
        return
      }

      if (data) {
        const session: Session = {
          id: data.id,
          name: data.name,
          currency: data.currency as "USD" | "ILS" | "EUR",
          createdAt: data.created_at,
          finalizedAt: data.finalized_at || undefined,
        }
        setSession(session)
      }
    } catch (err) {
      console.error("🔴 [DEBUG] Unexpected error reloading session:", err)
    }
  }

  const reloadPlayers = async () => {
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
  }

  // DEBUG: Reload transactions from Supabase
  const reloadTransactions = async () => {
    console.log("🔵 [DEBUG] Reloading transactions from Supabase for session:", sessionId)
    
    try {
      const { data: transactionsData, error: transactionsError } = await supabase
        .from("transactions")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })

      if (transactionsError) {
        console.error("🔴 [DEBUG] Reload transactions ERROR:", transactionsError)
        return
      }

      if (transactionsData) {
        const transactions: Transaction[] = transactionsData.map((t) => ({
          id: t.id,
          sessionId: t.session_id,
          playerId: t.player_id,
          type: t.type as "buyin" | "cashout",
          amount: parseFloat(t.amount.toString()),
          createdAt: t.created_at,
        }))
        setTransactions(transactions)
        setTransactionUpdateCounter((prev) => prev + 1)
      }
    } catch (err) {
      console.error("🔴 [DEBUG] Unexpected error reloading transactions:", err)
    }
  }

  // Helper functions to get buyins/cashouts by player from transactions state
  const getBuyinsByPlayer = (sessionId: string, playerId: string): Transaction[] => {
    return transactions.filter(
      (transaction) =>
        transaction.sessionId === sessionId &&
        transaction.playerId === playerId &&
        transaction.type === "buyin"
    )
  }

  const getCashoutsByPlayer = (sessionId: string, playerId: string): Transaction[] => {
    return transactions.filter(
      (transaction) =>
        transaction.sessionId === sessionId &&
        transaction.playerId === playerId &&
        transaction.type === "cashout"
    )
  }

  const navigateToStep = (step: Step) => {
    router.push(`/session/${sessionId}?step=${step}`)
  }

  const handleFinalizeSession = async () => {
    if (!session) return
    
    setError(null)
    const finalizedAt = new Date().toISOString()
    
    try {
      // Update session in Supabase
      const { data, error: finalizeError } = await supabase
        .from("sessions")
        .update({ finalized_at: finalizedAt })
        .eq("id", sessionId)
        .select()
      
      if (finalizeError) {
        console.error("Error finalizing session:", finalizeError)
        setError(`Failed to finalize session: ${finalizeError.message}`)
        return
      }
      
      if (data && data.length > 0) {
        // Update local state
        const updatedSession: Session = {
          ...session,
          finalizedAt: finalizedAt,
        }
        setSession(updatedSession)
        setError(null)
        navigateToStep("share")
      } else {
        setError("Failed to finalize session: No data returned")
      }
    } catch (err) {
      console.error("Unexpected error finalizing session:", err)
      setError("Failed to finalize session. Please try again.")
    }
  }

  // Handle "This is me" identity linking - shows confirmation dialog first
  const handleLinkIdentity = (playerId: string) => {
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
  }

  // Actually perform the identity link after confirmation
  const confirmLinkIdentity = async () => {
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
  }

  const handleAddPlayer = async (e: React.FormEvent<HTMLFormElement>) => {
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
  }

  // Separate function to add player (used after fixed buy-in is set/skipped)
  const addPlayerWithBuyin = async (name: string, buyinAmount?: number | null) => {
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
  }

  // Handle fixed buy-in dialog confirmation
  const handleFixedBuyinConfirm = (amount: number) => {
    setFixedBuyinAmount(amount)
    setShowFixedBuyinDialog(false)
    // Now add the pending player with the buy-in amount passed directly
    if (pendingPlayerName) {
      addPlayerWithBuyin(pendingPlayerName, amount) // Pass amount directly to avoid state timing issue
      setPendingPlayerName("")
    }
  }

  // Handle fixed buy-in dialog skip
  const handleFixedBuyinSkip = () => {
    setFixedBuyinAmount(null) // Explicitly set to null to indicate "no fixed buy-in"
    setShowFixedBuyinDialog(false)
    // Now add the pending player without buy-in
    if (pendingPlayerName) {
      addPlayerWithBuyin(pendingPlayerName, null) // Pass null directly to avoid state timing issue
      setPendingPlayerName("")
    }
  }

  // DEBUG: Calculate totals from Supabase transactions (memoized for performance)
  // NOTE: Must be called before early returns to maintain hook order
  const { totalProfitLoss, totalBuyins, totalCashouts } = useMemo(() => {
    if (!session || players.length === 0) {
      return { totalProfitLoss: 0, totalBuyins: 0, totalCashouts: 0 }
    }
    console.log("🔵 [DEBUG] Calculating totals from transactions:", transactions.length)
    let totalPL = 0
    let totalB = 0
    let totalC = 0
    
    players.forEach((player) => {
      const buyins = getBuyinsByPlayer(sessionId, player.id)
      const cashouts = getCashoutsByPlayer(sessionId, player.id)
      const playerBuyins = buyins.reduce((sum, buyin) => sum + buyin.amount, 0)
      const playerCashouts = cashouts.reduce(
        (sum, cashout) => sum + cashout.amount,
        0
      )
      totalB += playerBuyins
      totalC += playerCashouts
      totalPL += playerCashouts - playerBuyins
    })
    
    console.log("🔵 [DEBUG] Totals calculated:", { totalBuyins: totalB, totalCashouts: totalC, totalPL })
    return { totalProfitLoss: totalPL, totalBuyins: totalB, totalCashouts: totalC }
  }, [transactions, players, sessionId])

  const tolerance = 0.01
  const totalsDontBalance = Math.abs(totalProfitLoss) > tolerance

  const isFinalized = session?.finalizedAt !== undefined

  // Calculate current workflow phase (UI-only, derived from existing data)
  const hasCashouts = transactions.some((t) => t.type === "cashout")
  const getCurrentPhase = (): "active_game" | "chip_entry" | "ready_to_finalize" | "finalized" => {
    if (isFinalized) return "finalized"
    if (hasCashouts) return "ready_to_finalize"
    if (chipEntryMode) return "chip_entry"
    return "active_game"
  }
  const currentPhase = getCurrentPhase()

  // DEBUG: Calculate settlement from Supabase transactions (memoized)
  // NOTE: Must be called before early returns to maintain hook order
  const settlementTransfers = useMemo(() => {
    if (!session || players.length === 0) {
      return []
    }
    console.log("🔵 [DEBUG] Calculating settlement from transactions")
    type PlayerPL = {
      playerId: string
      playerName: string
      pl: number
    }

    const playersPL: PlayerPL[] = players.map((player) => {
      const buyins = getBuyinsByPlayer(sessionId, player.id)
      const cashouts = getCashoutsByPlayer(sessionId, player.id)
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
      .filter((p) => p.pl > tolerance)
      .map((p) => ({ ...p, amount: p.pl }))
      .sort((a, b) => b.amount - a.amount)

    const debtors = playersPL
      .filter((p) => p.pl < -tolerance)
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
      if (creditors[j].amount <= tolerance) {
        j++
      }
      if (debtors[i].amount <= tolerance) {
        i++
      }
    }

    return transfers
  }, [transactions, players, sessionId, tolerance])

  // Generate settlement summary - Enhanced format
  const generateSettlementSummary = (): string => {
    if (!session || !isFinalized) {
      return ""
    }

    const lines: string[] = []
    
    // Header with date and pot
    const sessionDate = new Date(session.finalizedAt || session.createdAt)
    const dateStr = sessionDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
    
    lines.push(`🃏 Poker Night Results - ${dateStr} 🃏`)
    lines.push(`💰 Pot: ${session.currency}${totalBuyins.toFixed(2)} (calculated by the total buy-ins in the game)`)
    lines.push("")
    
    // Final Standings
    lines.push("📊 Final Standings:")
    lines.push("-----------------------------------")
    
    // Combine winners and losers, sorted by absolute P/L (highest first)
    const allPlayers = [...winners, ...losers].sort((a, b) => Math.abs(b.pl) - Math.abs(a.pl))
    
    allPlayers.forEach((result, index) => {
      const isWinner = result.pl > 0.01
      const emoji = isWinner ? "🏆" : "💸"
      const amount = Math.abs(result.pl)
      lines.push(`${index + 1}. ${result.player.name} ${emoji} ${session.currency}${amount.toFixed(2)}`)
    })
    
    lines.push("")
    lines.push("💳 Who Pays Whom:")
    lines.push("-----------------------------------")
    
    if (settlementTransfers.length === 0) {
      lines.push("No payments needed.")
    } else {
      settlementTransfers.forEach((transfer) => {
        lines.push(`${transfer.debtorName} → ${transfer.creditorName}: ${session.currency}${transfer.amount.toFixed(2)}`)
      })
    }
    
    lines.push("")
    lines.push("🎲 Thanks for playing!")
    
    return lines.join("\n")
  }

  const handleShareResults = () => {
    setShowShareDialog(true)
  }

  const handleCopyToClipboard = async () => {
    const summary = generateSettlementSummary()
    try {
      await navigator.clipboard.writeText(summary)
      setCopiedSummary(true)
      setTimeout(() => setCopiedSummary(false), 2000)
    } catch (error) {
      console.error("Failed to copy settlement summary:", error)
    }
  }

  const handleCopyShareableLink = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    } catch (error) {
      console.error("Failed to copy shareable link:", error)
    }
  }

  // Calculate if user is already linked to any player in this session
  const userAlreadyLinkedToAnyPlayer = useMemo(() => {
    if (!user?.id) return false
    return players.some((p) => p.profileId === user.id)
  }, [players, user?.id])

  // Calculate player results
  // DEBUG: Calculate player results from Supabase transactions (memoized)
  const playerResults = useMemo(() => {
    if (!session || players.length === 0) {
      return []
    }
    console.log("🔵 [DEBUG] Calculating player results from transactions")
    return players.map((player) => {
      const buyins = getBuyinsByPlayer(sessionId, player.id)
      const cashouts = getCashoutsByPlayer(sessionId, player.id)
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
  }, [transactions, players, sessionId])

  // Calculate winners and losers for settlement summary
  const winners = useMemo(() => {
    return playerResults
      .filter((r) => r.pl > 0.01)
      .sort((a, b) => b.pl - a.pl)
  }, [playerResults])

  const losers = useMemo(() => {
    return playerResults
      .filter((r) => r.pl < -0.01)
      .sort((a, b) => a.pl - b.pl)
  }, [playerResults])

  const totalWinnings = useMemo(() => {
    return winners.reduce((sum, w) => sum + w.pl, 0)
  }, [winners])

  const totalLosses = useMemo(() => {
    return Math.abs(losers.reduce((sum, l) => sum + l.pl, 0))
  }, [losers])

  // Early returns AFTER all hooks to maintain hook order
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Session Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">
              The session with ID "{sessionId}" could not be found.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-background">
        {/* Session Header - Workspace Context */}
        <div className="sticky top-0 z-10 bg-background border-b">
          <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-5 max-w-6xl">
            {/* Mobile: Summary Card at top */}
            <div className="md:hidden mb-4">
              <Card className="bg-muted/50 border-muted">
                <CardContent className="p-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col items-center justify-center min-h-[60px]">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Buy-ins</p>
                      <p className="text-base font-bold font-mono leading-none">{session.currency} {totalBuyins.toFixed(2)}</p>
                    </div>
                    <div className="flex flex-col items-center justify-center min-h-[60px] border-x border-border/50">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Cash-outs</p>
                      <p className="text-base font-bold font-mono leading-none">{session.currency} {totalCashouts.toFixed(2)}</p>
                    </div>
                    <div className="flex flex-col items-center justify-center min-h-[60px]">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">P/L</p>
                      <p
                        className={cn(
                          "text-base font-bold font-mono leading-none",
                          totalProfitLoss > 0.01
                            ? "text-green-600 dark:text-green-500"
                            : totalProfitLoss < -0.01
                            ? "text-red-600 dark:text-red-500"
                            : "text-muted-foreground"
                        )}
                      >
                        {totalProfitLoss > 0 ? "+" : ""}
                        {session.currency} {totalProfitLoss.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              {/* Left: Session Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{session.name}</h1>
                  <Badge variant={isFinalized ? "default" : "secondary"} className="shrink-0 w-fit">
                    {isFinalized ? "Finalized" : "Active"}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                  <span className="font-medium">{session.currency}</span>
                  <span className="hidden md:inline">•</span>
                  <span className="hidden md:inline">ID: {sessionId.slice(0, 8)}...</span>
                  <span>•</span>
                  <span>Created {new Date(session.createdAt).toLocaleDateString()}</span>
                  {isFinalized && session.finalizedAt && (
                    <>
                      <span>•</span>
                      <span>Finalized {new Date(session.finalizedAt).toLocaleDateString()}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Right: Quick Stats - Desktop only */}
              <div className="hidden md:flex gap-4 sm:gap-6 shrink-0">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Buy-ins</p>
                  <p className="text-sm sm:text-base font-bold font-mono">{session.currency} {totalBuyins.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Cash-outs</p>
                  <p className="text-sm sm:text-base font-bold font-mono">{session.currency} {totalCashouts.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">P/L</p>
                  <p
                    className={cn(
                      "text-sm sm:text-base font-bold font-mono",
                      totalProfitLoss > 0.01
                        ? "text-green-600 dark:text-green-500"
                        : totalProfitLoss < -0.01
                        ? "text-red-600 dark:text-red-500"
                        : "text-muted-foreground"
                    )}
                  >
                    {totalProfitLoss > 0 ? "+" : ""}
                    {session.currency} {totalProfitLoss.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Workspace - Table-Based Layout */}
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-32 md:pb-6 max-w-6xl space-y-6">
          {/* Error Display */}
          {error && (
            <Alert className="mb-4 border-destructive bg-destructive/10 text-destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {/* Phase Indicator */}
          <div className="flex items-center justify-between pb-2 border-b">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Phase:</span>
              <Badge 
                variant={
                  currentPhase === "finalized" ? "default" :
                  currentPhase === "ready_to_finalize" ? "default" :
                  currentPhase === "chip_entry" ? "secondary" :
                  "outline"
                }
                className="text-xs"
              >
                {currentPhase === "finalized" ? "Finalized" :
                 currentPhase === "ready_to_finalize" ? "Ready to Finalize" :
                 currentPhase === "chip_entry" ? "Chip Entry" :
                 "Active Game"}
              </Badge>
              <span className="hidden md:inline text-xs text-muted-foreground">
                {currentPhase === "active_game" && "Track buy-ins as players join or re-buy"}
                {currentPhase === "chip_entry" && "Enter final chip counts for each player"}
                {currentPhase === "ready_to_finalize" && "Review settlement calculations before finalizing"}
                </span>
            </div>
            {/* Desktop only - mobile actions in sticky footer */}
            <div className="hidden md:flex md:items-center md:gap-2">
              {currentPhase === "active_game" && (
                <Button
                  onClick={() => setEditingPlayerId("new")}
                  size="sm"
                  variant="default"
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Player
                </Button>
              )}
            {currentPhase === "active_game" && !hasCashouts && (
              <Button
                onClick={() => setChipEntryMode(true)}
                size="sm"
                  variant="outline"
              >
                Start Chip Entry
              </Button>
            )}
            {currentPhase === "chip_entry" && (
              <Button
                onClick={() => setChipEntryMode(false)}
                size="sm"
                variant="outline"
              >
                Back to Active Game
              </Button>
            )}
            </div>
          </div>

          {/* Players Table */}
          <PlayersTable
            players={players}
            playerResults={playerResults}
            currency={session.currency}
            isFinalized={isFinalized}
            currentPhase={currentPhase}
            user={user}
            userAlreadyLinked={userAlreadyLinkedToAnyPlayer}
            onRowClick={(playerId) => setEditingPlayerId(playerId)}
            onAddPlayerClick={() => setEditingPlayerId("new")}
            onLinkIdentity={handleLinkIdentity}
          />

          {/* Settlement Preview - Enhanced Two-Column Layout */}
          {hasCashouts && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-settlement-preview>
              {/* Left: Settlement Summary */}
              <Card className="shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    <CardTitle className="text-xl">Settlement Summary</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Winners Section */}
                  {winners.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-500" />
                        <h3 className="text-sm font-semibold text-green-600 dark:text-green-500">
                          Winner ({winners.length})
                        </h3>
                      </div>
                      <div className="space-y-2 md:space-y-2">
                        {winners.map((result) => (
                          <div
                            key={result.player.id}
                            className="p-3 md:p-3 bg-green-50/50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900"
                          >
                            {/* Mobile: Vertical layout with dominant number */}
                            <div className="md:hidden space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="font-semibold text-base text-foreground">{result.player.name}</p>
                                <p className="text-lg font-bold font-mono text-green-600 dark:text-green-500">
                                  +{session.currency} {result.pl.toFixed(2)}
                                </p>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-green-200/50 dark:border-green-900/50">
                                <span>Buy-in: <span className="font-mono font-medium text-foreground">{session.currency} {result.totalBuyins.toFixed(2)}</span></span>
                                <span>Final: <span className="font-mono font-medium text-foreground">{session.currency} {result.totalCashouts.toFixed(2)}</span></span>
                              </div>
                            </div>
                            {/* Desktop: Original horizontal layout */}
                            <div className="hidden md:flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 font-semibold text-sm">
                                {result.player.name[0].toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{result.player.name}</p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                  <span>Buy-in {session.currency} {result.totalBuyins.toFixed(2)}</span>
                                  <span>•</span>
                                  <span>Final {session.currency} {result.totalCashouts.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-green-600 dark:text-green-500">
                                +{session.currency} {result.pl.toFixed(2)}
                              </p>
                              <p className="text-xs text-muted-foreground">Net Winnings</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Owes Section */}
                  {losers.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-500" />
                        <h3 className="text-sm font-semibold text-red-600 dark:text-red-500">
                          Owes ({losers.length})
                        </h3>
                      </div>
                      <div className="space-y-2 md:space-y-2">
                        {losers.map((result) => (
                          <div
                            key={result.player.id}
                            className="p-3 md:p-3 bg-red-50/50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900"
                          >
                            {/* Mobile: Vertical layout with dominant number */}
                            <div className="md:hidden space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="font-semibold text-base text-foreground">{result.player.name}</p>
                                <p className="text-lg font-bold font-mono text-red-600 dark:text-red-500">
                                  {session.currency} {result.pl.toFixed(2)}
                                </p>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-red-200/50 dark:border-red-900/50">
                                <span>Buy-in: <span className="font-mono font-medium text-foreground">{session.currency} {result.totalBuyins.toFixed(2)}</span></span>
                                <span>Final: <span className="font-mono font-medium text-foreground">{session.currency} {result.totalCashouts.toFixed(2)}</span></span>
                              </div>
                            </div>
                            {/* Desktop: Original horizontal layout */}
                            <div className="hidden md:flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 font-semibold text-sm">
                                {result.player.name[0].toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{result.player.name}</p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                  <span>Buy-in {session.currency} {result.totalBuyins.toFixed(2)}</span>
                                  <span>•</span>
                                  <span>Final {session.currency} {result.totalCashouts.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-red-600 dark:text-red-500">
                                {session.currency} {result.pl.toFixed(2)}
                              </p>
                              <p className="text-xs text-muted-foreground">Net Losses</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Totals */}
                  <div className="pt-4 border-t space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-muted-foreground">Total Winnings:</span>
                      <span className="text-sm font-semibold text-green-600 dark:text-green-500">
                        +{session.currency} {totalWinnings.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-muted-foreground">Total Losses:</span>
                      <span className="text-sm font-semibold text-red-600 dark:text-red-500">
                        {session.currency} {totalLosses.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Right: Who Pays Whom */}
              <Card className="shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-5 w-5 text-blue-500" />
                    <CardTitle className="text-xl">Who Pays Whom</CardTitle>
                  </div>
                  <CardDescription className="mt-1">
                    Payment instructions for settling the session
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {settlementTransfers.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                      <div className="text-4xl">✓</div>
                      <p className="text-base font-medium text-foreground">No payments needed</p>
                      <p className="text-sm text-muted-foreground">
                        All players have balanced their accounts
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 md:space-y-3">
                      {settlementTransfers.map((transfer, index) => (
                      <div
                        key={index}
                          className="p-4 md:p-4 bg-muted/50 rounded-lg border border-border hover:bg-muted transition-colors"
                        >
                          {/* Mobile: Clear single-line format */}
                          <div className="md:hidden space-y-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 font-semibold text-sm shrink-0">
                                {transfer.debtorName[0].toUpperCase()}
                              </div>
                              <span className="text-base font-semibold text-red-600 dark:text-red-500">{transfer.debtorName}</span>
                              <span className="text-sm text-muted-foreground">pays</span>
                              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 font-semibold text-sm shrink-0">
                                {transfer.creditorName[0].toUpperCase()}
                              </div>
                              <span className="text-base font-semibold text-green-600 dark:text-green-500">{transfer.creditorName}</span>
                            </div>
                            <div className="flex items-center justify-end pt-1 border-t border-border/50">
                              <span className="font-mono font-bold text-lg text-foreground">
                                {session.currency} {transfer.amount.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          {/* Desktop: Original layout */}
                          <div className="hidden md:flex items-center gap-3">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 font-semibold text-sm">
                            {transfer.debtorName[0].toUpperCase()}
                          </div>
                          <span className="font-medium text-base">
                            <span className="text-red-600 dark:text-red-500">{transfer.debtorName}</span>
                            {" → "}
                            <span className="text-green-600 dark:text-green-500">{transfer.creditorName}</span>
                          </span>
                        </div>
                            <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 font-semibold text-sm">
                            {transfer.creditorName[0].toUpperCase()}
                          </div>
                              <span className="font-mono font-bold text-lg text-foreground whitespace-nowrap">
                            {session.currency} {transfer.amount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Balance Warning (if needed) */}
          {hasCashouts && totalsDontBalance && (
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
              <AlertDescription className="text-amber-900 dark:text-amber-200">
                <strong>Note:</strong> Totals may not balance due to rake taken during play.
              </AlertDescription>
            </Alert>
          )}

          {/* Global Actions - Desktop only, mobile actions in sticky footer */}
          <div className="hidden md:flex md:justify-end pt-4 border-t">
            {!isFinalized ? (
              currentPhase === "ready_to_finalize" ? (
                <Button 
                  onClick={handleFinalizeSession} 
                  size="lg" 
                  className="min-w-[160px]"
                >
                  Finalize Session
                </Button>
              ) : currentPhase === "chip_entry" ? (
                <Button 
                  onClick={() => {
                    // Scroll to settlement preview if it exists
                    if (hasCashouts) {
                      document.querySelector('[data-settlement-preview]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                  }}
                  size="lg" 
                  className="min-w-[160px]"
                  variant="default"
                >
                  Review Settlement
                </Button>
              ) : null
            ) : (
              <div className="flex gap-3">
                <Button 
                  onClick={handleShareResults}
                  variant="outline"
                  size="lg"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Share Results
                </Button>
                <Button 
                  onClick={handleCopyShareableLink}
                  variant={copiedLink ? "default" : "outline"}
                  size="lg"
                >
                  {copiedLink ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Link Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Link
                    </>
                  )}
                </Button>
                <Button 
                  onClick={() => router.push("/")} 
                  variant="outline"
                  size="lg"
                >
                  Back to Home
                </Button>
              </div>
            )}
          </div>

          {/* Mobile: Sticky Footer for Global Actions */}
          {hasCashouts && (
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t md:hidden p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg">
              {!isFinalized ? (
                currentPhase === "ready_to_finalize" ? (
                  <Button 
                    onClick={handleFinalizeSession} 
                    size="lg" 
                    className="w-full h-12 text-base font-medium"
                  >
                    Finalize Session
                  </Button>
                ) : currentPhase === "chip_entry" ? (
                  <Button 
                    onClick={() => {
                      // Scroll to settlement preview if it exists
                      if (hasCashouts) {
                        document.querySelector('[data-settlement-preview]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }
                    }}
                    size="lg" 
                    variant="default"
                    className="w-full h-12 text-base font-medium"
                  >
                    Review Settlement
                  </Button>
                ) : null
              ) : (
                <div className="space-y-2">
                  <Button 
                    onClick={handleShareResults}
                    variant="default"
                    size="lg"
                    className="w-full h-12 text-base font-medium"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Share Results
                  </Button>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleCopyShareableLink}
                      variant={copiedLink ? "default" : "outline"}
                      size="lg"
                      className="flex-1 h-11 text-sm"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Link Copied
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy Link
                        </>
                      )}
                    </Button>
                    <Button 
                      onClick={() => router.push("/")} 
                      variant="outline"
                      size="lg"
                      className="flex-1 h-11 text-sm"
                    >
                      Home
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Edit Player Dialog (used for both editing and adding) */}
        {editingPlayerId && session && session.clubId && (
          <EditPlayerDialog
            player={editingPlayerId === "new" ? null : players.find((p) => p.id === editingPlayerId) || null}
            sessionId={sessionId}
            clubId={session.clubId}
            currency={session.currency}
            isFinalized={isFinalized}
            transactions={transactions}
            playerName={playerName}
            setPlayerName={setPlayerName}
            isAddingPlayer={isAddingPlayer}
            currentPhase={currentPhase}
            onAddPlayer={handleAddPlayer}
            onTransactionUpdate={() => {
              reloadTransactions()
              reloadPlayers()
            }}
            onClose={() => {
              setEditingPlayerId(null)
              setPlayerName("")
            }}
          />
        )}

        {/* Share Results Dialog */}
        {showShareDialog && (
          <ShareResultsDialog
            summary={generateSettlementSummary()}
            copied={copiedSummary}
            onCopy={handleCopyToClipboard}
            onClose={() => setShowShareDialog(false)}
          />
        )}

        {/* Fixed Buy-in Dialog */}
        {showFixedBuyinDialog && (
          <FixedBuyinDialog
            open={showFixedBuyinDialog}
            onConfirm={handleFixedBuyinConfirm}
            onSkip={handleFixedBuyinSkip}
            currency={session.currency}
          />
        )}

        {/* Link Identity Confirmation Dialog */}
        {showLinkIdentityDialog && pendingPlayerId && (
          <Dialog 
            open={showLinkIdentityDialog} 
            onOpenChange={(open) => {
              setShowLinkIdentityDialog(open)
              if (!open) {
                setError(null)
              }
            }}
          >
            <DialogContent 
              className="!flex !flex-col p-0 gap-0 !max-h-[90vh] md:!max-w-lg md:!max-h-[85vh] md:p-6 md:gap-4 md:rounded-lg !bottom-0 !left-0 !right-0 !top-auto !translate-y-0 rounded-t-lg rounded-b-none md:!left-[50%] md:!top-[50%] md:!right-auto md:!bottom-auto md:!translate-x-[-50%] md:!translate-y-[-50%] md:!rounded-lg"
              onOpenAutoFocus={(e) => {
                if (!isDesktop) {
                  e.preventDefault()
                }
              }}
            >
              <div className="flex flex-col h-full min-h-0">
                {/* Mobile: Fixed Header */}
                <div className="flex-shrink-0 px-4 pt-5 pb-4 border-b md:border-b-0 md:p-0 md:pb-0">
                  <DialogHeader className="md:text-left">
                    <DialogTitle className="text-xl md:text-lg font-semibold">Link Your Identity</DialogTitle>
                    <DialogDescription className="text-sm mt-1.5 text-muted-foreground md:mt-0">
                  Are you sure you want to link your account to{" "}
                  <strong>{players.find(p => p.id === pendingPlayerId)?.name}</strong>?
                </DialogDescription>
              </DialogHeader>
                </div>

                {/* Mobile: Scrollable Content */}
                <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 md:flex-none md:min-h-auto md:overflow-visible md:p-0">
                  {error && (
                    <Alert className="border-destructive bg-destructive/10 text-destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                <p className="text-sm text-muted-foreground">
                  This action will:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Link this player to your account permanently</li>
                  <li>Include this player's results in your personal statistics</li>
                  <li>Cannot be undone after the session is finalized</li>
                </ul>
              </div>

                {/* Mobile: Fixed Action Footer */}
                <div className="flex-shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 border-t bg-background md:border-t-0 md:bg-transparent md:p-0 md:pt-4 md:pb-0">
                  <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end md:gap-2">
                <Button
                      variant="ghost"
                  onClick={() => {
                    setShowLinkIdentityDialog(false)
                    setPendingPlayerId(null)
                        setError(null)
                  }}
                      className="h-11 md:h-10 order-2 md:order-1 text-base md:text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </Button>
                    <Button
                      onClick={confirmLinkIdentity}
                      className="h-12 md:h-10 order-1 md:order-2 md:min-w-[140px] text-base md:text-sm font-medium w-full md:w-auto"
                    >
                  Yes, This is Me
                </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Mobile: Sticky Footer for Primary Actions */}
        {!isFinalized && currentPhase !== "ready_to_finalize" && !(hasCashouts && currentPhase === "chip_entry") && (
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t md:hidden p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg">
            {currentPhase === "chip_entry" && !hasCashouts ? (
              // Chip entry phase without cashouts - show Back to Active Game
              <Button
                onClick={() => setChipEntryMode(false)}
                size="lg"
                variant="outline"
                className="w-full h-12 text-base font-medium"
              >
                Back to Active Game
              </Button>
            ) : currentPhase === "active_game" ? (
              // Active game phase - show both buttons like desktop
              <div className="flex gap-2">
                <Button
                  onClick={() => setEditingPlayerId("new")}
                  size="lg"
                  variant="default"
                  className="flex-1 gap-2 h-12 text-base font-medium"
                >
                  <Plus className="h-5 w-5" />
                  Add Player
                </Button>
                {!hasCashouts && (
                  <Button
                    onClick={() => setChipEntryMode(true)}
                    size="lg"
                    variant="outline"
                    className="flex-1 h-12 text-base font-medium"
                  >
                    Start Chip Entry
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </AppShell>
  )
}

// Step 1: Setup
function SetupStep({
  players,
  playerName,
  setPlayerName,
  isAddingPlayer,
  isFinalized,
  currentPhase,
  onAddPlayer,
  onNext,
}: {
  players: Player[]
  playerName: string
  setPlayerName: (name: string) => void
  isAddingPlayer: boolean
  isFinalized: boolean
  currentPhase: "active_game" | "chip_entry" | "ready_to_finalize" | "finalized"
  onAddPlayer: (e: React.FormEvent<HTMLFormElement>) => void
  onNext: () => void
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">Players</CardTitle>
        <CardDescription>
          Add all players participating in this session
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
          {/* Add Player form - hidden in ready_to_finalize and finalized phases */}
          {!isFinalized && currentPhase !== "ready_to_finalize" && (
            <form onSubmit={onAddPlayer} className="flex gap-3">
              <Input
                type="text"
                placeholder="Enter player name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                required
                disabled={isFinalized}
                className="flex-1 max-w-sm h-10"
              />
              <Button 
                type="submit" 
                disabled={isAddingPlayer || isFinalized}
                className="h-10"
              >
                {isAddingPlayer ? "Adding..." : "Add Player"}
              </Button>
            </form>
          )}

          {players.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="text-4xl">👥</div>
              <div className="space-y-1">
                <p className="text-base font-medium text-foreground">
                  No players yet
                </p>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  {isFinalized 
                    ? "This session has been finalized and cannot be modified."
                    : "Add at least one player to continue. You can add more players later."}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {players.length} {players.length === 1 ? "player" : "players"} added
                </p>
              </div>
              <div className="border rounded-lg divide-y">
                {players.map((player, index) => (
                  <div 
                    key={player.id} 
                    className="px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                        {index + 1}
                      </div>
                      <span className="font-medium text-base">{player.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        <div className="flex justify-end pt-6 border-t mt-6">
          <Button 
            onClick={onNext} 
            disabled={players.length === 0} 
            size="lg"
            className="min-w-[140px]"
          >
            Next: Buy-ins
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Step 2: Buy-ins
function BuyinsStep({
  players,
  sessionId,
  currency,
  isFinalized,
  transactions,
  onTransactionUpdate,
  onBack,
  onNext,
}: {
  players: Player[]
  sessionId: string
  currency: string
  isFinalized: boolean
  transactions: Transaction[]
  onTransactionUpdate?: () => void
  onBack: () => void
  onNext: () => void
}) {
  const totalBuyins = transactions
    .filter((t) => t.sessionId === sessionId && t.type === "buyin")
    .reduce((sum, t) => sum + t.amount, 0)

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Buy-ins</CardTitle>
            <CardDescription className="mt-1">
              Record all buy-ins for each player
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Buy-ins</p>
            <p className="text-2xl font-bold font-mono">{currency} {totalBuyins.toFixed(2)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {players.map((player) => (
          <PlayerBuyinForm
            key={player.id}
            player={player}
            sessionId={sessionId}
            currency={currency}
            isFinalized={isFinalized}
            transactions={transactions}
            onTransactionUpdate={onTransactionUpdate}
          />
        ))}

        <div className="flex justify-between pt-6 border-t mt-6">
          <Button variant="outline" onClick={onBack} size="lg">
            Back
          </Button>
          <Button onClick={onNext} size="lg" className="min-w-[160px]">
            Next: Cash-outs
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Step 3: Cash-outs
function CashoutsStep({
  players,
  sessionId,
  currency,
  isFinalized,
  transactions,
  onTransactionUpdate,
  onBack,
  onNext,
}: {
  players: Player[]
  sessionId: string
  currency: string
  isFinalized: boolean
  transactions: Transaction[]
  onTransactionUpdate?: () => void
  onBack: () => void
  onNext: () => void
}) {
  const totalCashouts = transactions
    .filter((t) => t.sessionId === sessionId && t.type === "cashout")
    .reduce((sum, t) => sum + t.amount, 0)

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Cash-outs</CardTitle>
            <CardDescription className="mt-1">
              Record all cash-outs for each player
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Cash-outs</p>
            <p className="text-2xl font-bold font-mono">{currency} {totalCashouts.toFixed(2)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {players.map((player) => (
          <PlayerCashoutForm
            key={player.id}
            player={player}
            sessionId={sessionId}
            currency={currency}
            isFinalized={isFinalized}
            transactions={transactions}
            onTransactionUpdate={onTransactionUpdate}
          />
        ))}

        <div className="flex justify-between pt-6 border-t mt-6">
          <Button variant="outline" onClick={onBack} size="lg">
            Back
          </Button>
          <Button onClick={onNext} size="lg" className="min-w-[180px]">
            Calculate Settlement
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Step 4: Results
function ResultsStep({
  players,
  sessionId,
  currency,
  playerResults,
  settlementTransfers,
  totalsDontBalance,
  isFinalized,
  canFinalize,
  onFinalize,
  onBack,
  onNext,
}: {
  players: Player[]
  sessionId: string
  currency: string
  playerResults: Array<{
    player: Player
    totalBuyins: number
    totalCashouts: number
    pl: number
  }>
  settlementTransfers: Transfer[]
  totalsDontBalance: boolean
  isFinalized: boolean
  canFinalize: boolean
  onFinalize: () => void
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Player Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mobile: Card View */}
          <div className="md:hidden space-y-3">
            {playerResults.map((result) => {
              const plColor =
                result.pl > 0.01
                  ? "text-green-600 dark:text-green-500"
                  : result.pl < -0.01
                  ? "text-red-600 dark:text-red-500"
                  : "text-muted-foreground"
              return (
                <Card key={result.player.id} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-base truncate">{result.player.name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn("text-xl font-bold font-mono", plColor)}>
                          {result.pl > 0 ? "+" : ""}
                          {currency} {result.pl.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Buy-ins</p>
                        <p className="font-mono font-semibold">{currency} {result.totalBuyins.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Cash-outs</p>
                        <p className="font-mono font-semibold">{currency} {result.totalCashouts.toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Desktop: Table View */}
          <div className="hidden md:block border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Player</TableHead>
                  <TableHead className="text-right font-semibold">Buy-ins</TableHead>
                  <TableHead className="text-right font-semibold">Cash-outs</TableHead>
                  <TableHead className="text-right font-semibold">Profit/Loss</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {playerResults.map((result) => {
                  const plColor =
                    result.pl > 0.01
                      ? "text-green-600 dark:text-green-500"
                      : result.pl < -0.01
                      ? "text-red-600 dark:text-red-500"
                      : "text-muted-foreground"
                  return (
                    <TableRow key={result.player.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium text-base">
                        {result.player.name}
                      </TableCell>
                      <TableCell className="text-right font-mono text-base">
                        {currency} {result.totalBuyins.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-base">
                        {currency} {result.totalCashouts.toFixed(2)}
                      </TableCell>
                      <TableCell className={cn("text-right font-mono text-lg font-semibold", plColor)}>
                        {result.pl > 0 ? "+" : ""}
                        {currency} {result.pl.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {totalsDontBalance && (
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
              <AlertDescription className="text-amber-900 dark:text-amber-200">
                <strong>Note:</strong> Totals may not balance due to rake taken during play.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Settlement</CardTitle>
          <CardDescription className="mt-1">
            Payment instructions for settling the session
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settlementTransfers.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <div className="text-4xl">✓</div>
              <p className="text-base font-medium text-foreground">No payments needed</p>
              <p className="text-sm text-muted-foreground">
                All players have balanced their accounts
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Payment Instructions
              </p>
              {settlementTransfers.map((transfer, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                      {index + 1}
                    </div>
                    <span className="font-medium text-base">
                      <span className="text-red-600 dark:text-red-500">{transfer.debtorName}</span>
                      {" pays "}
                      <span className="text-green-600 dark:text-green-500">{transfer.creditorName}</span>
                    </span>
                  </div>
                  <span className="font-mono font-bold text-lg">
                    {currency} {transfer.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between pt-6 border-t mt-6">
            <Button variant="outline" onClick={onBack} size="lg">
              Back
            </Button>
            {canFinalize ? (
              <Button onClick={onFinalize} size="lg" className="min-w-[160px]">
                Finalize Session
              </Button>
            ) : (
              <Button onClick={onNext} size="lg" className="min-w-[140px]">
                Go to Share
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Step 5: Share
function ShareStep({
  session,
  players,
  sessionId,
  settlementTransfers,
  isFinalized,
  copiedSummary,
  copiedLink,
  onCopySummary,
  onCopyLink,
  onBack,
}: {
  session: Session
  players: Player[]
  sessionId: string
  settlementTransfers: Transfer[]
  isFinalized: boolean
  copiedSummary: boolean
  copiedLink: boolean
  onCopySummary: () => void
  onCopyLink: () => void
  onBack: () => void
}) {
  const router = useRouter()
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Share Session</CardTitle>
        <CardDescription className="mt-1">
          Share the finalized session results with players
        </CardDescription>
      </CardHeader>
        <CardContent className="space-y-4">
          {isFinalized ? (
            <div className="space-y-3">
              <Button
                onClick={onCopySummary}
                variant={copiedSummary ? "default" : "outline"}
                className="w-full h-12 text-base"
                size="lg"
              >
                {copiedSummary ? (
                  <>
                    <Check className="mr-2 h-5 w-5" />
                    Summary Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-5 w-5" />
                    Copy Settlement Summary
                  </>
                )}
              </Button>
              <Button
                onClick={onCopyLink}
                variant={copiedLink ? "default" : "outline"}
                className="w-full h-12 text-base"
                size="lg"
              >
                {copiedLink ? (
                  <>
                    <Check className="mr-2 h-5 w-5" />
                    Link Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-5 w-5" />
                    Copy Shareable Link
                  </>
                )}
              </Button>
              <div className="pt-4 mt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  The settlement summary includes all player results and payment instructions.
                  The shareable link allows others to view this session.
                </p>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center space-y-3">
              <div className="text-4xl">🔒</div>
              <div className="space-y-1">
                <p className="text-base font-medium text-foreground">
                  Session Not Finalized
                </p>
                <p className="text-sm text-muted-foreground">
                  Please finalize the session from the Results step to enable sharing.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-6 border-t mt-6">
            <Button variant="outline" onClick={onBack} size="lg">
              Back
            </Button>
            <Button 
              variant="default" 
              onClick={() => router.push("/")} 
              size="lg"
            >
              Back to Home
            </Button>
          </div>
        </CardContent>
    </Card>
  )
}

// Players Table Component
function PlayersTable({
  players,
  playerResults,
  currency,
  isFinalized,
  currentPhase,
  user,
  userAlreadyLinked,
  onRowClick,
  onAddPlayerClick,
  onLinkIdentity,
}: {
  players: Player[]
  playerResults: Array<{
    player: Player
    totalBuyins: number
    totalCashouts: number
    pl: number
  }>
  currency: string
  isFinalized: boolean
  currentPhase: "active_game" | "chip_entry" | "ready_to_finalize" | "finalized"
  user: { id: string; email?: string } | null
  userAlreadyLinked: boolean
  onRowClick: (playerId: string) => void
  onAddPlayerClick: () => void
  onLinkIdentity: (playerId: string) => void
}) {
  // Phase-aware display logic helper
  const getPhaseDisplay = (result: typeof playerResults[0]) => {
    const showCashouts = currentPhase !== "active_game" || result.totalCashouts > 0
    const showPL = currentPhase !== "active_game" || result.totalCashouts > 0
    const isEditable = !isFinalized && (
      currentPhase === "active_game" ||
      currentPhase === "chip_entry" ||
      currentPhase === "ready_to_finalize"
    )
    return { showCashouts, showPL, isEditable }
  }

  const getPLColor = (pl: number, showPL: boolean) => {
    if (!showPL) return "text-muted-foreground/50"
    if (pl > 0.01) return "text-green-600 dark:text-green-500"
    if (pl < -0.01) return "text-red-600 dark:text-red-500"
    return "text-muted-foreground"
  }

  return (
    <div className="space-y-4">
      {/* Players Table - Desktop */}
      {players.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <div className="text-4xl">👥</div>
              <div className="space-y-1">
                <p className="text-base font-medium text-foreground">
                  No players yet
                </p>
                <p className="text-sm text-muted-foreground">
                  {isFinalized 
                    ? "This session has been finalized."
                    : "Add a player to get started."}
                </p>
              </div>
              {/* Mobile: Inline Add Player button as backup */}
              {!isFinalized && (
                <div className="md:hidden pt-2">
                  <Button
                    onClick={onAddPlayerClick}
                    size="lg"
                    className="gap-2"
                  >
                    <Plus className="h-5 w-5" />
                    Add Player
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: Card List View */}
          <div className="md:hidden space-y-3 pb-4">
            {playerResults.map((result) => {
              const { showCashouts, showPL, isEditable } = getPhaseDisplay(result)
              const plColor = getPLColor(result.pl, showPL)
              
              return (
                <Card
                  key={result.player.id}
                  className={cn(
                    "shadow-sm",
                    isEditable && "cursor-pointer hover:bg-muted/50"
                  )}
                  onClick={() => isEditable && onRowClick(result.player.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: Player Name */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-base truncate">{result.player.name}</p>
                          {user && result.player.profileId === user.id && (
                            <span className="text-xs text-muted-foreground shrink-0">(You)</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Buy-ins: {currency} {result.totalBuyins.toFixed(2)} | Cash-outs: {showCashouts ? `${currency} ${result.totalCashouts.toFixed(2)}` : "—"}
                        </p>
                      </div>
                      {/* Right: P/L */}
                      <div className="text-right shrink-0">
                        <p className={cn("text-xl font-bold font-mono", plColor)}>
                          {showPL 
                            ? `${result.pl > 0 ? "+" : ""}${currency} ${result.pl.toFixed(2)}`
                            : "—"}
                        </p>
                      </div>
                    </div>
                    {/* Actions row */}
                    {isEditable && (
                      <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t" onClick={(e) => e.stopPropagation()}>
                        {user && !isFinalized && !result.player.profileId && !userAlreadyLinked && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              onLinkIdentity(result.player.id)
                            }}
                            className="h-8 text-xs"
                          >
                            This is me
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRowClick(result.player.id)}
                          className="h-8"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Desktop: Table View */}
          <Card className="hidden md:block shadow-sm">
          <CardContent className="p-0">
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">Player</TableHead>
                    <TableHead className="text-right font-semibold">Buy-ins</TableHead>
                    <TableHead className="text-right font-semibold">Cash-outs</TableHead>
                    <TableHead className="text-right font-semibold">Profit / Loss</TableHead>
                    {!isFinalized && (
                      <TableHead className="text-right font-semibold w-[100px]">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {playerResults.map((result) => {
                      const { showCashouts, showPL, isEditable } = getPhaseDisplay(result)
                      const plColor = getPLColor(result.pl, showPL)
                    
                    return (
                      <TableRow
                        key={result.player.id}
                        className={cn(
                          "hover:bg-muted/50",
                          isEditable && "cursor-pointer"
                        )}
                        onClick={() => isEditable && onRowClick(result.player.id)}
                      >
                        <TableCell className="font-medium text-base">
                          <div className="flex items-center gap-2">
                            <span>{result.player.name}</span>
                            {user && result.player.profileId === user.id && (
                              <span className="text-xs text-muted-foreground">(You)</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-base">
                          {currency} {result.totalBuyins.toFixed(2)}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-mono text-base",
                          !showCashouts && "text-muted-foreground/50"
                        )}>
                          {showCashouts 
                            ? `${currency} ${result.totalCashouts.toFixed(2)}`
                            : currentPhase === "active_game" ? "—" : `${currency} ${result.totalCashouts.toFixed(2)}`}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-mono text-lg font-semibold",
                            plColor
                        )}>
                          {showPL 
                            ? `${result.pl > 0 ? "+" : ""}${currency} ${result.pl.toFixed(2)}`
                            : currentPhase === "active_game" ? "Pending cash-outs" : `${result.pl > 0 ? "+" : ""}${currency} ${result.pl.toFixed(2)}`}
                        </TableCell>
                        {isEditable && (
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              {user && !isFinalized && !result.player.profileId && !userAlreadyLinked && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onLinkIdentity(result.player.id)
                                  }}
                                  className="h-8 text-xs"
                                >
                                  This is me
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onRowClick(result.player.id)}
                                className="h-8"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                        {!isEditable && !isFinalized && (
                          <TableCell className="text-right w-[100px]"></TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        </>
      )}
    </div>
  )
}


// Edit Player Dialog (used for both editing and adding)
function EditPlayerDialog({
  player,
  sessionId,
  clubId,
  currency,
  isFinalized,
  transactions,
  playerName,
  setPlayerName,
  isAddingPlayer,
  currentPhase,
  onAddPlayer,
  onTransactionUpdate,
  onClose,
}: {
  player: Player | null
  sessionId: string
  clubId: string
  currency: string
  isFinalized: boolean
  transactions: Transaction[]
  playerName: string
  setPlayerName: (name: string) => void
  isAddingPlayer: boolean
  currentPhase: "active_game" | "chip_entry" | "ready_to_finalize" | "finalized"
  onAddPlayer: (e: React.FormEvent<HTMLFormElement>) => void
  onTransactionUpdate?: () => void
  onClose: () => void
}) {
  const isDesktop = useIsDesktop()
  const isNewPlayer = !player
  
  // State for editing player name
  const [editingPlayerName, setEditingPlayerName] = useState(player?.name || "")
  const [isSavingPlayerName, setIsSavingPlayerName] = useState(false)
  const [playerError, setPlayerError] = useState<string | null>(null)
  
  // State for editing buy-ins
  const [editingBuyinId, setEditingBuyinId] = useState<string | null>(null)
  const [editBuyinAmount, setEditBuyinAmount] = useState("")
  const [isSavingBuyinEdit, setIsSavingBuyinEdit] = useState(false)

  // Sync player name when player prop changes
  useEffect(() => {
    if (player) {
      setEditingPlayerName(player.name)
    }
  }, [player?.id, player?.name])
  
  // State for new transaction inputs
  const [buyinAmount, setBuyinAmount] = useState("")
  const [cashoutAmount, setCashoutAmount] = useState("")
  const [isAddingBuyin, setIsAddingBuyin] = useState(false)
  const [isAddingCashout, setIsAddingCashout] = useState(false)
  
  // Calculate current totals for existing player
  const buyins = player
    ? transactions.filter((t) => t.sessionId === sessionId && t.playerId === player.id && t.type === "buyin")
    : []
  const cashouts = player
    ? transactions.filter((t) => t.sessionId === sessionId && t.playerId === player.id && t.type === "cashout")
    : []
  const totalBuyins = buyins.reduce((sum, t) => sum + t.amount, 0)
  const totalCashouts = cashouts.reduce((sum, t) => sum + t.amount, 0)
  const currentPL = totalCashouts - totalBuyins
  
  // Calculate preview P/L (current + pending inputs)
  const pendingBuyin = parseFloat(buyinAmount) || 0
  const pendingCashout = parseFloat(cashoutAmount) || 0
  const previewBuyins = totalBuyins + pendingBuyin
  const previewCashouts = totalCashouts + pendingCashout
  const previewPL = previewCashouts - previewBuyins
  
  const plColor =
    currentPL > 0.01
      ? "text-green-600 dark:text-green-500"
      : currentPL < -0.01
      ? "text-red-600 dark:text-red-500"
      : "text-muted-foreground"
  
  const previewPLColor =
    previewPL > 0.01
      ? "text-green-600 dark:text-green-500"
      : previewPL < -0.01
      ? "text-red-600 dark:text-red-500"
      : "text-muted-foreground"

  // Handle updating player name
  const handleUpdatePlayerName = async () => {
    if (!player || !editingPlayerName.trim() || editingPlayerName === player.name) return
    
    setPlayerError(null)
    setIsSavingPlayerName(true)
    try {
      const { error } = await supabase
        .from("players")
        .update({ name: editingPlayerName.trim() })
        .eq("id", player.id)
      
      if (error) {
        console.error("Error updating player name:", error)
        setPlayerError(`Failed to update player name: ${error.message}`)
        // Reset to original name on error
        setEditingPlayerName(player.name)
      } else {
        setPlayerError(null)
        // Reload players to reflect the change
        onTransactionUpdate?.()
      }
    } catch (err) {
      console.error("Unexpected error updating player name:", err)
      setPlayerError("Failed to update player name. Please try again.")
      // Reset to original name on error
      if (player) {
        setEditingPlayerName(player.name)
      }
    } finally {
      setIsSavingPlayerName(false)
    }
  }

  // Handle editing buy-in amount
  const handleStartEditBuyin = (buyin: Transaction) => {
    setEditingBuyinId(buyin.id)
    setEditBuyinAmount(buyin.amount.toString())
  }

  const handleCancelEditBuyin = () => {
    setEditingBuyinId(null)
    setEditBuyinAmount("")
  }

  const handleSaveBuyinEdit = async (buyinId: string) => {
    const amount = parseFloat(editBuyinAmount)
    if (isNaN(amount) || amount <= 0) return

    setPlayerError(null)
    setIsSavingBuyinEdit(true)
    try {
      const { error } = await supabase
        .from("transactions")
        .update({ amount: amount })
        .eq("id", buyinId)
        .select()

      if (error) {
        console.error("Error updating buy-in:", error)
        setPlayerError(`Failed to update buy-in: ${error.message}`)
      } else {
        setPlayerError(null)
        setEditingBuyinId(null)
        setEditBuyinAmount("")
        onTransactionUpdate?.()
      }
    } catch (err) {
      console.error("Unexpected error updating buy-in:", err)
      setPlayerError("Failed to update buy-in. Please try again.")
    } finally {
      setIsSavingBuyinEdit(false)
    }
  }

  // Handle adding buy-in (reusing logic from PlayerBuyinForm)
  // Core function to add buy-in (can be called from form or handleSave)
  const addBuyinTransaction = async (amount: number): Promise<boolean> => {
    if (!player) return false

    setIsAddingBuyin(true)
    const transactionId = generateUUID()

    try {
      if (!clubId) {
        console.error("Error: clubId is required for transaction insert")
        setIsAddingBuyin(false)
        return false
      }

      const { error } = await supabase
        .from("transactions")
        .insert({
          id: transactionId,
          session_id: sessionId,
          club_id: clubId,
          player_id: player.id,
          type: "buyin",
          amount: amount
        })

      if (error) {
        console.error("Error adding buy-in:", error)
        setIsAddingBuyin(false)
        return false
      }

      setBuyinAmount("")
      onTransactionUpdate?.()
      return true
    } catch (err) {
      console.error("Unexpected error adding buy-in:", err)
      return false
    } finally {
      setIsAddingBuyin(false)
    }
  }

  const handleAddBuyin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const amount = parseFloat(buyinAmount)
    if (isNaN(amount) || amount <= 0) return

    const success = await addBuyinTransaction(amount)
    
    // Close dialog after successful add (Enter key behavior)
    if (success) {
      setTimeout(() => {
        onClose()
      }, 300)
    }
  }

  // Core function to add cash-out (can be called from form or handleSave)
  const addCashoutTransaction = async (amount: number): Promise<boolean> => {
    if (!player) return false

    setIsAddingCashout(true)
    const transactionId = generateUUID()

    try {
      if (!clubId) {
        console.error("Error: clubId is required for transaction insert")
        setIsAddingCashout(false)
        return false
      }

      const { error } = await supabase
        .from("transactions")
        .insert({
          id: transactionId,
          session_id: sessionId,
          club_id: clubId,
          player_id: player.id,
          type: "cashout",
          amount: amount
        })

      if (error) {
        console.error("Error adding cash-out:", error)
        setIsAddingCashout(false)
        return false
      }

      setCashoutAmount("")
      onTransactionUpdate?.()
      return true
    } catch (err) {
      console.error("Unexpected error adding cash-out:", err)
      return false
    } finally {
      setIsAddingCashout(false)
    }
  }

  // Handle adding cash-out (reusing logic from PlayerCashoutForm)
  const handleAddCashout = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const amount = parseFloat(cashoutAmount)
    if (isNaN(amount) || amount < 0) return

    await addCashoutTransaction(amount)
  }

  const handleSave = async () => {
    if (isNewPlayer) {
      // For new player, the form submission is handled by onAddPlayer
      onClose()
      return
    }

    // For existing player: auto-add pending buy-in and cash-out before closing
    if (buyinAmount && buyinAmount.trim() !== "") {
      const pendingBuyin = parseFloat(buyinAmount)
      const hasValidBuyin = !isNaN(pendingBuyin) && pendingBuyin > 0.01
      if (hasValidBuyin && !isAddingBuyin) {
        await addBuyinTransaction(pendingBuyin)
      }
    }

    if (cashoutAmount && cashoutAmount.trim() !== "") {
      const pendingCashout = parseFloat(cashoutAmount)
      const hasValidCashout = !isNaN(pendingCashout) && pendingCashout >= 0
      if (hasValidCashout && !isAddingCashout) {
        await addCashoutTransaction(pendingCashout)
      }
    }

    // Close dialog after processing pending transactions
    onClose()
  }

  return (
    <Dialog open={true} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent 
        className="!flex !flex-col p-0 gap-0 !max-h-[90vh] md:!max-w-lg md:!max-h-[85vh] md:p-6 md:gap-4 md:rounded-lg !bottom-0 !left-0 !right-0 !top-auto !translate-y-0 rounded-t-lg rounded-b-none md:!left-[50%] md:!top-[50%] md:!right-auto md:!bottom-auto md:!translate-x-[-50%] md:!translate-y-[-50%] md:!rounded-lg"
        onOpenAutoFocus={(e) => {
          if (!isDesktop) {
            e.preventDefault()
          }
        }}
      >
        {/* Header - Fixed with Clear Title */}
        <div className="flex-shrink-0 px-4 pt-5 pb-3 border-b md:border-b-0 md:p-0 md:pb-0">
          <DialogHeader className="md:text-left">
            <DialogTitle className="text-xl md:text-lg font-semibold">
              {isNewPlayer ? "Add Player" : "Edit Player"}
            </DialogTitle>
            <DialogDescription className="text-sm mt-1.5 text-muted-foreground md:mt-0">
              {isNewPlayer ? "Enter the player name" : "Update player details and transactions"}
            </DialogDescription>
          </DialogHeader>
        </div>
        
        {/* Content - Scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 md:flex-none md:min-h-auto md:p-0 md:space-y-6">
          {/* Error Display */}
          {playerError && (
            <Alert className="border-destructive bg-destructive/10 text-destructive">
              <AlertDescription>{playerError}</AlertDescription>
            </Alert>
          )}
          {/* Player Name Input - At the top for better focus */}
            {isNewPlayer ? (
            <div className="space-y-2">
              <label htmlFor="player-name-input" className="text-sm font-semibold block text-foreground">
                Player Name
              </label>
              <Input
                id="player-name-input"
                type="text"
                placeholder="Enter player name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                required
                disabled={isAddingPlayer}
                className="h-12 md:h-10 text-base md:text-sm"
                autoFocus={isDesktop}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && playerName.trim() && !isAddingPlayer) {
                    e.preventDefault()
                    onAddPlayer(e as any)
                    if (playerName.trim()) {
                      setTimeout(() => onClose(), 100)
                    }
                  }
                }}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label htmlFor="edit-player-name-input" className="text-sm font-semibold block text-foreground">
                Player Name
              </label>
              <Input
                id="edit-player-name-input"
                type="text"
                value={editingPlayerName}
                onChange={(e) => setEditingPlayerName(e.target.value)}
                disabled={isSavingPlayerName || isFinalized}
                className="h-12 md:h-10 text-base md:text-sm"
                onBlur={handleUpdatePlayerName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur()
                    handleUpdatePlayerName()
                  }
                }}
              />
            </div>
            )}
          {/* Financial Snapshot (Read-Only) */}
          {player && (
            <div className="space-y-3 py-3 border-b md:py-4">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Current Status</p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Buy-ins:</span>
                  <span className="text-sm font-mono font-medium">{currency} {totalBuyins.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Cash-outs:</span>
                  <span className="text-sm font-mono font-medium">{currency} {totalCashouts.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-sm font-medium">Profit/Loss:</span>
                  <span className={cn("text-base font-mono font-semibold", plColor)}>
                    {currentPL > 0 ? "+" : ""}
                    {currency} {currentPL.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Update Section - Phase-Aware */}
          {player && !isFinalized && (
            <div className="space-y-4 py-3 border-b md:py-4">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3 md:mb-4">Update Amounts</p>
              
              {/* Existing Buy-ins List - Available in Active Game and Ready to Finalize phases */}
              {(currentPhase === "active_game" || currentPhase === "ready_to_finalize") && buyins.length > 0 && (
                <div className="space-y-2 mb-4">
                  <p className="text-xs font-medium text-muted-foreground">Existing Buy-ins:</p>
                  {buyins.map((buyin) => (
                    <div key={buyin.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded border">
                      {editingBuyinId === buyin.id ? (
                        <>
                          <Input
                            type="number"
                            value={editBuyinAmount}
                            onChange={(e) => setEditBuyinAmount(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSaveBuyinEdit(buyin.id)
                              } else if (e.key === "Escape") {
                                handleCancelEditBuyin()
                              }
                            }}
                            min="0.01"
                            step="0.01"
                            className="flex-1 h-8 text-sm"
                            autoFocus={isDesktop}
                            disabled={isSavingBuyinEdit}
                          />
                          <Button
                            onClick={() => handleSaveBuyinEdit(buyin.id)}
                            size="sm"
                            disabled={isSavingBuyinEdit}
                            className="h-8 px-2"
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            onClick={handleCancelEditBuyin}
                            size="sm"
                            variant="ghost"
                            disabled={isSavingBuyinEdit}
                            className="h-8 px-2"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm font-mono">{currency} {buyin.amount.toFixed(2)}</span>
                          <Button
                            onClick={() => handleStartEditBuyin(buyin)}
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Add Buy-in - Available in Active Game and Ready to Finalize phases */}
              {(currentPhase === "active_game" || currentPhase === "ready_to_finalize") && (
                <form onSubmit={handleAddBuyin} className="flex items-center gap-2">
                  <span className="text-sm font-medium w-24">Add Buy-in</span>
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={buyinAmount}
                    onChange={(e) => setBuyinAmount(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isAddingBuyin && buyinAmount) {
                        // Form submission will handle it
                      }
                    }}
                    min="0.01"
                    step="0.01"
                    required
                    disabled={isAddingBuyin}
                    className="flex-1"
                    autoFocus={isDesktop && !isNewPlayer}
                  />
                  <Button type="submit" size="sm" disabled={isAddingBuyin}>
                    {isAddingBuyin ? "..." : "+"}
                  </Button>
                </form>
              )}
              
              {currentPhase === "active_game" && (
                <p className="text-xs text-muted-foreground italic">
                  Cash-outs will be available when you start chip entry
                </p>
              )}

              {/* Add Cash-out - Available in Chip Entry and Ready to Finalize phases */}
              {(currentPhase === "chip_entry" || currentPhase === "ready_to_finalize") && (
                <>
                  {currentPhase === "chip_entry" && (
                    <div className="text-xs text-muted-foreground mb-2 italic">
                      Buy-ins are locked during chip entry
                    </div>
                  )}
                  <form onSubmit={handleAddCashout} className="flex items-center gap-2">
                    <span className="text-sm font-medium w-24">Add Cash-out</span>
                    <Input
                      type="number"
                      placeholder="Final chip count"
                      value={cashoutAmount}
                      onChange={(e) => setCashoutAmount(e.target.value)}
                      min="0"
                      step="0.01"
                      required
                      disabled={isAddingCashout}
                      className="flex-1"
                    />
                    <Button type="submit" size="sm" disabled={isAddingCashout}>
                      {isAddingCashout ? "..." : "+"}
                    </Button>
                  </form>
                </>
              )}

              {/* Read-only message - Only in Finalized phase */}
              {currentPhase === "finalized" && (
                <p className="text-xs text-muted-foreground italic">
                  This session has been finalized and cannot be modified.
                </p>
              )}
            </div>
          )}

          {/* Live Result Preview - Only show in appropriate phases */}
          {player && !isFinalized && (pendingBuyin > 0 || pendingCashout > 0) && (
            <div className="py-3 border-b md:py-4">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">Result After Save</p>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Profit / Loss:</span>
                <span className={cn("text-2xl font-mono font-semibold", previewPLColor)}>
                  {previewPL > 0 ? "+" : ""}
                  {currency} {previewPL.toFixed(2)}
                </span>
              </div>
            </div>
          )}
          
          {/* Show current P/L in Chip Entry phase even without pending inputs */}
          {player && currentPhase === "chip_entry" && pendingBuyin === 0 && pendingCashout === 0 && (
            <div className="py-3 border-b md:py-4">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">Current Result</p>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Profit / Loss:</span>
                <span className={cn("text-2xl font-mono font-semibold", plColor)}>
                  {currentPL > 0 ? "+" : ""}
                  {currency} {currentPL.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Dialog Footer - Fixed at bottom on mobile with improved hierarchy */}
        <div className="flex-shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 border-t bg-background md:border-t-0 md:bg-transparent md:p-0 md:pt-4 md:pb-0">
          <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end md:gap-2">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={isAddingPlayer || isAddingBuyin || isAddingCashout}
              className="h-11 md:h-10 order-2 md:order-1 text-base md:text-sm text-muted-foreground hover:text-foreground"
            >
            Cancel
          </Button>
          {isNewPlayer ? (
            <form
              onSubmit={(e) => {
                onAddPlayer(e)
                if (!isAddingPlayer && playerName.trim()) {
                  setTimeout(() => onClose(), 100)
                }
              }}
                className="w-full md:w-auto order-1 md:order-2"
            >
              <Button
                type="submit"
                disabled={isAddingPlayer || !playerName.trim()}
                  className="w-full h-12 md:h-10 md:min-w-[140px] text-base md:text-sm font-medium"
              >
                {isAddingPlayer ? "Adding..." : "Save Changes"}
              </Button>
            </form>
          ) : (
              <Button
                onClick={handleSave}
                disabled={isAddingBuyin || isAddingCashout}
                className="w-full h-12 md:h-10 md:min-w-[140px] text-base md:text-sm font-medium order-1 md:order-2"
              >
              Save Changes
            </Button>
          )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Fixed Buy-in Dialog Component
function FixedBuyinDialog({
  open,
  onConfirm,
  onSkip,
  currency,
}: {
  open: boolean
  onConfirm: (amount: number) => void
  onSkip: () => void
  currency: string
}) {
  const isDesktop = useIsDesktop()
  const [amount, setAmount] = useState("")
  
  return (
    <Dialog open={open} onOpenChange={(open: boolean) => !open && onSkip()}>
      <DialogContent 
        className="!flex !flex-col p-0 gap-0 !max-h-[90vh] md:!max-w-lg md:!max-h-[85vh] md:p-6 md:gap-4 md:rounded-lg !bottom-0 !left-0 !right-0 !top-auto !translate-y-0 rounded-t-lg rounded-b-none md:!left-[50%] md:!top-[50%] md:!right-auto md:!bottom-auto md:!translate-x-[-50%] md:!translate-y-[-50%] md:!rounded-lg"
        onOpenAutoFocus={(e) => {
          if (!isDesktop) {
            e.preventDefault()
          }
        }}
      >
        <div className="flex flex-col h-full min-h-0">
          {/* Mobile: Fixed Header */}
          <div className="flex-shrink-0 px-4 pt-5 pb-4 border-b md:border-b-0 md:p-0 md:pb-0">
            <DialogHeader className="md:text-left pb-0">
              <DialogTitle className="text-xl md:text-lg font-semibold">Set Fixed Buy-in</DialogTitle>
              <DialogDescription className="text-sm mt-1.5 text-muted-foreground md:mt-0">
            Is there a fixed buy-in amount for all players in this game?
          </DialogDescription>
        </DialogHeader>
          </div>

          {/* Mobile: Scrollable Content */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 md:flex-none md:min-h-auto md:overflow-visible md:p-0 md:py-4">
          <Input
            type="number"
            placeholder={`Amount (${currency})`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="0.01"
            step="0.01"
            onKeyDown={(e) => {
              if (e.key === "Enter" && amount) {
                const numAmount = parseFloat(amount)
                if (!isNaN(numAmount) && numAmount > 0) {
                  onConfirm(numAmount)
                }
              } else if (e.key === "Escape") {
                onSkip()
              }
            }}
            autoFocus={isDesktop}
            className="h-12 md:h-10 text-base md:text-sm"
            />
          </div>

          {/* Mobile: Fixed Action Footer */}
          <div className="flex-shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 border-t bg-background md:border-t-0 md:bg-transparent md:p-0 md:pt-4 md:pb-0">
            <div className="flex flex-col-reverse gap-2 md:flex-row md:gap-3 md:justify-end">
              <Button
                variant="ghost"
                onClick={onSkip}
                className="h-11 md:h-10 order-2 md:order-first text-base md:text-sm text-muted-foreground hover:text-foreground w-full md:w-auto"
                size="lg"
              >
              No, skip
            </Button>
            <Button
              onClick={() => {
                const numAmount = parseFloat(amount)
                if (!isNaN(numAmount) && numAmount > 0) {
                  onConfirm(numAmount)
                }
              }}
              disabled={!amount || parseFloat(amount) <= 0}
                className="h-12 md:h-10 order-1 md:order-last text-base md:text-sm font-medium w-full md:w-auto"
                size="lg"
            >
              Yes, set fixed buy-in
            </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Share Results Dialog Component
function ShareResultsDialog({
  summary,
  copied,
  onCopy,
  onClose,
}: {
  summary: string
  copied: boolean
  onCopy: () => void
  onClose: () => void
}) {
  const isDesktop = useIsDesktop()
  
  return (
    <Dialog open={true} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent 
        className="!flex !flex-col p-0 gap-0 !max-h-[90vh] md:!max-w-2xl md:!max-h-[85vh] md:p-6 md:gap-4 md:rounded-lg !bottom-0 !left-0 !right-0 !top-auto !translate-y-0 rounded-t-lg rounded-b-none md:!left-[50%] md:!top-[50%] md:!right-auto md:!bottom-auto md:!translate-x-[-50%] md:!translate-y-[-50%] md:!rounded-lg"
        onOpenAutoFocus={(e) => {
          if (!isDesktop) {
            e.preventDefault()
          }
        }}
      >
        <div className="flex flex-col h-full min-h-0">
          {/* Mobile: Fixed Header */}
          <div className="flex-shrink-0 px-4 pt-5 pb-4 border-b md:border-b-0 md:p-0 md:pb-0">
            <DialogHeader className="md:text-left">
              <DialogTitle className="text-xl md:text-lg font-semibold">Share Game Results</DialogTitle>
        </DialogHeader>
          </div>

          {/* Mobile: Scrollable Content */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 md:flex-none md:min-h-auto md:overflow-visible md:p-0 md:py-4">
            <div className="bg-muted/50 rounded-lg p-4 md:p-6 border">
            <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
              {summary}
            </pre>
          </div>
        </div>

          {/* Mobile: Fixed Action Footer */}
          <div className="flex-shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 border-t bg-background md:border-t-0 md:bg-transparent md:p-0 md:pt-4 md:pb-0">
            <div className="flex justify-center">
          <Button
            onClick={onCopy}
            size="lg"
                className="w-full h-12 md:h-10 md:min-w-[200px] text-base md:text-sm font-medium"
          >
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Copied to Clipboard!
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy to Clipboard
              </>
            )}
          </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Player Buy-in Form Component
function PlayerBuyinForm({
  player,
  sessionId,
  currency,
  isFinalized,
  transactions,
  onTransactionUpdate,
}: {
  player: Player
  sessionId: string
  currency: string
  isFinalized: boolean
  transactions: Transaction[]
  onTransactionUpdate?: () => void
}) {
  const [buyinAmount, setBuyinAmount] = useState("")
  const [isAddingBuyin, setIsAddingBuyin] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [editingBuyinId, setEditingBuyinId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState("")
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Get buyins for this player from transactions
  const buyins = transactions.filter(
    (t) => t.sessionId === sessionId && t.playerId === player.id && t.type === "buyin"
  )

  useEffect(() => {
    // Auto-expand history if there are buy-ins
    if (buyins.length > 0) {
      setIsHistoryOpen(true)
    }
  }, [buyins.length])

  const totalBuyins = buyins.reduce((sum, buyin) => sum + buyin.amount, 0)

  const handleAddBuyin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    // DEBUG: Confirm handler execution
    console.log("🔵 [DEBUG] Add Buy-in handler executed")
    
    const amount = parseFloat(buyinAmount)
    if (isNaN(amount) || amount <= 0) {
      console.log("🔴 [DEBUG] Validation failed: invalid amount")
      return
    }

    setIsAddingBuyin(true)

    // DEBUG: Generate UUID v4 for transaction ID
    const transactionId = generateUUID()

    // DEBUG: Log values before insert
    console.log("🔵 [DEBUG] Buy-in values prepared:", {
      id: transactionId,
      session_id: sessionId,
      player_id: player.id,
      type: "buyin",
      amount: amount,
      isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(transactionId)
    })

    try {
      // DEBUG: Supabase insert with full logging
      console.log("🔵 [DEBUG] Attempting Supabase buy-in insert...")
      
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          id: transactionId,
          session_id: sessionId,
          player_id: player.id,
          type: "buyin",
          amount: amount
        })
        .select()

      // DEBUG: Log both data and error
      console.log("🔵 [DEBUG] Supabase buy-in insert response:", {
        data: data,
        error: error,
        hasData: !!data,
        hasError: !!error
      })

      if (error) {
        console.error("🔴 [DEBUG] Supabase buy-in insert ERROR:", error)
        console.error("🔴 [DEBUG] Error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        setIsAddingBuyin(false)
        return
      }

      if (data && data.length > 0) {
        console.log("✅ [DEBUG] Supabase buy-in insert SUCCESS:", data[0])
      } else {
        console.warn("⚠️ [DEBUG] Supabase buy-in insert returned no data")
      }

      // DEBUG: Confirm completion
      console.log("🔵 [DEBUG] Supabase Add Buy-in attempt finished")

      setBuyinAmount("")
      onTransactionUpdate?.()
    } catch (err) {
      console.error("🔴 [DEBUG] Unexpected error during Supabase buy-in insert:", err)
    } finally {
      setIsAddingBuyin(false)
    }
  }

  const handleStartEdit = (buyin: Transaction) => {
    setEditingBuyinId(buyin.id)
    setEditAmount(buyin.amount.toString())
  }

  const handleCancelEdit = () => {
    setEditingBuyinId(null)
    setEditAmount("")
  }

  const handleSaveEdit = async (buyinId: string) => {
    const amount = parseFloat(editAmount)
    if (isNaN(amount) || amount <= 0) return

    setIsSavingEdit(true)
    const buyin = buyins.find((b) => b.id === buyinId)
    if (buyin) {
      // DEBUG: Update transaction in Supabase
      console.log("🔵 [DEBUG] Attempting Supabase buy-in update:", {
        id: buyinId,
        amount: amount
      })

      try {
        const { data, error } = await supabase
          .from("transactions")
          .update({ amount: amount })
          .eq("id", buyinId)
          .select()

        console.log("🔵 [DEBUG] Supabase buy-in update response:", {
          data: data,
          error: error
        })

        if (error) {
          console.error("🔴 [DEBUG] Supabase buy-in update ERROR:", error)
        } else if (data && data.length > 0) {
          console.log("✅ [DEBUG] Supabase buy-in update SUCCESS:", data[0])
        }

        onTransactionUpdate?.()
      } catch (err) {
        console.error("🔴 [DEBUG] Unexpected error during Supabase buy-in update:", err)
      }
    }
    setEditingBuyinId(null)
    setEditAmount("")
    setIsSavingEdit(false)
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  return (
    <div className="space-y-4 p-5 border rounded-lg bg-card hover:bg-muted/30 transition-colors">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-base">{player.name}</h3>
        <div className="text-right">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Buy-ins</p>
          <p className="text-lg font-bold font-mono">{currency} {totalBuyins.toFixed(2)}</p>
        </div>
      </div>
      {!isFinalized && (
        <form onSubmit={handleAddBuyin} className="flex gap-2">
          <Input
            type="number"
            placeholder="Amount"
            value={buyinAmount}
            onChange={(e) => setBuyinAmount(e.target.value)}
            min="0.01"
            step="0.01"
            required
            className="max-w-xs"
          />
          <Button type="submit" size="sm" disabled={isAddingBuyin}>
            Add Buy-in
          </Button>
        </form>
      )}
      {buyins.length > 0 && (
        <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full">
              {isHistoryOpen ? (
                <>
                  <ChevronDown className="mr-2 h-4 w-4" />
                  Hide History
                </>
              ) : (
                <>
                  <ChevronRight className="mr-2 h-4 w-4" />
                  Show History ({buyins.length})
                </>
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-1">
              {buyins.map((buyin) => (
                <div
                  key={buyin.id}
                  className="flex items-center justify-between text-sm py-2 px-2 bg-muted rounded gap-2"
                >
                  {editingBuyinId === buyin.id ? (
                    <>
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          min="0.01"
                          step="0.01"
                          className="h-8 text-sm"
                          autoFocus={false}
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {currency}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSaveEdit(buyin.id)}
                          disabled={isSavingEdit}
                          className="h-7 px-2"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCancelEdit}
                          disabled={isSavingEdit}
                          className="h-7 px-2"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-1">
                        <span className="font-medium">
                          {currency} {buyin.amount.toFixed(2)}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {formatTimestamp(buyin.createdAt)}
                        </span>
                      </div>
                      {!isFinalized && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStartEdit(buyin)}
                          className="h-7 px-2"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}

// Player Cash-out Form Component
function PlayerCashoutForm({
  player,
  sessionId,
  currency,
  isFinalized,
  transactions,
  onTransactionUpdate,
}: {
  player: Player
  sessionId: string
  currency: string
  isFinalized: boolean
  transactions: Transaction[]
  onTransactionUpdate?: () => void
}) {
  const [cashoutAmount, setCashoutAmount] = useState("")
  const [isAddingCashout, setIsAddingCashout] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [editingCashoutId, setEditingCashoutId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState("")
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Get cashouts for this player from transactions
  const cashouts = transactions.filter(
    (t) => t.sessionId === sessionId && t.playerId === player.id && t.type === "cashout"
  )

  useEffect(() => {
    // Auto-expand history if there are cash-outs
    if (cashouts.length > 0) {
      setIsHistoryOpen(true)
    }
  }, [cashouts.length])

  const totalCashouts = cashouts.reduce(
    (sum, cashout) => sum + cashout.amount,
    0
  )

  const handleAddCashout = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    // DEBUG: Confirm handler execution
    console.log("🔵 [DEBUG] Add Cash-out handler executed")
    
    const amount = parseFloat(cashoutAmount)
    if (isNaN(amount) || amount < 0) {
      console.log("🔴 [DEBUG] Validation failed: invalid amount")
      return
    }

    setIsAddingCashout(true)

    // DEBUG: Generate UUID v4 for transaction ID
    const transactionId = generateUUID()

    // DEBUG: Log values before insert
    console.log("🔵 [DEBUG] Cash-out values prepared:", {
      id: transactionId,
      session_id: sessionId,
      player_id: player.id,
      type: "cashout",
      amount: amount,
      isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(transactionId)
    })

    try {
      // DEBUG: Supabase insert with full logging
      console.log("🔵 [DEBUG] Attempting Supabase cash-out insert...")
      
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          id: transactionId,
          session_id: sessionId,
          player_id: player.id,
          type: "cashout",
          amount: amount
        })
        .select()

      // DEBUG: Log both data and error
      console.log("🔵 [DEBUG] Supabase cash-out insert response:", {
        data: data,
        error: error,
        hasData: !!data,
        hasError: !!error
      })

      if (error) {
        console.error("🔴 [DEBUG] Supabase cash-out insert ERROR:", error)
        console.error("🔴 [DEBUG] Error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        setIsAddingCashout(false)
        return
      }

      if (data && data.length > 0) {
        console.log("✅ [DEBUG] Supabase cash-out insert SUCCESS:", data[0])
      } else {
        console.warn("⚠️ [DEBUG] Supabase cash-out insert returned no data")
      }

      // DEBUG: Confirm completion
      console.log("🔵 [DEBUG] Supabase Add Cash-out attempt finished")

      setCashoutAmount("")
      onTransactionUpdate?.()
    } catch (err) {
      console.error("🔴 [DEBUG] Unexpected error during Supabase cash-out insert:", err)
    } finally {
      setIsAddingCashout(false)
    }
  }

  const handleStartEdit = (cashout: Transaction) => {
    setEditingCashoutId(cashout.id)
    setEditAmount(cashout.amount.toString())
  }

  const handleCancelEdit = () => {
    setEditingCashoutId(null)
    setEditAmount("")
  }

  const handleSaveEdit = async (cashoutId: string) => {
    const amount = parseFloat(editAmount)
    if (isNaN(amount) || amount < 0) return

    setIsSavingEdit(true)
    const cashout = cashouts.find((c) => c.id === cashoutId)
    if (cashout) {
      // DEBUG: Update transaction in Supabase
      console.log("🔵 [DEBUG] Attempting Supabase cash-out update:", {
        id: cashoutId,
        amount: amount
      })

      try {
        const { data, error } = await supabase
          .from("transactions")
          .update({ amount: amount })
          .eq("id", cashoutId)
          .select()

        console.log("🔵 [DEBUG] Supabase cash-out update response:", {
          data: data,
          error: error
        })

        if (error) {
          console.error("🔴 [DEBUG] Supabase cash-out update ERROR:", error)
        } else if (data && data.length > 0) {
          console.log("✅ [DEBUG] Supabase cash-out update SUCCESS:", data[0])
        }

        onTransactionUpdate?.()
      } catch (err) {
        console.error("🔴 [DEBUG] Unexpected error during Supabase cash-out update:", err)
      }
    }
    setEditingCashoutId(null)
    setEditAmount("")
    setIsSavingEdit(false)
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  return (
    <div className="space-y-3 p-4 border rounded-lg">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{player.name}</h3>
        <span className="text-sm text-muted-foreground">
          Total: {currency} {totalCashouts.toFixed(2)}
        </span>
      </div>
      {!isFinalized && (
        <form onSubmit={handleAddCashout} className="flex gap-2">
          <Input
            type="number"
            placeholder="Amount (0 allowed)"
            value={cashoutAmount}
            onChange={(e) => setCashoutAmount(e.target.value)}
            min="0"
            step="0.01"
            required
            className="max-w-xs"
          />
          <Button type="submit" size="sm" disabled={isAddingCashout}>
            Add Cash-out
          </Button>
        </form>
      )}
      {cashouts.length > 0 && (
        <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full">
              {isHistoryOpen ? (
                <>
                  <ChevronDown className="mr-2 h-4 w-4" />
                  Hide History
                </>
              ) : (
                <>
                  <ChevronRight className="mr-2 h-4 w-4" />
                  Show History ({cashouts.length})
                </>
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-1">
              {cashouts.map((cashout) => (
                <div
                  key={cashout.id}
                  className="flex items-center justify-between text-sm py-2 px-2 bg-muted rounded gap-2"
                >
                  {editingCashoutId === cashout.id ? (
                    <>
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          min="0"
                          step="0.01"
                          className="h-8 text-sm"
                          autoFocus={false}
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {currency}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSaveEdit(cashout.id)}
                          disabled={isSavingEdit}
                          className="h-7 px-2"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCancelEdit}
                          disabled={isSavingEdit}
                          className="h-7 px-2"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-1">
                        <span className="font-medium">
                          {currency} {cashout.amount.toFixed(2)}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {formatTimestamp(cashout.createdAt)}
                        </span>
                      </div>
                      {!isFinalized && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStartEdit(cashout)}
                          className="h-7 px-2"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}
