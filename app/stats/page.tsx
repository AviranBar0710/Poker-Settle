"use client"

/**
 * Stats/Leaderboard display follows docs/stats_leaderboard_display.md
 * (readability, cross-platform).
 */

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AppShell } from "@/components/layout/AppShell"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { BarChart3, LogIn, Crown, Medal, Users, User } from "lucide-react"
import { getCurrencySymbol } from "@/lib/currency"
import { useAuth } from "@/contexts/AuthContext"
import { useClub } from "@/contexts/ClubContext"
import {
  loadFinalizedSessions,
  loadPlayers,
  loadTransactions,
  loadClubMemberDisplayNames,
  calculatePlayerStats,
  type PlayerStat,
} from "@/lib/stats/calc"

export default function StatsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { activeClubId } = useClub()
  const [tab, setTab] = useState<"club" | "my">("club")
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof loadFinalizedSessions>>>([])
  const [players, setPlayers] = useState<Awaited<ReturnType<typeof loadPlayers>>>([])
  const [transactions, setTransactions] = useState<Awaited<ReturnType<typeof loadTransactions>>>([])
  const [profileDisplayNames, setProfileDisplayNames] = useState<Map<string, string>>(new Map())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setIsLoading(false)
      setSessions([])
      setPlayers([])
      setTransactions([])
      setProfileDisplayNames(new Map())
      return
    }
    if (!activeClubId) {
      setSessions([])
      setPlayers([])
      setTransactions([])
      setProfileDisplayNames(new Map())
      setIsLoading(false)
      return
    }

    const loadData = async () => {
      try {
        const sessionsList = await loadFinalizedSessions(activeClubId)
        setSessions(sessionsList)

        if (sessionsList.length === 0) {
          setPlayers([])
          setTransactions([])
          setProfileDisplayNames(new Map())
          return
        }

        const sessionIds = sessionsList.map((s) => s.id)
        const [playersList, transactionsList, names] = await Promise.all([
          loadPlayers(sessionIds),
          loadTransactions(sessionIds),
          loadClubMemberDisplayNames(activeClubId),
        ])
        setPlayers(playersList)
        setTransactions(transactionsList)
        setProfileDisplayNames(names)
      } catch (err) {
        console.error("Unexpected error loading data:", err)
        setSessions([])
        setPlayers([])
        setTransactions([])
        setProfileDisplayNames(new Map())
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [user, authLoading, activeClubId])

  const clubPlayerStats = useMemo(
    () => calculatePlayerStats(sessions, players, transactions, profileDisplayNames),
    [sessions, players, transactions, profileDisplayNames]
  )

  const myPlayerStats = useMemo(
    () => (user ? clubPlayerStats.filter((p) => p.profileId === user.id) : []),
    [clubPlayerStats, user]
  )

  const currencySymbol = sessions[0]?.currency ? getCurrencySymbol(sessions[0].currency) : "$"

  const RankIcon = ({ rank }: { rank: number }) => {
    if (rank === 1) return <Crown className="h-5 w-5 text-yellow-500" />
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />
    if (rank === 3) return <Medal className="h-5 w-5 text-orange-600" />
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted font-bold text-sm">
        {rank}
      </div>
    )
  }

  const LeaderboardTable = ({ stats }: { stats: PlayerStat[] }) => {
    if (stats.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>No stats yet</p>
        </div>
      )
    }
    return (
      <>
        <div className="hidden md:block border rounded-lg overflow-auto max-h-[min(70vh,40rem)]">
          <Table>
            <TableHeader>
              <TableRow className="sticky top-0 z-10 bg-background border-b">
                <TableHead className="font-semibold">Rank</TableHead>
                <TableHead className="font-semibold">Player</TableHead>
                <TableHead className="text-right font-semibold tabular-nums">Sessions</TableHead>
                <TableHead className="text-right font-semibold tabular-nums">Total P/L</TableHead>
                <TableHead className="text-right font-semibold tabular-nums">Avg P/L per session</TableHead>
                <TableHead className="text-right font-semibold tabular-nums">Biggest win session</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((stat, index) => {
                const rank = index + 1
                const plColor =
                  stat.totalPL > 0.01
                    ? "text-green-600 dark:text-green-500"
                    : stat.totalPL < -0.01
                      ? "text-red-600 dark:text-red-500"
                      : "text-muted-foreground"
                const avgPlColor =
                  stat.avgPL > 0.01
                    ? "text-green-600 dark:text-green-500"
                    : stat.avgPL < -0.01
                      ? "text-red-600 dark:text-red-500"
                      : "text-muted-foreground"
                const biggestColor =
                  stat.biggestWinSession > 0.01
                    ? "text-green-600 dark:text-green-500"
                    : stat.biggestWinSession < -0.01
                      ? "text-red-600 dark:text-red-500"
                      : "text-muted-foreground"
                return (
                  <TableRow key={stat.profileId} className="hover:bg-muted/50">
                    <TableCell>
                      <RankIcon rank={rank} />
                    </TableCell>
                    <TableCell className="font-medium text-base">
                      <Link
                        href={`/stats/player/${stat.profileId}`}
                        className="hover:underline cursor-pointer"
                      >
                        {stat.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      <Link
                        href={`/stats/player/${stat.profileId}`}
                        className="hover:underline cursor-pointer"
                      >
                        {stat.totalSessions}
                      </Link>
                    </TableCell>
                    <TableCell className={cn("text-right font-mono font-semibold tabular-nums", plColor)}>
                      {stat.totalPL > 0 ? "+" : ""}
                      {currencySymbol}
                      {stat.totalPL.toFixed(2)}
                    </TableCell>
                    <TableCell className={cn("text-right font-mono font-semibold tabular-nums", avgPlColor)}>
                      {stat.avgPL > 0 ? "+" : ""}
                      {currencySymbol}
                      {stat.avgPL.toFixed(2)}
                    </TableCell>
                    <TableCell className={cn("text-right font-mono font-semibold tabular-nums", biggestColor)}>
                      {stat.biggestWinSession > 0 ? "+" : ""}
                      {currencySymbol}
                      {stat.biggestWinSession.toFixed(2)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        <div className="md:hidden space-y-4">
          {stats.map((stat, index) => {
            const rank = index + 1
            const plColor =
              stat.totalPL > 0.01
                ? "text-green-600 dark:text-green-500"
                : stat.totalPL < -0.01
                  ? "text-red-600 dark:text-red-500"
                  : "text-muted-foreground"
            const avgPlColor =
              stat.avgPL > 0.01
                ? "text-green-600 dark:text-green-500"
                : stat.avgPL < -0.01
                  ? "text-red-600 dark:text-red-500"
                  : "text-muted-foreground"
            const biggestColor =
              stat.biggestWinSession > 0.01
                ? "text-green-600 dark:text-green-500"
                : stat.biggestWinSession < -0.01
                  ? "text-red-600 dark:text-red-500"
                  : "text-muted-foreground"
            return (
              <Card key={stat.profileId} className="border">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <RankIcon rank={rank} />
                      <Link
                        href={`/stats/player/${stat.profileId}`}
                        className="font-medium text-base hover:underline cursor-pointer min-h-[44px] flex items-center"
                      >
                        {stat.name}
                      </Link>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Sessions</p>
                      <Link
                        href={`/stats/player/${stat.profileId}`}
                        className="font-mono font-semibold tabular-nums hover:underline cursor-pointer block min-h-[44px] flex items-center"
                      >
                        {stat.totalSessions}
                      </Link>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Total P/L</p>
                      <p className={cn("font-mono font-semibold tabular-nums", plColor)}>
                        {stat.totalPL > 0 ? "+" : ""}
                        {currencySymbol}
                        {stat.totalPL.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Avg P/L per session</p>
                      <p className={cn("font-mono font-semibold tabular-nums", avgPlColor)}>
                        {stat.avgPL > 0 ? "+" : ""}
                        {currencySymbol}
                        {stat.avgPL.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Biggest win session</p>
                      <p className={cn("font-mono font-semibold tabular-nums", biggestColor)}>
                        {stat.biggestWinSession > 0 ? "+" : ""}
                        {currencySymbol}
                        {stat.biggestWinSession.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </>
    )
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-background p-4 sm:p-6 overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Statistics</h1>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                Club leaderboard and your personal stats
              </p>
            </div>
            <Button
              onClick={() => router.push("/")}
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
            >
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
                    <p className="text-lg font-medium">Login to see statistics</p>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Log in to view club and personal statistics.
                    </p>
                  </div>
                  <Button onClick={() => router.push("/")} className="gap-2">
                    <LogIn className="h-4 w-4" />
                    Go to Login
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : !activeClubId ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <div className="text-4xl">📊</div>
                  <div className="space-y-2">
                    <p className="text-lg font-medium">No club selected</p>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Select or join a club to see statistics.
                    </p>
                  </div>
                  <Button onClick={() => router.push("/")} className="gap-2">
                    Go to Dashboard
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
                    <p className="text-lg font-medium">No finalized sessions yet</p>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Finalize some sessions to see club and personal statistics here.
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
              {/* Tabs: min-h for 48px touch target per stats_leaderboard_display.md */}
              <div className="flex rounded-lg border bg-muted/30 p-1">
                <button
                  type="button"
                  onClick={() => setTab("club")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 rounded-md py-2.5 min-h-[48px] text-sm font-medium transition-colors",
                    tab === "club"
                      ? "bg-background text-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Users className="h-4 w-4" />
                  Club Stats
                </button>
                <button
                  type="button"
                  onClick={() => setTab("my")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 rounded-md py-2.5 min-h-[48px] text-sm font-medium transition-colors",
                    tab === "my"
                      ? "bg-background text-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <User className="h-4 w-4" />
                  My Stats
                </button>
              </div>

              {tab === "club" ? (
                <>
                  {/* Club Leaderboard */}
                  <Card className="shadow-sm">
                    <CardHeader>
                      <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                          <BarChart3 className="h-5 w-5" />
                          Leaderboard
                        </CardTitle>
                        <CardDescription>
                          All identified players, sorted by profit (finalized sessions only)
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <LeaderboardTable stats={clubPlayerStats} />
                    </CardContent>
                  </Card>
                </>
              ) : (
                <>
                  {/* My Stats – structured for future per-session history / timeline */}
                  <Card className="shadow-sm">
                    <CardHeader>
                      <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                          <User className="h-5 w-5" />
                          My Stats
                        </CardTitle>
                        <CardDescription>
                          Your performance across all finalized club sessions
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {myPlayerStats.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>No stats yet</p>
                          <p className="text-sm mt-1">
                            Play and finalize sessions to see your stats here.
                          </p>
                        </div>
                      ) : (
                        <LeaderboardTable stats={myPlayerStats} />
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
