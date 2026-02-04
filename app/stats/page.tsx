"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { AppShell } from "@/components/layout/AppShell"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Session } from "@/types/session"
import { Player } from "@/types/player"
import { Transaction } from "@/types/transaction"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { TrendingUp, TrendingDown, DollarSign, Calendar, Crown, Medal, BarChart3, LogIn } from "lucide-react"
import { getCurrencySymbol } from "@/lib/currency"
import { useAuth } from "@/contexts/AuthContext"
import { useClub } from "@/contexts/ClubContext"

type PlayerStat = {
  name: string
  totalSessions: number
  totalBuyins: number
  totalCashouts: number
  totalPL: number
  avgPL: number
  roi: number
  winRate: number
  profitableSessions: number
}

export default function StatsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { activeClubId } = useClub()
  const [sessions, setSessions] = useState<Session[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAllPlayers, setShowAllPlayers] = useState(false)
  const [profile, setProfile] = useState<{ display_name?: string; email?: string } | null>(null)

  // Load profile for display name
  useEffect(() => {
    if (!user) {
      setProfile(null)
      return
    }

    const loadProfile = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("display_name, email")
          .eq("id", user.id)
          .single()

        if (error) {
          console.error("Error loading profile:", error)
          setProfile(null)
        } else if (data) {
          setProfile(data)
        }
      } catch (err) {
        console.error("Unexpected error loading profile:", err)
        setProfile(null)
      }
    }

    loadProfile()
  }, [user])

  useEffect(() => {
    // Don't load data if auth is still loading
    if (authLoading) return

    // If user is not logged in, set empty state
    if (!user) {
      setIsLoading(false)
      setSessions([])
      setPlayers([])
      setTransactions([])
      return
    }

    if (!activeClubId) {
      setSessions([])
      setPlayers([])
      setTransactions([])
      setIsLoading(false)
      return
    }

    const loadData = async () => {
      try {
        // Load finalized sessions only (RLS will filter by club automatically, but explicit for clarity)
        const { data: sessionsData, error: sessionsError } = await supabase
          .from("sessions")
          .select("*")
          .eq("club_id", activeClubId)
          .not("finalized_at", "is", null)
          .order("finalized_at", { ascending: false })

        if (sessionsError) {
          console.error("Error loading sessions:", sessionsError)
          setSessions([])
        } else if (sessionsData) {
          const sessionsList: Session[] = sessionsData.map((s) => ({
            id: s.id,
            name: s.name,
            currency: s.currency as "USD" | "ILS" | "EUR",
            createdAt: s.created_at,
            finalizedAt: s.finalized_at || undefined,
          }))
          setSessions(sessionsList)

          // Load players for these sessions, filtered by profile_id
          if (sessionsList.length > 0) {
            const sessionIds = sessionsList.map((s) => s.id)
            const { data: playersData, error: playersError } = await supabase
              .from("players")
              .select("*")
              .in("session_id", sessionIds)
              .eq("profile_id", user.id) // Only load players linked to current user

            if (playersError) {
              console.error("Error loading players:", playersError)
              setPlayers([])
            } else if (playersData) {
              const playersList: Player[] = playersData.map((p) => ({
                id: p.id,
                sessionId: p.session_id,
                name: p.name,
                createdAt: p.created_at,
                profileId: p.profile_id || null,
              }))
              setPlayers(playersList)
            }

            // Load transactions for these sessions
            const { data: transactionsData, error: transactionsError } = await supabase
              .from("transactions")
              .select("*")
              .in("session_id", sessionIds)
              .order("created_at", { ascending: true })

            if (transactionsError) {
              console.error("Error loading transactions:", transactionsError)
              setTransactions([])
            } else if (transactionsData) {
              const transactionsList: Transaction[] = transactionsData.map((t) => ({
                id: t.id,
                sessionId: t.session_id,
                playerId: t.player_id,
                type: t.type as "buyin" | "cashout",
                amount: parseFloat(t.amount.toString()),
                createdAt: t.created_at,
              }))
              setTransactions(transactionsList)
            }
          }
        }
      } catch (err) {
        console.error("Unexpected error loading data:", err)
        setSessions([])
        setPlayers([])
        setTransactions([])
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [user, authLoading, activeClubId])

  // Calculate player statistics with ROI and Win Rate
  // Groups by profile_id instead of player name to aggregate all sessions for the same user
  const playerStats = useMemo(() => {
    const statsMap = new Map<string, {
      name: string
      totalSessions: number
      totalBuyins: number
      totalCashouts: number
      totalPL: number
      avgPL: number
      profitableSessions: number
    }>()

    // Get display name from profile, fallback to email username, then "You"
    const displayName = profile?.display_name || profile?.email?.split('@')[0] || user?.email?.split('@')[0] || 'You'

    sessions.forEach((session) => {
      const sessionPlayers = players.filter((p) => p.sessionId === session.id)
      const sessionTransactions = transactions.filter((t) => t.sessionId === session.id)

      sessionPlayers.forEach((player) => {
        // Skip players without profile_id (shouldn't happen since we filter by profile_id, but safety check)
        if (!player.profileId) return

        const playerTransactions = sessionTransactions.filter((t) => t.playerId === player.id)
        const buyins = playerTransactions
          .filter((t) => t.type === "buyin")
          .reduce((sum, t) => sum + t.amount, 0)
        const cashouts = playerTransactions
          .filter((t) => t.type === "cashout")
          .reduce((sum, t) => sum + t.amount, 0)
        const pl = cashouts - buyins

        // Group by profile_id instead of player.name
        const key = player.profileId
        const existing = statsMap.get(key) || {
          name: displayName,
          totalSessions: 0,
          totalBuyins: 0,
          totalCashouts: 0,
          totalPL: 0,
          avgPL: 0,
          profitableSessions: 0,
        }

        statsMap.set(key, {
          name: existing.name, // Keep the same name (from profile)
          totalSessions: existing.totalSessions + 1,
          totalBuyins: existing.totalBuyins + buyins,
          totalCashouts: existing.totalCashouts + cashouts,
          totalPL: existing.totalPL + pl,
          avgPL: 0,
          profitableSessions: existing.profitableSessions + (pl > 0.01 ? 1 : 0),
        })
      })
    })

    // Calculate averages, ROI, and Win Rate
    const statsArray: PlayerStat[] = Array.from(statsMap.values()).map((stat) => ({
      name: stat.name,
      totalSessions: stat.totalSessions,
      totalBuyins: stat.totalBuyins,
      totalCashouts: stat.totalCashouts,
      totalPL: stat.totalPL,
      avgPL: stat.totalSessions > 0 ? stat.totalPL / stat.totalSessions : 0,
      roi: stat.totalBuyins > 0 ? (stat.totalPL / stat.totalBuyins) * 100 : 0,
      winRate: stat.totalSessions > 0 ? (stat.profitableSessions / stat.totalSessions) * 100 : 0,
      profitableSessions: stat.profitableSessions,
    }))

    return statsArray.sort((a, b) => b.totalPL - a.totalPL)
  }, [sessions, players, transactions, profile, user])

  // Get top 3 players
  const top3Players = useMemo(() => playerStats.slice(0, 3), [playerStats])

  // Get display players (all players by default, button toggles if needed)
  const displayPlayers = useMemo(
    () => playerStats,
    [playerStats]
  )

  // Get currency symbol
  const currencySymbol = sessions[0]?.currency ? getCurrencySymbol(sessions[0].currency) : "$"

  // Rank icon component
  const RankIcon = ({ rank }: { rank: number }) => {
    if (rank === 1) {
      return <Crown className="h-5 w-5 text-yellow-500" />
    }
    if (rank === 2) {
      return <Medal className="h-5 w-5 text-gray-400" />
    }
    if (rank === 3) {
      return <Medal className="h-5 w-5 text-orange-600" />
    }
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted font-bold text-sm">
        {rank}
      </div>
    )
  }

  // Leaderboard Card Component
  const LeaderboardCard = ({ players, title }: { players: PlayerStat[]; title: string }) => (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {players.map((player, index) => {
            const plColor =
              player.totalPL > 0.01
                ? "text-green-600 dark:text-green-500"
                : player.totalPL < -0.01
                ? "text-red-600 dark:text-red-500"
                : "text-muted-foreground"
            return (
              <div
                key={player.name}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted font-bold text-lg">
                    #{index + 1}
                  </div>
                  <span className="font-medium text-base">{player.name}</span>
                </div>
                <div className="text-right">
                  <p className={cn("font-mono font-semibold", plColor)}>
                    {player.totalPL > 0 ? "+" : ""}
                    {currencySymbol}
                    {player.totalPL.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {player.totalSessions} session{player.totalSessions !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )

  // Calculate overall stats
  const overallStats = useMemo(() => {
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
  }, [sessions, transactions])

  return (
    <AppShell>
      <div className="min-h-screen bg-background p-4 sm:p-6 overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Player Statistics</h1>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                Track cumulative profit/loss for all players
              </p>
            </div>
            <Button onClick={() => router.push("/")} variant="outline" size="lg" className="w-full sm:w-auto">
              Back to Dashboard
            </Button>
          </div>

          {authLoading || isLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading statistics...</p>
            </div>
          ) : !user ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <div className="text-4xl">🔒</div>
                  <div className="space-y-2">
                    <p className="text-lg font-medium">Login to see your personal statistics</p>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Log in to view your personal statistics across all finalized sessions.
                    </p>
                  </div>
                  <Button onClick={() => router.push("/")} className="gap-2">
                    <LogIn className="h-4 w-4" />
                    Go to Login
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : sessions.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <div className="text-4xl">📊</div>
                  <div className="space-y-2">
                    <p className="text-lg font-medium">No finalized sessions</p>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Finalize some sessions to see player statistics here.
                    </p>
                  </div>
                  <Button onClick={() => router.push("/")} className="gap-2">
                    Go to Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Player Statistics Table */}
              <Card className="shadow-sm">
                <CardHeader>
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Leaderboard
                    </CardTitle>
                    <CardDescription>
                      Statistics aggregated across all finalized sessions
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  {playerStats.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No player data available</p>
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table View */}
                      <div className="hidden md:block border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="font-semibold">Rank</TableHead>
                              <TableHead className="font-semibold">Player</TableHead>
                              <TableHead className="text-right font-semibold">Games Played</TableHead>
                              <TableHead className="text-right font-semibold">Total Profit/Loss</TableHead>
                              <TableHead className="text-right font-semibold">ROI</TableHead>
                              <TableHead className="text-right font-semibold">Win Rate</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {displayPlayers.map((stat, index) => {
                              const rank = index + 1
                              const plColor =
                                stat.totalPL > 0.01
                                  ? "text-green-600 dark:text-green-500"
                                  : stat.totalPL < -0.01
                                  ? "text-red-600 dark:text-red-500"
                                  : "text-muted-foreground"
                              const roiColor =
                                stat.roi > 0.01
                                  ? "text-green-600 dark:text-green-500"
                                  : stat.roi < -0.01
                                  ? "text-red-600 dark:text-red-500"
                                  : "text-muted-foreground"
                              return (
                                <TableRow key={stat.name} className="hover:bg-muted/50">
                                  <TableCell>
                                    <RankIcon rank={rank} />
                                  </TableCell>
                                  <TableCell className="font-medium text-base">
                                    {stat.name}
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {stat.totalSessions}
                                  </TableCell>
                                  <TableCell className={cn("text-right font-mono font-semibold", plColor)}>
                                    {stat.totalPL > 0 ? "+" : ""}
                                    {currencySymbol}
                                    {stat.totalPL.toFixed(2)}
                                  </TableCell>
                                  <TableCell className={cn("text-right font-mono font-semibold", roiColor)}>
                                    {stat.roi > 0 ? "+" : ""}
                                    {stat.roi.toFixed(1)}%
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {stat.winRate.toFixed(1)}%
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                      {/* Mobile Card View */}
                      <div className="md:hidden space-y-3">
                        {displayPlayers.map((stat, index) => {
                          const rank = index + 1
                          const plColor =
                            stat.totalPL > 0.01
                              ? "text-green-600 dark:text-green-500"
                              : stat.totalPL < -0.01
                              ? "text-red-600 dark:text-red-500"
                              : "text-muted-foreground"
                          const roiColor =
                            stat.roi > 0.01
                              ? "text-green-600 dark:text-green-500"
                              : stat.roi < -0.01
                              ? "text-red-600 dark:text-red-500"
                              : "text-muted-foreground"
                          return (
                            <Card key={stat.name} className="border">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <RankIcon rank={rank} />
                                    <span className="font-medium text-base">{stat.name}</span>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Games Played</p>
                                    <p className="font-mono font-semibold">{stat.totalSessions}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Total P/L</p>
                                    <p className={cn("font-mono font-semibold", plColor)}>
                                      {stat.totalPL > 0 ? "+" : ""}
                                      {currencySymbol}
                                      {stat.totalPL.toFixed(2)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">ROI</p>
                                    <p className={cn("font-mono font-semibold", roiColor)}>
                                      {stat.roi > 0 ? "+" : ""}
                                      {stat.roi.toFixed(1)}%
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Win Rate</p>
                                    <p className="font-mono font-semibold">{stat.winRate.toFixed(1)}%</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}

