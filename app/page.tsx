"use client"
import { supabase } from "@/lib/supabaseClient"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { LoginGate } from "@/components/LoginGate"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, TrendingUp, TrendingDown, DollarSign, Calendar } from "lucide-react"
import { Session } from "@/types/session"
import { Transaction } from "@/types/transaction"
import { cn } from "@/lib/utils"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useIsDesktop } from "@/hooks/useIsDesktop"
import { useAuth } from "@/contexts/AuthContext"
import { useClub } from "@/contexts/ClubContext"

export default function HomePage() {
  const router = useRouter()
  const isDesktop = useIsDesktop()
  const { user, loading: authLoading } = useAuth()
  const { activeClubId } = useClub()

  const [sessionName, setSessionName] = useState("")
  const [currency, setCurrency] = useState<"USD" | "ILS" | "EUR">("USD")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoadingSessions, setIsLoadingSessions] = useState(true)
  const [transactions, setTransactions] = useState<Transaction[]>([])

  // Load sessions and transactions for dashboard display
  useEffect(() => {
    if (!activeClubId) {
      setSessions([])
      setTransactions([])
      setIsLoadingSessions(false)
      return
    }

    const loadSessions = async () => {
      try {
        const { data, error } = await supabase
          .from("sessions")
          .select("*")
          .eq("club_id", activeClubId)
          .order("created_at", { ascending: false })
          .limit(10)

        if (error) {
          console.error("Error loading sessions:", error)
          setSessions([])
        } else if (data) {
          const sessionsList: Session[] = data.map((s) => ({
            id: s.id,
            name: s.name,
            currency: s.currency as "USD" | "ILS" | "EUR",
            createdAt: s.created_at,
            finalizedAt: s.finalized_at || undefined,
          }))
          setSessions(sessionsList)

          // Load transactions for finalized sessions to calculate pot values
          const finalizedSessionIds = sessionsList
            .filter((s) => s.finalizedAt)
            .map((s) => s.id)

          if (finalizedSessionIds.length > 0) {
            const { data: transactionsData, error: transactionsError } = await supabase
              .from("transactions")
              .select("*")
              .in("session_id", finalizedSessionIds)

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
          } else {
            setTransactions([])
          }
        }
      } catch (err) {
        console.error("Unexpected error loading sessions:", err)
        setSessions([])
        setTransactions([])
      } finally {
        setIsLoadingSessions(false)
      }
    }

    loadSessions()
  }, [activeClubId])

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }
  if (!user) {
    return <LoginGate />
  }

  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) {
      e.preventDefault()
    }

    // Validate session name
    if (!sessionName.trim()) {
      return
    }

    // Clear previous errors
    setCreateError(null)
    setIsSubmitting(true)

    try {
      // Check if user has active club
      if (!activeClubId) {
        setCreateError("Please select a club to create a session")
        setIsSubmitting(false)
        return
      }

      // Generate unique session ID (UUID format for Supabase)
      const sessionId = crypto.randomUUID()

      // Create session in Supabase (with club_id)
      const { data, error } = await supabase
        .from("sessions")
        .insert({
          id: sessionId,
          name: sessionName.trim(),
          currency: currency,
          club_id: activeClubId,
        })
        .select()
        .single()

      if (error) {
        console.error("Error creating session:", error)
        setCreateError(`Failed to create session: ${error.message}`)
        setIsSubmitting(false)
        return
      }

      if (data) {
        // Close dialog and reset form
        setShowCreateDialog(false)
        setSessionName("")
        setCurrency("USD")
        setCreateError(null)
        // Navigate to session page
        router.push(`/session/${sessionId}`)
      } else {
        setCreateError("Failed to create session: No data returned")
        setIsSubmitting(false)
      }
    } catch (err) {
      console.error("Unexpected error creating session:", err)
      setCreateError("Failed to create session. Please try again.")
      setIsSubmitting(false)
    }
  }

  // Calculate stats from sessions and transactions
  const totalSessions = sessions.length
  const activeSessions = sessions.filter((s) => !s.finalizedAt).length
  const finalizedSessions = sessions.filter((s) => s.finalizedAt)
  
  // Calculate total pot value (sum of all buy-ins from finalized sessions)
  const totalPotValue = finalizedSessions.reduce((total, session) => {
    const sessionBuyins = transactions
      .filter((t) => t.sessionId === session.id && t.type === "buyin")
      .reduce((sum, t) => sum + t.amount, 0)
    return total + sessionBuyins
  }, 0)

  // Calculate average pot value per finalized session
  const averagePotValue = finalizedSessions.length > 0
    ? totalPotValue / finalizedSessions.length
    : 0

  // Get currency from first finalized session (or default to first session)
  const displayCurrency = finalizedSessions[0]?.currency || sessions[0]?.currency || "USD"
  const currencySymbol = displayCurrency === "ILS" ? "₪" : displayCurrency === "EUR" ? "€" : "$"

  const recentSessions = sessions.slice(0, 6)

  return (
    <AppShell>
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                Overview of your poker sessions
              </p>
            </div>
            <Button
              onClick={() => setShowCreateDialog(true)}
              size="lg"
              className="gap-2 w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              New Session
            </Button>
          </div>

          {/* Create Session Dialog */}
          <Dialog 
            open={showCreateDialog} 
            onOpenChange={(open) => {
              setShowCreateDialog(open)
              if (!open) {
                setCreateError(null)
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
              <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0">
                {/* Mobile: Fixed Header */}
                <div className="flex-shrink-0 px-4 pt-5 pb-4 border-b md:border-b-0 md:p-0 md:pb-0">
                  <DialogHeader className="md:text-left">
                    <DialogTitle className="text-xl md:text-lg font-semibold">Create New Game</DialogTitle>
                    <DialogDescription className="text-sm mt-1.5 text-muted-foreground md:mt-0">
                      Start tracking a new poker cash game session
                    </DialogDescription>
                  </DialogHeader>
                </div>

                {/* Mobile: Scrollable Content */}
                <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 space-y-4 md:flex-none md:min-h-auto md:overflow-visible md:p-0 md:py-4 md:space-y-4">
                  {createError && (
                    <Alert className="border-destructive bg-destructive/10 text-destructive">
                      <AlertDescription>{createError}</AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <label htmlFor="session-name" className="text-sm font-semibold block text-foreground">
                      Session Name
                    </label>
                    <Input
                      type="text"
                      id="session-name"
                      value={sessionName}
                      onChange={(e) => {
                        setSessionName(e.target.value)
                        if (createError) setCreateError(null)
                      }}
                      placeholder="e.g., Friday Night Game"
                      className="h-12 md:h-10 text-base md:text-sm"
                      autoFocus={isDesktop}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="currency" className="text-sm font-semibold block text-foreground">
                      Currency
                    </label>
                    <select
                      id="currency"
                      value={currency}
                      onChange={(e) =>
                        setCurrency(e.target.value as "USD" | "ILS" | "EUR")
                      }
                      className="flex h-12 md:h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="ILS">ILS (₪)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                </div>

                {/* Mobile: Fixed Action Footer */}
                <div className="flex-shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 border-t bg-background md:border-t-0 md:bg-transparent md:p-0 md:pt-4 md:pb-0">
                  <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end md:gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setShowCreateDialog(false)
                        setSessionName("")
                        setCurrency("USD")
                      }}
                      disabled={isSubmitting}
                      className="h-12 md:h-10 order-2 md:order-1 text-base md:text-sm"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="h-12 md:h-10 order-1 md:order-2 md:min-w-[140px] text-base md:text-sm font-medium"
                    >
                      {isSubmitting ? "Creating..." : "Create Session"}
                    </Button>
                  </div>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Total Sessions
                    </p>
                    <p className="text-2xl font-bold mt-1">{totalSessions}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Active Sessions
                    </p>
                    <p className="text-2xl font-bold mt-1">{activeSessions}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Total Pot Value
                    </p>
                    <p className="text-2xl font-bold mt-1">
                      {totalPotValue.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}
                      {currencySymbol}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Average Session
                    </p>
                    <p className="text-2xl font-bold mt-1">
                      {averagePotValue > 0
                        ? `${averagePotValue.toLocaleString(undefined, {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}${currencySymbol}`
                        : "—"}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <TrendingDown className="h-6 w-6 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Sessions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">Recent Sessions</h2>
            </div>

            {isLoadingSessions ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading sessions...</p>
              </div>
            ) : recentSessions.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center space-y-4">
                    <div className="text-4xl">📊</div>
                    <div className="space-y-2">
                      <p className="text-lg font-medium">No sessions yet</p>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        Get started by creating your first poker session to track buy-ins, cash-outs, and settlements.
                      </p>
                    </div>
                    <Button
                      onClick={() => setShowCreateDialog(true)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Create Your First Session
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentSessions.map((session) => (
                  <Card
                    key={session.id}
                    className="hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg truncate">
                            {session.name}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {new Date(session.createdAt).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <Badge
                          variant={session.finalizedAt ? "default" : "secondary"}
                          className="ml-2 shrink-0"
                        >
                          {session.finalizedAt ? "Finalized" : "Active"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {session.currency}
                        </span>
                        <Link href={`/session/${session.id}`}>
                          <Button variant="outline" size="sm">
                            {session.finalizedAt ? "View" : "Continue"}
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
