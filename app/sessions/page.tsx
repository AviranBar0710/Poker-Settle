"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { AppShell } from "@/components/layout/AppShell"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getCurrencySymbol } from "@/lib/currency"
import { formatDateDDMMYYYY } from "@/lib/utils"
import { Session } from "@/types/session"
import { Transaction } from "@/types/transaction"
import Link from "next/link"
import { Calendar, Eye } from "lucide-react"
import { useClub } from "@/contexts/ClubContext"

type SessionWithPL = Session & {
  totalBuyins: number
  totalCashouts: number
  totalPL: number
  playerCount: number
}

export default function SessionsHistoryPage() {
  const router = useRouter()
  const { activeClubId } = useClub()
  const [sessions, setSessions] = useState<SessionWithPL[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!activeClubId) {
      setSessions([])
      setIsLoading(false)
      return
    }

    const loadSessions = async () => {
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

          // Load transactions and players for all sessions
          if (sessionsList.length > 0) {
            const sessionIds = sessionsList.map((s) => s.id)
            const [transactionsRes, playersRes] = await Promise.all([
              supabase.from("transactions").select("*").in("session_id", sessionIds),
              supabase.from("players").select("id, session_id").in("session_id", sessionIds),
            ])

            const transactionsData = transactionsRes.data || []
            const playersData = playersRes.data || []
            if (transactionsRes.error) console.error("Error loading transactions:", transactionsRes.error)
            if (playersRes.error) console.error("Error loading players:", playersRes.error)

            const sessionsWithPL: SessionWithPL[] = sessionsList.map((session) => {
              const sessionTransactions = transactionsData.filter(
                (t) => t.session_id === session.id
              )
              const playerCount = playersData.filter((p) => p.session_id === session.id).length

              const totalBuyins = sessionTransactions
                .filter((t) => t.type === "buyin")
                .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0)

              const totalCashouts = sessionTransactions
                .filter((t) => t.type === "cashout")
                .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0)

              const totalPL = totalCashouts - totalBuyins

              return {
                ...session,
                totalBuyins,
                totalCashouts,
                totalPL,
                playerCount,
              }
            })

            setSessions(sessionsWithPL)
          } else {
            setSessions([])
          }
        }
      } catch (err) {
        console.error("Unexpected error loading sessions:", err)
        setSessions([])
      } finally {
        setIsLoading(false)
      }
    }

    loadSessions()
  }, [activeClubId])

  return (
    <AppShell>
      <div className="min-h-screen bg-background p-4 sm:p-6 overflow-x-hidden">
        <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
          {/* Page Header */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Session History</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Review your completed poker sessions
            </p>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <p className="text-muted-foreground">Loading session history...</p>
                </div>
              </CardContent>
            </Card>
          ) : sessions.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <div className="text-4xl">📋</div>
                  <div className="space-y-2">
                    <p className="text-lg font-medium">No completed sessions</p>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Finalized sessions will appear here. Complete a session to see it in your history.
                    </p>
                  </div>
                  <Button onClick={() => router.push("/")} variant="outline" className="gap-2">
                    Go to Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4 min-w-0 overflow-hidden">
              {sessions.map((session) => (
                <Card key={session.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      {/* Left: Session Info */}
                      <div className="flex-1 min-w-0 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                          <h3 className="text-lg sm:text-xl font-semibold truncate">{session.name}</h3>
                          <Badge variant="default" className="shrink-0 w-fit">
                            Finalized
                          </Badge>
                        </div>

                        {/* Primary info: Created at, Currency, Total buy-in, Players */}
                        {(() => {
                          const sym = getCurrencySymbol(session.currency)
                          return (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Calendar className="h-4 w-4 shrink-0" />
                                <span>{formatDateDDMMYYYY(session.createdAt)}</span>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wide">Currency</p>
                                <p className="text-sm font-mono font-semibold">{sym}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total buy-in</p>
                                <p className="text-sm font-mono font-semibold">
                                  {sym}{session.totalBuyins.toFixed(0)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wide">Players</p>
                                <p className="text-sm font-mono font-semibold">
                                  {session.playerCount ?? 0} {(session.playerCount ?? 0) === 1 ? "Player" : "Players"}
                                </p>
                              </div>
                            </div>
                          )
                        })()}
                      </div>

                      {/* Right: Action */}
                      <div className="shrink-0 w-full sm:w-auto">
                        <Link href={`/session/${session.id}`} className="block">
                          <Button variant="outline" size="lg" className="gap-2 w-full sm:w-auto">
                            <Eye className="h-4 w-4" />
                            View Session
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

