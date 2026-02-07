import { supabase } from "@/lib/supabaseClient"
import { formatDateDDMMYYYY } from "@/lib/utils"
import type { Session } from "@/types/session"
import type { Player } from "@/types/player"
import type { Transaction } from "@/types/transaction"

export type SessionHistoryEntry = {
  sessionId: string
  date: string
  sessionName: string
  pl: number
}

export type PlayerStat = {
  profileId: string
  name: string
  totalSessions: number
  totalBuyins: number
  totalCashouts: number
  totalPL: number
  avgPL: number
  biggestWinSession: number
}

export type OverallStats = {
  totalSessions: number
  totalBuyins: number
  totalCashouts: number
  totalPL: number
}

/**
 * Load finalized sessions for the active club.
 */
export async function loadFinalizedSessions(activeClubId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("club_id", activeClubId)
    .not("finalized_at", "is", null)
    .order("finalized_at", { ascending: false })

  if (error) {
    console.error("Error loading sessions:", error)
    return []
  }

  if (!data) return []

  return data.map((s) => ({
    id: s.id,
    name: s.name,
    currency: s.currency as "USD" | "ILS" | "EUR",
    createdAt: s.created_at,
    finalizedAt: s.finalized_at || undefined,
  }))
}

/**
 * Load players for the given session IDs.
 * For Club Stats: do not pass profileId (all players).
 * For My Stats: filter is applied after aggregation in the page.
 */
export async function loadPlayers(sessionIds: string[]): Promise<Player[]> {
  if (sessionIds.length === 0) return []

  const { data, error } = await supabase
    .from("players")
    .select("*")
    .in("session_id", sessionIds)

  if (error) {
    console.error("Error loading players:", error)
    return []
  }

  if (!data) return []

  return data.map((p) => ({
    id: p.id,
    sessionId: p.session_id,
    name: p.name,
    createdAt: p.created_at,
    profileId: p.profile_id || null,
  }))
}

/**
 * Load all transactions for the given session IDs.
 */
export async function loadTransactions(sessionIds: string[]): Promise<Transaction[]> {
  if (sessionIds.length === 0) return []

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .in("session_id", sessionIds)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("Error loading transactions:", error)
    return []
  }

  if (!data) return []

  return data.map((t) => ({
    id: t.id,
    sessionId: t.session_id,
    playerId: t.player_id,
    type: t.type as "buyin" | "cashout",
    amount: parseFloat(t.amount.toString()),
    createdAt: t.created_at,
  }))
}

/**
 * Load display names for all club members via RPC.
 * Uses get_club_members_with_profiles (SECURITY DEFINER) so we can read every member's
 * display_name/email; direct profiles SELECT is restricted by RLS to the current user only.
 * Returns a Map<profileId, displayName> using priority: display_name → email username → "Unknown player"
 */
export async function loadClubMemberDisplayNames(
  activeClubId: string
): Promise<Map<string, string>> {
  const { data, error } = await supabase.rpc("get_club_members_with_profiles", {
    p_club_id: activeClubId,
  })

  if (error) {
    console.error("Error loading club members for display names:", error)
    return new Map()
  }

  const map = new Map<string, string>()
  if (!data || !Array.isArray(data)) return map

  for (const row of data as { user_id: string; display_name?: string | null; email?: string | null }[]) {
    const id = row.user_id
    const name =
      row.display_name ||
      (row.email ? row.email.split("@")[0] : null) ||
      "Unknown player"
    map.set(id, name)
  }
  return map
}

/**
 * Calculate per-player statistics aggregated by profile_id.
 * Only includes players with a profile_id (identified players).
 * Display names come from profileDisplayNames; missing IDs get "Unknown player".
 */
export function calculatePlayerStats(
  sessions: Session[],
  players: Player[],
  transactions: Transaction[],
  profileDisplayNames: Map<string, string>
): PlayerStat[] {
  const statsMap = new Map<
    string,
    {
      name: string
      totalSessions: number
      totalBuyins: number
      totalCashouts: number
      totalPL: number
      sessionPLs: number[]
    }
  >()

  for (const session of sessions) {
    const sessionPlayers = players.filter((p) => p.sessionId === session.id)
    const sessionTransactions = transactions.filter((t) => t.sessionId === session.id)

    for (const player of sessionPlayers) {
      if (!player.profileId) continue

      const playerTransactions = sessionTransactions.filter((t) => t.playerId === player.id)
      const buyins = playerTransactions
        .filter((t) => t.type === "buyin")
        .reduce((sum, t) => sum + t.amount, 0)
      const cashouts = playerTransactions
        .filter((t) => t.type === "cashout")
        .reduce((sum, t) => sum + t.amount, 0)
      const pl = cashouts - buyins

      const key = player.profileId
      const displayName = profileDisplayNames.get(key) ?? "Unknown player"
      const existing = statsMap.get(key) ?? {
        name: displayName,
        totalSessions: 0,
        totalBuyins: 0,
        totalCashouts: 0,
        totalPL: 0,
        sessionPLs: [],
      }

      statsMap.set(key, {
        name: existing.name,
        totalSessions: existing.totalSessions + 1,
        totalBuyins: existing.totalBuyins + buyins,
        totalCashouts: existing.totalCashouts + cashouts,
        totalPL: existing.totalPL + pl,
        sessionPLs: [...existing.sessionPLs, pl],
      })
    }
  }

  const statsArray: PlayerStat[] = Array.from(statsMap.entries()).map(([profileId, stat]) => ({
    profileId,
    name: stat.name,
    totalSessions: stat.totalSessions,
    totalBuyins: stat.totalBuyins,
    totalCashouts: stat.totalCashouts,
    totalPL: stat.totalPL,
    avgPL: stat.totalSessions > 0 ? stat.totalPL / stat.totalSessions : 0,
    biggestWinSession: stat.sessionPLs.length ? Math.max(...stat.sessionPLs) : 0,
  }))

  return statsArray.sort((a, b) => b.totalPL - a.totalPL)
}

/**
 * Session history for one profile: each finalized session they played, with date and P/L.
 * Sorted by date descending (most recent first). Date is display-ready DD-MM-YYYY.
 */
export function getSessionHistoryForProfile(
  sessions: Session[],
  players: Player[],
  transactions: Transaction[],
  profileId: string
): SessionHistoryEntry[] {
  const sessionMap = new Map(sessions.map((s) => [s.id, s]))
  const profilePlayers = players.filter((p) => p.profileId === profileId)
  const entries: SessionHistoryEntry[] = []

  for (const player of profilePlayers) {
    const session = sessionMap.get(player.sessionId)
    if (!session) continue

    const sessionTransactions = transactions.filter((t) => t.sessionId === session.id)
    const playerTransactions = sessionTransactions.filter((t) => t.playerId === player.id)
    const buyins = playerTransactions
      .filter((t) => t.type === "buyin")
      .reduce((sum, t) => sum + t.amount, 0)
    const cashouts = playerTransactions
      .filter((t) => t.type === "cashout")
      .reduce((sum, t) => sum + t.amount, 0)
    const pl = cashouts - buyins

    const dateRaw = session.createdAt
    entries.push({
      sessionId: session.id,
      date: formatDateDDMMYYYY(dateRaw),
      sessionName: session.name,
      pl,
    })
  }

  entries.sort((a, b) => {
    const sessionA = sessionMap.get(a.sessionId)
    const sessionB = sessionMap.get(b.sessionId)
    const timeA = new Date(sessionA?.createdAt ?? 0).getTime()
    const timeB = new Date(sessionB?.createdAt ?? 0).getTime()
    return timeB - timeA
  })

  return entries
}

/**
 * Calculate overall club stats from sessions and transactions.
 */
export function calculateOverallStats(
  sessions: Session[],
  transactions: Transaction[]
): OverallStats {
  const totalSessions = sessions.length
  const totalBuyins = transactions
    .filter((t) => t.type === "buyin")
    .reduce((sum, t) => sum + t.amount, 0)
  const totalCashouts = transactions
    .filter((t) => t.type === "cashout")
    .reduce((sum, t) => sum + t.amount, 0)
  const totalPL = totalCashouts - totalBuyins

  return {
    totalSessions,
    totalBuyins,
    totalCashouts,
    totalPL,
  }
}
