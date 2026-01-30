"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { useClub } from "@/contexts/ClubContext"
import { useIsDesktop } from "@/hooks/useIsDesktop"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Users } from "lucide-react"

export default function JoinPage() {
  const router = useRouter()
  const isDesktop = useIsDesktop()
  const { user, loading: authLoading } = useAuth()
  const { needsOnboarding, loading: clubsLoading, joinClubByCode, error: clubError } = useClub()
  const [code, setCode] = useState("")
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (authLoading || clubsLoading) return
    if (!user) {
      router.replace("/")
      return
    }
    if (!needsOnboarding) {
      router.replace("/")
    }
  }, [user, authLoading, clubsLoading, needsOnboarding, router])

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
      router.push("/sessions")
      return
    }
    setSubmitError(result.error)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value.trim().toUpperCase())
    setSubmitError(null)
  }

  if (authLoading || clubsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (!needsOnboarding) {
    return null
  }

  const err = submitError || clubError

  return (
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
            Enter the join code from your club to get started.
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
        </CardContent>
      </Card>
    </div>
  )
}
