"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { AppShell } from "@/components/layout/AppShell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ListRow } from "@/components/ui/list-row"
import { NetResultCard } from "@/components/stats/NetResultCard"
import { cn } from "@/lib/utils"
import { ChevronRight } from "lucide-react"
import { BackButton } from "@/components/layout/BackButton"
import { getCurrencySymbol } from "@/lib/currency"
import { useAuth } from "@/contexts/AuthContext"
import { useClub } from "@/contexts/ClubContext"
import {
  loadFinalizedSessions,
  loadPlayers,
  loadTransactions,
  loadClubMemberDisplayNames,
  getSessionHistoryForProfile,
} from "@/lib/stats/calc"

export default function PlayerGameHistoryPage() {
  const params = useParams()
  const profileId = typeof params.profileId === "string" ? params.profileId : null
  const { user, loading: authLoading } = useAuth()
  const { activeClubId } = useClub()
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof loadFinalizedSessions>>>([])
  const [players, setPlayers] = useState<Awaited<ReturnType<typeof loadPlayers>>>([])
  const [transactions, setTransactions] = useState<Awaited<ReturnType<typeof loadTransactions>>>([])
  const [profileDisplayNames, setProfileDisplayNames] = useState<Map<string, string>>(new Map())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (authLoading || !profileId) return
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
  }, [user, authLoading, activeClubId, profileId])

  const history = useMemo(
    () =>
      profileId && sessions.length > 0
        ? getSessionHistoryForProfile(sessions, players, transactions, profileId)
        : [],
    [sessions, players, transactions, profileId]
  )

  const playerName = profileId ? profileDisplayNames.get(profileId) ?? "Unknown player" : ""
  const currencySymbol =
    sessions[0]?.currency ? getCurrencySymbol(sessions[0].currency) : "$"

  const net = history.reduce((sum, h) => sum + h.pl, 0)
  const wins = history.filter((h) => h.pl > 0).length
  const bestNight = history.length ? Math.max(...history.map((h) => h.pl)) : 0

  if (!profileId) {
    return (
      <AppShell>
        <div className="min-h-screen p-4 sm:p-6">
          <div className="max-w-2xl mx-auto">
            <p className="text-muted-foreground">Invalid player.</p>
            <Button variant="outline" asChild className="mt-4">
              <Link href="/stats">Back to Stats</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="min-h-screen p-4 sm:p-6 overflow-x-hidden">
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Detail-screen header: back + centered player name */}
          <div className="flex items-center gap-2">
            <BackButton fallback="/stats" />
            <h1 className="text-lg font-bold tracking-tight text-foreground flex-1 text-center -ml-12 truncate">
              {playerName || "Player"}
            </h1>
          </div>

          {authLoading || isLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading game history...</p>
            </div>
          ) : !user ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <p className="text-lg font-medium">Login to view game history.</p>
                  <Button asChild>
                    <Link href="/">Go to Login</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : !activeClubId ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <p className="text-lg font-medium">No club selected.</p>
                  <Button variant="outline" asChild>
                    <Link href="/">Go to Dashboard</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : history.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <p className="text-muted-foreground">No sessions yet</p>
                  <Button variant="outline" asChild>
                    <Link href="/stats">Back to Stats</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Hero — same card as Profile (layout_guide.md §5) */}
              <NetResultCard
                net={net}
                currencySymbol={currencySymbol}
                tiles={[
                  { label: "Games", value: history.length },
                  {
                    label: "Win rate",
                    value: `${Math.round((wins / history.length) * 100)}%`,
                  },
                  {
                    label: "Best night",
                    value: `+${currencySymbol}${bestNight.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}`,
                    accent: "success",
                  },
                ]}
              />

              {/* Session history rows */}
              <section className="space-y-2">
                <h3 className="text-base font-semibold">History</h3>
                {history.map((entry) => {
                  const plColor =
                    entry.pl > 0.01
                      ? "text-success"
                      : entry.pl < -0.01
                        ? "text-destructive"
                        : "text-muted-foreground"
                  return (
                    <ListRow
                      key={entry.sessionId}
                      href={`/session/${entry.sessionId}`}
                      avatar={<span aria-hidden="true">♠</span>}
                      title={entry.sessionName}
                      subtitle={entry.date}
                      right={
                        <span className="flex items-center gap-1.5">
                          <span className={cn("text-base font-extrabold tabular-nums", plColor)}>
                            {entry.pl > 0 ? "+" : entry.pl < 0 ? "−" : ""}
                            {currencySymbol}
                            {Math.abs(entry.pl).toFixed(2)}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </span>
                      }
                    />
                  )
                })}
              </section>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
