"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { AppShell } from "@/components/layout/AppShell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SessionCard } from "@/components/dashboard/SessionCard"
import { Session } from "@/types/session"
import { Transaction } from "@/types/transaction"
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-w-0">
              {sessions.map((session) => (
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

