"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { useClub } from "@/contexts/ClubContext"
import { AppShell } from "@/components/layout/AppShell"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ListRow } from "@/components/ui/list-row"
import { useIsDesktop } from "@/hooks/useIsDesktop"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Copy,
  Link2,
  Plus,
  UserCog,
  UserPlus,
} from "lucide-react"

function clubInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
}

/** Join-code tile with copy chip — visible to owner/admin only (RLS also
 * strips join_code for members, so this is belt-and-braces). */
function JoinCodeTile({ joinCode }: { joinCode: string }) {
  const [copied, setCopied] = useState(false)
  const [fallbackMode, setFallbackMode] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const showCopiedFeedback = () => {
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinCode)
      showCopiedFeedback()
      return
    } catch {
      /* clipboard failed */
    }
    try {
      const input = inputRef.current
      if (input) {
        input.focus()
        input.select()
        input.setSelectionRange(0, joinCode.length)
        const ok = document.execCommand("copy")
        if (ok) {
          showCopiedFeedback()
          return
        }
      }
    } catch {
      /* execCommand fallback failed */
    }
    setFallbackMode(true)
  }

  return (
    <div className="rounded-tile border bg-background/45 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Join code
          </p>
          <input
            ref={inputRef}
            readOnly
            value={joinCode}
            aria-label="Club join code"
            className="mt-0.5 w-full bg-transparent font-mono text-xl font-extrabold tracking-[0.25em] text-foreground outline-none focus:ring-0"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 shrink-0 gap-1.5 px-4"
          onClick={handleCopy}
          aria-label={copied ? "Copied" : "Copy join code"}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy
            </>
          )}
        </Button>
      </div>
      {fallbackMode && (
        <p className="mt-1 text-xs text-muted-foreground">Tap and hold to copy</p>
      )}
    </div>
  )
}

export default function ClubsPage() {
  const router = useRouter()
  const isDesktop = useIsDesktop()
  const { user, loading: authLoading } = useAuth()
  const { clubs, activeClub, loading: clubsLoading, setActiveClub, createClub } = useClub()
  const [switchingClubId, setSwitchingClubId] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newClubName, setNewClubName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/")
    }
  }, [authLoading, user, router])

  if (authLoading || clubsLoading) {
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

  const canManage = activeClub?.role === "owner" || activeClub?.role === "admin"
  const otherClubs = clubs.filter((c) => c.id !== activeClub?.id)

  const handleSwitch = async (clubId: string) => {
    if (switchingClubId) return
    setSwitchingClubId(clubId)
    await setActiveClub(clubId)
    setSwitchingClubId(null)
  }

  const handleCreateClub = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newClubName.trim()
    if (!name) return
    setIsCreating(true)
    setCreateError(null)
    const club = await createClub(name)
    setIsCreating(false)
    if (club) {
      await setActiveClub(club.id)
      setShowCreateDialog(false)
      setNewClubName("")
    } else {
      setCreateError("Failed to create club. Please try again.")
    }
  }

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
              My Clubs
            </h1>
          </div>

          {/* Hero — active club */}
          {activeClub ? (
            <Card className="overflow-hidden border-primary/30">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-10 -right-3 select-none text-[150px] leading-none text-primary/5 -rotate-12"
              >
                ♣
              </span>
              <CardContent className="relative space-y-3 p-5">
                <div className="flex items-start gap-3">
                  <div
                    aria-hidden="true"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-lg font-extrabold text-primary"
                  >
                    {clubInitials(activeClub.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-xl font-bold">{activeClub.name}</h2>
                    <p className="text-sm text-muted-foreground">Active club</p>
                  </div>
                  <Badge variant="role" className="shrink-0 uppercase">
                    {activeClub.role}
                  </Badge>
                </div>

                {/* Owner/admin only — join code (RLS hides it for members anyway) */}
                {canManage && activeClub.joinCode && (
                  <JoinCodeTile joinCode={activeClub.joinCode} />
                )}

                {/* Management — role-gated */}
                {canManage && (
                  <div className="space-y-2">
                    <ListRow
                      href="/club/members"
                      avatar={<UserCog className="h-4 w-4" />}
                      title="Manage members"
                      subtitle="Roles, removals, invites"
                      right={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    />
                    {activeClub.slug === "base44" && (
                      <ListRow
                        href="/club/link-players"
                        avatar={<Link2 className="h-4 w-4" />}
                        title="Link players"
                        subtitle="Match guests to member accounts"
                        right={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-10 text-center space-y-2">
                <p className="text-lg font-medium">No active club</p>
                <p className="text-sm text-muted-foreground">
                  Join a club with a code or create your own below.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Switch club */}
          {otherClubs.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-base font-semibold">Switch club</h3>
              {otherClubs.map((club) => (
                <ListRow
                  key={club.id}
                  onClick={() => handleSwitch(club.id)}
                  avatar={clubInitials(club.name)}
                  title={club.name}
                  subtitle={switchingClubId === club.id ? "Switching…" : undefined}
                  right={
                    <Badge variant="secondary" className="uppercase text-[10px]">
                      {club.role}
                    </Badge>
                  }
                />
              ))}
              <p className="text-center text-xs text-muted-foreground">
                Tap a club to make it active
              </p>
            </section>
          )}

          {/* Actions */}
          <div className="space-y-2.5">
            <Button
              variant="outline"
              className="w-full h-12 text-base font-semibold gap-2"
              onClick={() => router.push("/join")}
            >
              <UserPlus className="h-4 w-4" />
              Join a club with code
            </Button>
            <Button
              className="w-full h-12 text-base font-semibold gap-2"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="h-4 w-4" />
              Create new club
            </Button>
          </div>
        </div>
      </div>

      {/* Create Club Dialog */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open)
          if (!open) {
            setNewClubName("")
            setCreateError(null)
          }
        }}
      >
        <DialogContent
          className="!flex !flex-col p-0 gap-0 !max-h-[90vh] md:!max-w-lg md:!max-h-[85vh] md:p-6 md:gap-4 md:rounded-card !bottom-0 !left-0 !right-0 !top-auto !translate-y-0 rounded-t-card rounded-b-none md:!left-[50%] md:!top-[50%] md:!right-auto md:!bottom-auto md:!translate-x-[-50%] md:!translate-y-[-50%] md:!rounded-card"
          onOpenAutoFocus={(e) => {
            if (!isDesktop) e.preventDefault()
          }}
        >
          <form onSubmit={handleCreateClub} className="flex flex-col h-full min-h-0">
            <div className="flex-shrink-0 px-4 pt-5 pb-4 border-b md:border-b-0 md:p-0 md:pb-0">
              <DialogHeader className="md:text-left">
                <DialogTitle className="text-xl md:text-lg font-semibold">Create New Club</DialogTitle>
                <DialogDescription className="text-sm mt-1.5 text-muted-foreground md:mt-0">
                  Create a new club to organize your poker sessions.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 md:flex-none md:min-h-auto md:overflow-visible md:p-0 md:py-4">
              {createError && (
                <p className="text-sm text-destructive" role="alert">{createError}</p>
              )}
              <div className="space-y-2">
                <Label htmlFor="clubs-new-name" className="text-sm font-semibold block text-foreground">
                  Club Name
                </Label>
                <Input
                  id="clubs-new-name"
                  type="text"
                  placeholder="e.g., Friday Night Game Club"
                  value={newClubName}
                  onChange={(e) => {
                    setNewClubName(e.target.value)
                    setCreateError(null)
                  }}
                  disabled={isCreating}
                  className="h-12 md:h-10 text-base md:text-sm"
                  autoFocus={false}
                />
              </div>
            </div>
            <div className="flex-shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 border-t bg-background md:border-t-0 md:bg-transparent md:p-0 md:pt-4 md:pb-0">
              <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end md:gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowCreateDialog(false)
                    setNewClubName("")
                  }}
                  disabled={isCreating}
                  className="h-11 md:h-10 order-2 md:order-1 text-base md:text-sm"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating || !newClubName.trim()}
                  className="h-12 md:h-10 order-1 md:order-2 md:min-w-[140px] text-base md:text-sm font-medium"
                >
                  {isCreating ? "Creating…" : "Create Club"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
