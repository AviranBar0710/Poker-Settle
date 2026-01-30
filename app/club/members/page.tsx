"use client"

import { useCallback, useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabaseClient"
import { AppShell } from "@/components/layout/AppShell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useClub } from "@/contexts/ClubContext"
import { useAuth } from "@/contexts/AuthContext"
import { useIsDesktop } from "@/hooks/useIsDesktop"
import { MoreVertical, UserMinus, Shield, User } from "lucide-react"
import { cn } from "@/lib/utils"

type MemberRow = {
  userId: string
  role: "owner" | "admin" | "member"
  createdAt: string
  displayName: string
}

export default function ClubMembersPage() {
  const { user } = useAuth()
  const { activeClubId, activeClub } = useClub()
  const isDesktop = useIsDesktop()
  const [members, setMembers] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<MemberRow | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const loadMembers = useCallback(async () => {
    if (!activeClubId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from("club_members")
        .select("user_id, role, created_at")
        .eq("club_id", activeClubId)
        .order("created_at", { ascending: true })

      if (fetchError) {
        setError(fetchError.message || "Failed to load members")
        setMembers([])
        return
      }

      const rows: MemberRow[] = (data || []).map((m: any) => ({
        userId: m.user_id,
        role: m.role,
        createdAt: m.created_at,
        displayName: m.user_id === user?.id ? (user?.email || "You") : "Member",
      }))
      setMembers(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load members")
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [activeClubId, user?.id])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!menuOpen) return
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null)
      }
    }
    document.addEventListener("click", onDocClick)
    return () => document.removeEventListener("click", onDocClick)
  }, [menuOpen])

  const canRemove = (m: MemberRow) => {
    if (m.role === "owner") return false
    if (m.userId === user?.id) return false
    return activeClub?.role === "owner" || activeClub?.role === "admin"
  }

  const canChangeRole = (m: MemberRow) => {
    if (m.role === "owner") return false
    if (m.userId === user?.id) return false
    return activeClub?.role === "owner"
  }

  const hasActions = (m: MemberRow) => canRemove(m) || canChangeRole(m)

  const handleRemove = async () => {
    const target = confirmRemove
    if (!target || !activeClubId) return
    setActionLoading(true)
    setError(null)
    try {
      const { error: rpcErr } = await supabase.rpc("remove_club_member", {
        p_club_id: activeClubId,
        p_target_user_id: target.userId,
      })
      if (rpcErr) {
        setError(rpcErr.message || "Failed to remove member")
        return
      }
      setConfirmRemove(null)
      setSuccess("Member removed")
      setTimeout(() => setSuccess(null), 3000)
      await loadMembers()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove member")
    } finally {
      setActionLoading(false)
    }
  }

  const handleRoleChange = async (targetUserId: string, newRole: "admin" | "member") => {
    if (!activeClubId) return
    setActionLoading(true)
    setError(null)
    setMenuOpen(null)
    try {
      const { error: rpcErr } = await supabase.rpc("update_club_member_role", {
        p_club_id: activeClubId,
        p_target_user_id: targetUserId,
        p_new_role: newRole,
      })
      if (rpcErr) {
        setError(rpcErr.message || "Failed to update role")
        return
      }
      setSuccess(`Role updated to ${newRole}`)
      setTimeout(() => setSuccess(null), 3000)
      await loadMembers()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update role")
    } finally {
      setActionLoading(false)
    }
  }

  if (!activeClubId) {
    return null
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Members</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              {activeClub?.name} — manage members and roles
            </p>
          </div>

          {error && (
            <Alert className="border-destructive bg-destructive/10 text-destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <Card>
              <CardContent className="py-12">
                <p className="text-center text-muted-foreground">Loading members…</p>
              </CardContent>
            </Card>
          ) : members.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <p className="text-center text-muted-foreground">No members found.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="md:hidden space-y-3">
                {members.map((m) => (
                  <Card key={m.userId}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{m.displayName}</p>
                          <Badge
                            variant={m.role === "owner" ? "default" : "secondary"}
                            className="mt-1 text-xs"
                          >
                            {m.role}
                          </Badge>
                        </div>
                        {hasActions(m) && (
                          <div
                            className="relative shrink-0"
                            ref={menuOpen === m.userId ? menuRef : undefined}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                setMenuOpen(menuOpen === m.userId ? null : m.userId)
                              }}
                              aria-label="Actions"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                            {menuOpen === m.userId && (
                              <div
                                className="absolute right-0 top-full mt-1 w-48 rounded-lg border bg-background shadow-lg z-50 py-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {canRemove(m) && (
                                  <button
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                                    onClick={() => {
                                      setMenuOpen(null)
                                      setConfirmRemove(m)
                                    }}
                                  >
                                    <UserMinus className="h-4 w-4" />
                                    Remove
                                  </button>
                                )}
                                {canChangeRole(m) && (
                                  <>
                                    {m.role !== "admin" && (
                                      <button
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                                        onClick={() => handleRoleChange(m.userId, "admin")}
                                      >
                                        <Shield className="h-4 w-4" />
                                        Make admin
                                      </button>
                                    )}
                                    {m.role !== "member" && (
                                      <button
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                                        onClick={() => handleRoleChange(m.userId, "member")}
                                      >
                                        <User className="h-4 w-4" />
                                        Make member
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Desktop: table */}
              <Card className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((m) => (
                      <TableRow key={m.userId}>
                        <TableCell className="font-medium">{m.displayName}</TableCell>
                        <TableCell>
                          <Badge variant={m.role === "owner" ? "default" : "secondary"}>
                            {m.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {hasActions(m) && (
                            <div
                              className="relative inline-block"
                              ref={menuOpen === m.userId ? menuRef : undefined}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setMenuOpen(menuOpen === m.userId ? null : m.userId)
                                }}
                                aria-label="Actions"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                              {menuOpen === m.userId && (
                                <div
                                  className="absolute right-0 top-full mt-1 w-48 rounded-lg border bg-background shadow-lg z-50 py-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {canRemove(m) && (
                                    <button
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                                      onClick={() => {
                                        setMenuOpen(null)
                                        setConfirmRemove(m)
                                      }}
                                    >
                                      <UserMinus className="h-4 w-4" />
                                      Remove
                                    </button>
                                  )}
                                  {canChangeRole(m) && (
                                    <>
                                      {m.role !== "admin" && (
                                        <button
                                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                                          onClick={() => handleRoleChange(m.userId, "admin")}
                                        >
                                          <Shield className="h-4 w-4" />
                                          Make admin
                                        </button>
                                      )}
                                      {m.role !== "member" && (
                                        <button
                                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                                          onClick={() => handleRoleChange(m.userId, "member")}
                                        >
                                          <User className="h-4 w-4" />
                                          Make member
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Confirm remove dialog */}
      <Dialog open={!!confirmRemove} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <DialogContent
          className={cn(
            "!flex !flex-col p-0 gap-0 !max-h-[90vh] md:!max-w-md md:p-6 md:gap-4",
            "!bottom-0 !left-0 !right-0 !top-auto !translate-y-0 rounded-t-lg rounded-b-none",
            "md:!left-[50%] md:!top-[50%] md:!right-auto md:!bottom-auto md:!translate-x-[-50%] md:!translate-y-[-50%] md:!rounded-lg"
          )}
          onOpenAutoFocus={(e) => !isDesktop && e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Remove member</DialogTitle>
            <DialogDescription>
              Remove {confirmRemove?.displayName ?? "this member"}? They will lose access to this club.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => setConfirmRemove(null)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={actionLoading}
            >
              {actionLoading ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
