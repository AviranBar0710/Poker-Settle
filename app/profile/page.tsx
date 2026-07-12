"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/contexts/AuthContext"
import { AppShell } from "@/components/layout/AppShell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronLeft, Pencil, LogOut, Check, X } from "lucide-react"

const APP_VERSION = "0.1.0"

export default function ProfilePage() {
  const router = useRouter()
  const { user, session, loading: authLoading } = useAuth()
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

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
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      </AppShell>
    )
  }

  if (!user) {
    return null
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-background p-4 sm:p-6 overflow-x-hidden">
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

          {/* Avatar hero — DESIGN_SYSTEM.md §4 screen 3 */}
          {!profileLoading && (
            <div className="flex flex-col items-center text-center gap-2">
              <div
                aria-hidden="true"
                className="flex h-20 w-20 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-2xl font-bold text-primary"
              >
                {(displayName || email || "?")
                  .split(/[\s@]+/)
                  .slice(0, 2)
                  .map((part) => part.charAt(0).toUpperCase())
                  .join("")}
              </div>
              <div>
                <h2 className="text-title">{displayName || "Player"}</h2>
                {email && (
                  <p className="text-sm text-muted-foreground">{email}</p>
                )}
              </div>
            </div>
          )}

          {/* Main Card */}
          <Card>
            <CardContent className="p-4 sm:p-6 space-y-6">
              {profileError && (
                <p className="text-sm text-destructive">{profileError}</p>
              )}

              {profileLoading ? (
                <p className="text-sm text-muted-foreground">Loading profile…</p>
              ) : (
                <>
                  {/* Display Name row */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold block text-foreground">
                      Display Name
                    </label>
                    {isEditing ? (
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
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-base text-foreground">
                          {displayName || "Not set"}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={handleStartEdit}
                          aria-label="Edit display name"
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    )}
                    {saveError && (
                      <p className="text-xs text-destructive">{saveError}</p>
                    )}
                  </div>

                  {/* Email row */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold block text-foreground">
                      Email
                    </label>
                    <p className="text-base text-muted-foreground">
                      {email || "—"}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Logout button */}
          <Button
            variant="destructive"
            className="w-full h-12 min-h-[44px] text-base font-medium"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground">
            App version: {APP_VERSION}
          </p>
        </div>
      </div>
    </AppShell>
  )
}
