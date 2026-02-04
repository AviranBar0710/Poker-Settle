"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { AppShell } from "@/components/layout/AppShell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useClub } from "@/contexts/ClubContext"
import { Link2, Search, Loader2, UserPlus } from "lucide-react"

type UnlinkedPlayer = { id: string; name: string; sessionId: string; sessionName: string; sessionDate: string }
type ProfileMatch = { user_id: string; email: string | null; display_name: string | null }

export default function LinkPlayersPage() {
  const router = useRouter()
  const { activeClubId, activeClub } = useClub()
  const [players, setPlayers] = useState<UnlinkedPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assignTarget, setAssignTarget] = useState<{ playerId: string; playerName: string } | { playerName: string; bulk: true } | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<ProfileMatch[]>([])
  const [searching, setSearching] = useState(false)
  const [linking, setLinking] = useState(false)

  const canAccess = activeClub?.slug === "base44" && (activeClub?.role === "owner" || activeClub?.role === "admin")

  const loadPlayers = useCallback(async () => {
    if (!activeClubId || !canAccess) return
    setLoading(true)
    setError(null)
    try {
      const { data: playersData, error: playersErr } = await supabase
        .from("players")
        .select("id, name, session_id, sessions(id, name, created_at)")
        .eq("club_id", activeClubId)
        .is("profile_id", null)
        .order("name", { ascending: true })
      if (playersErr) { setError(playersErr.message || "Failed to load"); setPlayers([]); return }
      const rows: UnlinkedPlayer[] = (playersData || [])
        .filter((p: { sessions?: unknown }) => p.sessions)
        .map((p: { id: string; name?: string; session_id: string; sessions?: { name?: string; created_at?: string } }) => ({
          id: p.id,
          name: p.name || "Unknown",
          sessionId: p.session_id,
          sessionName: p.sessions?.name || "Session",
          sessionDate: p.sessions?.created_at || "",
        }))
      setPlayers(rows)
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); setPlayers([]) }
    finally { setLoading(false) }
  }, [activeClubId, canAccess])

  useEffect(() => {
    if (!canAccess && activeClub?.slug !== "base44") router.replace("/")
    else loadPlayers()
  }, [canAccess, activeClub?.slug, router, loadPlayers])

  const handleSearch = useCallback(async () => {
    if (!activeClubId || searchQuery.trim().length < 2) { setSearchResults([]); return }
    setSearching(true)
    setSearchResults([])
    try {
      const { data, error: rpcErr } = await supabase.rpc("search_profiles_by_email", { p_club_id: activeClubId, p_search: searchQuery.trim() })
      if (rpcErr) { setError(rpcErr.message || "Search failed"); return }
      setSearchResults((data as ProfileMatch[]) || [])
    } catch (e) { setError(e instanceof Error ? e.message : "Search failed") }
    finally { setSearching(false) }
  }, [activeClubId, searchQuery])

  const handleSelectProfile = async (profileId: string) => {
    if (!activeClubId || !assignTarget) return
    setLinking(true)
    setError(null)
    try {
      if ("bulk" in assignTarget && assignTarget.bulk) {
        const { error: rpcErr } = await supabase.rpc("link_players_by_name_to_profile", {
          p_club_id: activeClubId, p_player_name: assignTarget.playerName, p_profile_id: profileId,
        })
        if (rpcErr) { setError(rpcErr.message || "Link failed"); return }
      } else {
        const { data, error: rpcErr } = await supabase.rpc("link_player_to_profile", {
          p_player_id: assignTarget.playerId, p_profile_id: profileId,
        })
        if (rpcErr) { setError(rpcErr.message || "Link failed"); return }
        if ((data as { status?: string }[])?.[0]?.status === "no_update") setError("Player was not updated")
      }
      setAssignDialogOpen(false)
      setAssignTarget(null)
      setSearchQuery("")
      setSearchResults([])
      await loadPlayers()
    } catch (e) { setError(e instanceof Error ? e.message : "Link failed") }
    finally { setLinking(false) }
  }

  const openAssignSingle = (playerId: string, playerName: string) => {
    setAssignTarget({ playerId, playerName })
    setAssignDialogOpen(true)
    setSearchQuery("")
    setSearchResults([])
  }

  const openAssignBulk = (playerName: string) => {
    setAssignTarget({ playerName, bulk: true })
    setAssignDialogOpen(true)
    setSearchQuery("")
    setSearchResults([])
  }

  if (!canAccess && !loading) return null

  const groupedByName = players.reduce<Record<string, UnlinkedPlayer[]>>((acc, p) => {
    const key = p.name.trim() || "Unknown"
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  return (
    <AppShell>
      <div className="min-h-screen bg-background p-4 sm:p-6 overflow-x-hidden">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Link Players</h1>
            <p className="text-muted-foreground mt-1 text-sm">Link Base44 migrated players to app profiles.</p>
          </div>
          {error && <Alert className="border-destructive bg-destructive/10"><AlertDescription>{error}</AlertDescription></Alert>}
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : players.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">All players are linked.</p></CardContent></Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Unlinked Players ({players.length})</CardTitle>
                <CardDescription>Click Assign or Link all to link players to profiles.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Player</TableHead><TableHead>Session</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {Object.entries(groupedByName).flatMap(([name, group]) =>
                      group.map((player, idx) => (
                        <TableRow key={player.id}>
                          <TableCell className="font-medium">{player.name}</TableCell>
                          <TableCell>{player.sessionName}</TableCell>
                          <TableCell className="text-muted-foreground">{player.sessionDate ? new Date(player.sessionDate).toLocaleDateString() : "-"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {idx === 0 && group.length > 1 && (
                                <Button variant="outline" size="sm" onClick={() => openAssignBulk(name)} className="gap-1"><UserPlus className="h-3 w-3" />Link all ({group.length})</Button>
                              )}
                              <Button variant="outline" size="sm" onClick={() => openAssignSingle(player.id, player.name)} className="gap-1"><Link2 className="h-3 w-3" />Assign</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <Dialog open={assignDialogOpen} onOpenChange={(o) => { setAssignDialogOpen(o); if (!o) { setAssignTarget(null); setSearchQuery(""); setSearchResults([]); } }}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{assignTarget && "bulk" in assignTarget ? `Link all "${assignTarget.playerName}"` : assignTarget ? `Link "${assignTarget.playerName}"` : "Assign"}</DialogTitle>
            <DialogDescription>Search by email (min 2 chars).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex gap-2">
              <Input id="search-email" placeholder="user@example.com" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} autoFocus={false} className="flex-1" />
              <Button onClick={handleSearch} disabled={searchQuery.trim().length < 2 || searching} className="gap-1">{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Search</Button>
            </div>
            {searchResults.length > 0 && (
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {searchResults.map((r) => (
                  <button key={r.user_id} type="button" onClick={() => handleSelectProfile(r.user_id)} disabled={linking} className="w-full text-left px-4 py-3 hover:bg-accent flex flex-col gap-0.5">
                    <span className="font-medium">{r.email || r.display_name || "Unknown"}</span>
                    {r.display_name && r.email && <span className="text-xs text-muted-foreground">{r.display_name}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
