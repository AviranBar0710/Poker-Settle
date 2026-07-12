"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { AppShell } from "@/components/layout/AppShell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SessionCard } from "@/components/dashboard/SessionCard"
import { Session } from "@/types/session"
import { useClub } from "@/contexts/ClubContext"
import { cn } from "@/lib/utils"

type SessionWithPL = Session & {
  totalBuyins: number
  totalCashouts: number
  totalPL: number
  playerCount: number
}

type SessionFilter = "all" | "live" | "settled"

const FILTERS: SessionFilter[] = ["all", "live", "settled"]

export default function SessionsHistoryPage() {
  const router = useRouter()
  const { activeClubId } = useClub()
  const [sessions, setSessions] = useState<SessionWithPL[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<SessionFilter>("all")

  useEffect(() => {
    if (!activeClubId) {
      setSessions([])
      setIsLoading(false)
      return
    }

    const loadSessions = async () => {
      try {
        // All club sessions (live + settled); pills filter client-side —
        // data-contract change sanctioned by layout_guide.md §4.
        const { data: sessionsData, error: sessionsError } = await supabase
          .from("sessions")
          .select("*")
          .eq("club_id", activeClubId)
          .order("created_at", { ascending: false })

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

  const visibleSessions = useMemo(() => {
    if (filter === "live") return sessions.filter((s) => !s.finalizedAt)
    if (filter === "settled") return sessions.filter((s) => s.finalizedAt)
    return sessions
  }, [sessions, filter])

  const emptyCopy =
    filter === "live"
      ? "No live games right now"
      : filter === "settled"
      ? "No settled games yet"
      : "No games yet"

  return (
    <AppShell>
      <div className="min-h-screen p-4 sm:p-6 overflow-x-hidden">
        <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
          {/* Page Header */}
          <h1 className="text-2xl font-bold tracking-tight">Games</h1>

          {/* Filter pills — layout_guide.md §4 */}
          <div className="flex gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-semibold capitalize transition-colors",
                  filter === f
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "text-muted-foreground"
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <p className="text-muted-foreground">Loading games…</p>
                </div>
              </CardContent>
            </Card>
          ) : visibleSessions.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <div className="text-4xl">📋</div>
                  <div className="space-y-2">
                    <p className="text-lg font-medium">{emptyCopy}</p>
                    {filter === "all" && (
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        Create a session from the dashboard to start tracking
                        buy-ins, cash-outs, and settlements.
                      </p>
                    )}
                  </div>
                  {filter === "all" && (
                    <Button onClick={() => router.push("/")} variant="outline" className="gap-2">
                      Go to Dashboard
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-w-0">
              {visibleSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  playerCount={session.playerCount ?? 0}
                  totalBuyins={session.totalBuyins}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
