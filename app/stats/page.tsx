"use client"

/**
 * Stats/Leaderboard display follows docs/stats_leaderboard_display.md
 * (readability, cross-platform) restructured per docs/design/layout_guide.md §5.
 */

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ListRow } from "@/components/ui/list-row"
import { StatStrip } from "@/components/ui/stat-strip"
import { cn } from "@/lib/utils"
import { LogIn, Crown, Medal } from "lucide-react"
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

  const totalPot = useMemo(
    () => clubPlayerStats.reduce((sum, p) => sum + p.totalBuyins, 0),
    [clubPlayerStats]
  )

  const currencySymbol = sessions[0]?.currency ? getCurrencySymbol(sessions[0].currency) : "$"

  const rankOf = (stat: PlayerStat) =>
    clubPlayerStats.findIndex((p) => p.profileId === stat.profileId) + 1

  const RankAvatar = ({ rank }: { rank: number }) => {
    if (rank === 1) return <Crown className="h-5 w-5 text-yellow-500" />
    if (rank === 2) return <Medal className="h-5 w-5 text-muted-foreground" />
    if (rank === 3) return <Medal className="h-5 w-5 text-orange-600" />
    return <>{rank}</>
  }

  const formatSigned = (v: number) =>
    `${v > 0 ? "+" : v < 0 ? "−" : ""}${currencySymbol}${Math.abs(v).toFixed(2)}`

  const plColor = (v: number) =>
    v > 0.01 ? "text-success" : v < -0.01 ? "text-destructive" : "text-muted-foreground"

  const LeaderboardRows = ({ stats }: { stats: PlayerStat[] }) => {
    if (stats.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>No stats yet</p>
          <p className="text-sm mt-1">Play and finalize sessions to see stats here.</p>
        </div>
      )
    }
    return (
      <div className="space-y-2">
        {stats.map((stat) => {
          const rank = rankOf(stat)
          return (
            <ListRow
              key={stat.profileId}
              href={`/stats/player/${stat.profileId}`}
              avatar={<RankAvatar rank={rank} />}
              title={stat.name}
              subtitle={`${stat.totalSessions} ${stat.totalSessions === 1 ? "game" : "games"} · avg ${formatSigned(stat.avgPL)}`}
              right={
                <span className={cn("text-base font-extrabold tabular-nums", plColor(stat.totalPL))}>
                  {formatSigned(stat.totalPL)}
                </span>
              }
              className={cn(rank === 1 && "border-primary/25")}
            />
          )
        })}
      </div>
    )
  }

  return (
    <AppShell>
      <div className="min-h-screen p-4 sm:p-6 overflow-x-hidden">
        <div className="max-w-2xl mx-auto space-y-5">
          <h1 className="text-2xl font-bold tracking-tight">Stats</h1>

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
              {/* Segmented pills — layout_guide.md §5 */}
              <div className="flex gap-2">
                {(
                  [
                    { id: "club", label: "Club" },
                    { id: "my", label: "My stats" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors min-h-[44px]",
                      tab === t.id
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <StatStrip
                items={[
                  { label: "Games", value: sessions.length },
                  { label: "Players", value: clubPlayerStats.length },
                  {
                    label: "Total pot",
                    value: `${currencySymbol}${totalPot.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}`,
                  },
                ]}
              />

              <LeaderboardRows stats={tab === "club" ? clubPlayerStats : myPlayerStats} />
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
