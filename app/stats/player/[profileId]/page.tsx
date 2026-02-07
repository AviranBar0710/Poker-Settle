"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { AppShell } from "@/components/layout/AppShell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { ArrowLeft, ChevronRight, Eye } from "lucide-react"
import { getCurrencySymbol } from "@/lib/currency"
import { useAuth } from "@/contexts/AuthContext"
import { useClub } from "@/contexts/ClubContext"
import {
  loadFinalizedSessions,
  loadPlayers,
  loadTransactions,
  loadClubMemberDisplayNames,
  getSessionHistoryForProfile,
  type SessionHistoryEntry,
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

  if (!profileId) {
    return (
      <AppShell>
        <div className="min-h-screen bg-background p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
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
      <div className="min-h-screen bg-background p-4 sm:p-6 overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Game history</h1>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                {playerName}
              </p>
            </div>
            <Button variant="outline" size="lg" asChild className="w-full sm:w-auto">
              <Link href="/stats" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Stats
              </Link>
            </Button>
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
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="hidden md:block border rounded-lg overflow-hidden min-w-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="text-right font-semibold tabular-nums">Profit/Loss</TableHead>
                        <TableHead className="text-right font-semibold w-[140px]"> </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((entry) => (
                        <HistoryTableRow
                          key={entry.sessionId}
                          entry={entry}
                          currencySymbol={currencySymbol}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="md:hidden space-y-2 min-w-0 overflow-hidden">
                  {history.map((entry) => (
                    <HistoryTappableRow
                      key={entry.sessionId}
                      entry={entry}
                      currencySymbol={currencySymbol}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  )
}

function HistoryTableRow({
  entry,
  currencySymbol,
}: {
  entry: SessionHistoryEntry
  currencySymbol: string
}) {
  const plColor =
    entry.pl > 0.01
      ? "text-green-600 dark:text-green-500"
      : entry.pl < -0.01
        ? "text-red-600 dark:text-red-500"
        : "text-muted-foreground"
  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className="font-mono text-sm tabular-nums">{entry.date}</TableCell>
      <TableCell className={cn("text-right font-mono font-semibold tabular-nums", plColor)}>
        {entry.pl > 0 ? "+" : ""}
        {currencySymbol}
        {entry.pl.toFixed(2)}
      </TableCell>
      <TableCell className="text-right">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/session/${entry.sessionId}`} className="gap-1 min-h-[44px] flex items-center">
            <Eye className="h-4 w-4" />
            View results
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  )
}

function HistoryTappableRow({
  entry,
  currencySymbol,
}: {
  entry: SessionHistoryEntry
  currencySymbol: string
}) {
  const plColor =
    entry.pl > 0.01
      ? "text-green-600 dark:text-green-500"
      : entry.pl < -0.01
        ? "text-red-600 dark:text-red-500"
        : "text-muted-foreground"
  return (
    <Link
      href={`/session/${entry.sessionId}`}
      className="flex items-center gap-4 min-h-[48px] p-4 border rounded-lg active:bg-muted transition-colors min-w-0"
    >
      <span className="font-mono text-sm tabular-nums text-muted-foreground shrink-0">{entry.date}</span>
      <span className={cn("flex-1 text-right font-mono font-semibold tabular-nums truncate", plColor)}>
        {entry.pl > 0 ? "+" : ""}
        {currencySymbol}
        {entry.pl.toFixed(2)}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </Link>
  )
}
