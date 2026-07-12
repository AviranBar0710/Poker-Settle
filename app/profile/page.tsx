"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/contexts/AuthContext"
import { useClub } from "@/contexts/ClubContext"
import { AppShell } from "@/components/layout/AppShell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ListRow } from "@/components/ui/list-row"
import { NetResultCard } from "@/components/stats/NetResultCard"
import { getCurrencySymbol } from "@/lib/currency"
import {
  loadFinalizedSessions,
  loadPlayers,
  loadTransactions,
  getSessionHistoryForProfile,
  type SessionHistoryEntry,
} from "@/lib/stats/calc"
import { ChevronLeft, ChevronRight, Pencil, LogOut, Check, X, Mail, SunMoon } from "lucide-react"
import { ThemeToggle } from "@/components/ThemeToggle"

const APP_VERSION = "0.1.0"

export default function ProfilePage() {
  const router = useRouter()
  const { user, session, loading: authLoading } = useAuth()
  const { activeClubId, activeClub } = useClub()
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [history, setHistory] = useState<SessionHistoryEntry[]>([])
  const [statsCurrency, setStatsCurrency] = useState<string>("$")

  const fetchProfile = useCallback(async () => {
    if (!user?.id) return
    setProfileLoading(true)
    setProfileError(null)
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, email")
        .eq("id", user.id)
        .single()

      if (error) {
        setProfileError(error.message)
        setDisplayName(null)
        setEmail(session?.user?.email ?? null)
        return
      }

      setDisplayName(data?.display_name ?? null)
      setEmail(data?.email ?? session?.user?.email ?? null)
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "Failed to load profile")
      setDisplayName(null)
      setEmail(session?.user?.email ?? null)
    } finally {
      setProfileLoading(false)
    }
  }, [user?.id, session?.user?.email])

  useEffect(() => {
    if (!user) return
    fetchProfile()
  }, [user, fetchProfile])

  // Net-result card data — reuses the stats loaders (layout_guide.md §3 data note)
  useEffect(() => {
    if (!user?.id || !activeClubId) {
      setHistory([])
      return
    }
    let cancelled = false
    const loadStats = async () => {
      try {
        const sessions = await loadFinalizedSessions(activeClubId)
        if (cancelled || sessions.length === 0) {
          if (!cancelled) setHistory([])
          return
        }
        const sessionIds = sessions.map((s) => s.id)
        const [players, transactions] = await Promise.all([
          loadPlayers(sessionIds),
          loadTransactions(sessionIds),
        ])
        if (cancelled) return
        setHistory(getSessionHistoryForProfile(sessions, players, transactions, user.id))
        setStatsCurrency(getCurrencySymbol(sessions[0].currency))
      } catch {
        if (!cancelled) setHistory([])
      }
    }
    loadStats()
    return () => {
      cancelled = true
    }
  }, [user?.id, activeClubId])

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/")
    }
  }, [authLoading, user, router])

  const handleStartEdit = () => {
    setEditValue(displayName ?? "")
    setSaveError(null)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditValue("")
    setSaveError(null)
  }

  const handleSaveEdit = async () => {
    if (!user?.id) return
    const trimmed = editValue.trim()
    setIsSaving(true)
    setSaveError(null)
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: trimmed || null })
        .eq("id", user.id)

      if (error) {
        setSaveError(error.message)
        return
      }

      setDisplayName(trimmed || null)
      setIsEditing(false)
      setEditValue("")
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/auth/logout"
    }
  }

  if (authLoading) {
    return (
      <AppShell>
        <div className="min-h-screen flex items-center justify-center p-4">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      </AppShell>
    )
  }

  if (!user) {
    return null
  }

  const net = history.reduce((sum, h) => sum + h.pl, 0)
  const wins = history.filter((h) => h.pl > 0).length
  const bestNight = history.length ? Math.max(...history.map((h) => h.pl)) : 0

  return (
    <AppShell>
      <div className="min-h-screen p-4 sm:p-6 overflow-x-hidden">
        <div className="max-w-md mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-12 w-12 min-h-[48px] min-w-[48px] shrink-0">
                <ChevronLeft className="h-6 w-6" />
              </Button>
            </Link>
            <h1 className="text-lg font-bold tracking-tight text-foreground flex-1 text-center -ml-12">
              Profile
            </h1>
          </div>

          {profileError && (
            <p className="text-sm text-destructive text-center">{profileError}</p>
          )}

          {profileLoading ? (
            <p className="text-sm text-muted-foreground text-center">Loading profile…</p>
          ) : (
            <>
              {/* Identity hero — layout_guide.md §3 step 2 */}
              <div className="flex flex-col items-center text-center gap-3">
                <div
                  aria-hidden="true"
                  className="flex h-24 w-24 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-3xl font-bold text-primary"
                >
                  {(displayName || email || "?")
                    .split(/[\s@]+/)
                    .slice(0, 2)
                    .map((part) => part.charAt(0).toUpperCase())
                    .join("")}
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold">{displayName || "Player"}</h2>
                  {email && (
                    <p className="text-sm text-muted-foreground">{email}</p>
                  )}
                </div>
                {activeClub?.role && (
                  <Badge variant="role" className="uppercase">
                    {activeClub.role}
                  </Badge>
                )}
              </div>

              {/* Net-result hero card — omitted entirely when no stats exist */}
              {history.length > 0 && (
                <NetResultCard
                  net={net}
                  currencySymbol={statsCurrency}
                  tiles={[
                    { label: "Games", value: history.length },
                    {
                      label: "Win rate",
                      value: `${Math.round((wins / history.length) * 100)}%`,
                    },
                    {
                      label: "Best night",
                      value: `+${statsCurrency}${bestNight.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}`,
                      accent: "success",
                    },
                  ]}
                />
              )}

              {/* Account section — form card replaced by list rows */}
              <section className="space-y-2">
                <h3 className="text-base font-semibold">Account</h3>

                {isEditing ? (
                  <div className="rounded-tile border bg-background/45 px-3 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="Enter display name"
                        className="h-10 flex-1"
                        autoFocus
                        disabled={isSaving}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-success hover:text-success hover:bg-success/10"
                        onClick={handleSaveEdit}
                        disabled={isSaving}
                        aria-label="Save"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                        aria-label="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {saveError && (
                      <p className="text-xs text-destructive">{saveError}</p>
                    )}
                  </div>
                ) : (
                  <ListRow
                    avatar={<Pencil className="h-4 w-4" />}
                    title="Display name"
                    subtitle={displayName || "Not set"}
                    right={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    onClick={handleStartEdit}
                  />
                )}

                <ListRow
                  avatar={<Mail className="h-4 w-4" />}
                  title="Email"
                  subtitle={email || "—"}
                />

                <div className="flex items-center gap-3 rounded-tile border bg-background/45 px-3 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <SunMoon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">Appearance</p>
                  </div>
                  <ThemeToggle />
                </div>
              </section>

              {/* Logout — demoted to ghost-danger (no red fill) */}
              <Button
                variant="ghost"
                className="w-full h-12 min-h-[44px] text-base font-medium text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </>
          )}

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground">
            App version: {APP_VERSION}
          </p>
        </div>
      </div>
    </AppShell>
  )
}
