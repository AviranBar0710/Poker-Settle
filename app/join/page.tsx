"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { useClub } from "@/contexts/ClubContext"
import { AppShell } from "@/components/layout/AppShell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Users } from "lucide-react"

export default function JoinPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { loading: clubsLoading, joinClubByCode, createClub, error: clubError } = useClub()
  const [code, setCode] = useState("")
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newClubName, setNewClubName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || clubsLoading) return
    if (!user) {
      router.replace("/")
      return
    }
    // Allow users with clubs to access /join - they can join additional clubs
  }, [user, authLoading, clubsLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) {
      setSubmitError("Please enter a join code")
      return
    }
    setIsSubmitting(true)
    const result = await joinClubByCode(trimmed)
    setIsSubmitting(false)
    if (result.success) {
      router.push("/")
      return
    }
    setSubmitError(result.error)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value.trim().toUpperCase())
    setSubmitError(null)
  }

  const handleCreateClub = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)
    const name = newClubName.trim()
    if (!name) return
    setIsCreating(true)
    const club = await createClub(name)
    setIsCreating(false)
    if (club) {
      router.push("/")
    } else {
      setCreateError("Failed to create club. Please try again.")
    }
  }

  if (authLoading || clubsLoading) {
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

  const err = submitError || clubError

  return (
    <AppShell>
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 md:p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-2">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Users className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-center text-xl md:text-2xl">Join a Club</CardTitle>
          <CardDescription className="text-center">
            Poker Settle works within clubs. Enter a join code from your host, or create your own club below.
          </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {err ? (
              <Alert className="border-destructive bg-destructive/10 text-destructive">
                <AlertDescription>{err}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="join-code">Join Code</Label>
              <Input
                id="join-code"
                type="text"
                placeholder="e.g. ABCD1234"
                value={code}
                onChange={handleChange}
                autoComplete="off"
                autoFocus={false}
                className="font-mono text-lg uppercase tracking-wider"
                maxLength={16}
                disabled={isSubmitting}
              />
            </div>
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold"
              disabled={isSubmitting || !code.trim()}
            >
              {isSubmitting ? "Joining…" : "Join"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-club-name" className="text-sm font-medium">
              Create your first club
            </Label>
            <form onSubmit={handleCreateClub} className="flex flex-col gap-2">
              {createError ? (
                <Alert className="border-destructive bg-destructive/10 text-destructive">
                  <AlertDescription>{createError}</AlertDescription>
                </Alert>
              ) : null}
              <Input
                id="new-club-name"
                type="text"
                placeholder="e.g. Friday Night Poker"
                value={newClubName}
                onChange={(e) => {
                  setNewClubName(e.target.value)
                  setCreateError(null)
                }}
                disabled={isCreating}
                className="h-12"
                autoFocus={false}
              />
              <Button
                type="submit"
                variant="outline"
                className="w-full h-12 text-base font-semibold"
                disabled={isCreating || !newClubName.trim()}
              >
                {isCreating ? "Creating…" : "Create Club"}
              </Button>
            </form>
          </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
