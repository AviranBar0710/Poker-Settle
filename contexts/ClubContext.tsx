"use client"

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react"
import { supabase } from "@/lib/supabaseClient"
import { ClubWithMembership, Club } from "@/types/club"
import { useAuth } from "./AuthContext"

export type JoinClubResult =
  | { success: true; clubId: string; clubName: string }
  | { success: false; error: string }

interface ClubContextType {
  clubs: ClubWithMembership[]
  activeClub: ClubWithMembership | null
  activeClubId: string | null
  loading: boolean
  error: string | null
  /** True when authenticated user has zero clubs (must join via code). */
  needsOnboarding: boolean
  setActiveClub: (clubId: string) => Promise<void>
  createClub: (name: string) => Promise<Club | null>
  refreshClubs: () => Promise<void>
  /** Join a club by code (RPC). On success, refreshes clubs and sets active club. */
  joinClubByCode: (code: string) => Promise<JoinClubResult>
}

const ClubContext = createContext<ClubContextType | undefined>(undefined)

export function ClubProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [clubs, setClubs] = useState<ClubWithMembership[]>([])
  const [activeClub, setActiveClubState] = useState<ClubWithMembership | null>(null)
  const [activeClubId, setActiveClubId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Generate unique slug from name
  const generateSlug = useCallback((name: string): string => {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    const random = Math.random().toString(36).substring(2, 8)
    return `${base}-${random}`
  }, [])

  // Load user's clubs
  const loadClubs = useCallback(async () => {
    if (!user) {
      setClubs([])
      setActiveClubState(null)
      setActiveClubId(null)
      setLoading(false)
      return
    }

    try {
      setError(null)
      const selectWithJoinCode = `
        club_id,
        role,
        created_at,
        clubs (
          id,
          name,
          slug,
          join_code,
          created_by,
          created_at
        )
      `
      let data: any[] | null = null
      let clubsError: { message?: string; code?: string; details?: string; hint?: string } | null = null
      let usedJoinCode = true

      const res = await supabase
        .from("club_members")
        .select(selectWithJoinCode)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })

      clubsError = res.error
      data = res.data

      if (clubsError) {
        const msg = String(clubsError.message ?? clubsError.details ?? clubsError.hint ?? clubsError.code ?? "")
        const likelyMissingColumn =
          msg.includes("join_code") ||
          msg.includes("column") && (msg.includes("does not exist") || msg.includes("undefined"))
        if (likelyMissingColumn) {
          const fallback = await supabase
            .from("club_members")
            .select(`
              club_id,
              role,
              created_at,
              clubs (
                id,
                name,
                slug,
                created_by,
                created_at
              )
            `)
            .eq("user_id", user.id)
            .order("created_at", { ascending: true })
          if (!fallback.error) {
            data = fallback.data
            clubsError = null
            usedJoinCode = false
          }
        }
      }

      if (clubsError) {
        const err = clubsError as any
        const errMessage =
          err?.message ??
          err?.details ??
          err?.hint ??
          err?.code ??
          (typeof clubsError === "string" ? clubsError : "Failed to load clubs")
        console.error("Error loading clubs:", {
          message: err?.message,
          details: err?.details,
          hint: err?.hint,
          code: err?.code,
          raw: clubsError,
        })
        try {
          console.error("Error (JSON):", JSON.stringify(clubsError, Object.getOwnPropertyNames(clubsError)))
        } catch {
          /* ignore */
        }
        setError(errMessage)
        setClubs([])
        setLoading(false)
        return
      }

      if (!data || data.length === 0) {
        // v1.1: No auto-create. User must join via code.
        setClubs([])
        setActiveClubState(null)
        setActiveClubId(null)
        setLoading(false)
        return
      }

      const clubsWithMembership: ClubWithMembership[] = data.map((item: any) => ({
        id: item.clubs.id,
        name: item.clubs.name,
        slug: item.clubs.slug,
        joinCode: item.clubs.join_code ?? null,
        createdBy: item.clubs.created_by,
        createdAt: item.clubs.created_at,
        role: item.role,
      }))

      setClubs(clubsWithMembership)

      // Load active club from profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("active_club_id")
        .eq("id", user.id)
        .single()

      if (profileError && profileError.code !== 'PGRST116') {
        console.error("Error loading profile:", profileError)
      }

      let targetClubId = profile?.active_club_id || null

      // If active club from profile doesn't exist in user's clubs, use first club
      if (targetClubId) {
        const clubExists = clubsWithMembership.find((c) => c.id === targetClubId)
        if (!clubExists) {
          targetClubId = clubsWithMembership[0]?.id || null
        }
      } else {
        targetClubId = clubsWithMembership[0]?.id || null
      }

      if (targetClubId) {
        const club = clubsWithMembership.find((c) => c.id === targetClubId) || null
        setActiveClubState(club)
        setActiveClubId(targetClubId)
      } else {
        setActiveClubState(null)
        setActiveClubId(null)
      }

      setLoading(false)
    } catch (err) {
      console.error("Unexpected error loading clubs:", err)
      setError(err instanceof Error ? err.message : "Failed to load clubs")
      setLoading(false)
    }
  }, [user])

  // Join club by code (RPC). On success, updates profile and refreshes clubs.
  const joinClubByCode = useCallback(
    async (code: string): Promise<JoinClubResult> => {
      if (!user) {
        return { success: false, error: "Not authenticated" }
      }
      const trimmed = String(code).trim().toUpperCase()
      if (!trimmed) {
        return { success: false, error: "Please enter a join code" }
      }
      try {
        setError(null)
        const { data, error: rpcError } = await supabase.rpc("join_club_by_code", {
          p_join_code: trimmed,
        })
        if (rpcError) {
          const msg = rpcError.message || "Failed to join club"
          setError(msg)
          return { success: false, error: msg }
        }
        const row = Array.isArray(data) ? data[0] : data
        if (!row || !row.club_id) {
          return { success: false, error: "Invalid join code" }
        }
        if (row.status === "invalid_code") {
          return { success: false, error: "Invalid join code" }
        }
        const clubId = row.club_id as string
        const clubName = (row.club_name as string) || "Club"
        const { error: updateErr } = await supabase
          .from("profiles")
          .update({ active_club_id: clubId })
          .eq("id", user.id)
        if (updateErr) {
          console.error("Error updating active club after join:", updateErr)
          setError(updateErr.message)
          return { success: false, error: updateErr.message }
        }
        await loadClubs()
        return { success: true, clubId, clubName }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to join club"
        setError(msg)
        return { success: false, error: msg }
      }
    },
    [user, loadClubs]
  )

  // Create a new club
  const createClub = useCallback(
    async (name: string): Promise<Club | null> => {
      if (!user) {
        setError("User not authenticated")
        return null
      }

      try {
        setError(null)
        
        // Verify session is active
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setError("Your session has expired. Please log in again.")
          return null
        }
        
        const slug = generateSlug(name)

        // Create club
        const { data: clubData, error: clubError } = await supabase
          .from("clubs")
          .insert({
            name,
            slug,
            created_by: user.id,
          })
          .select()
          .single()

        if (clubError) {
          // Log full error for debugging - try multiple ways to extract info
          const errorInfo: any = {
            message: clubError.message,
            details: clubError.details,
            hint: clubError.hint,
            code: (clubError as any)?.code,
            status: (clubError as any)?.status,
            statusCode: (clubError as any)?.statusCode,
          }
          
          // Try to stringify the entire error object
          try {
            console.error("Error creating club:", JSON.stringify(clubError, Object.getOwnPropertyNames(clubError)))
          } catch {
            console.error("Error creating club (raw):", clubError)
            console.error("Error creating club (keys):", Object.keys(clubError))
          }
          
          // Extract error message from various possible properties
          const errorMessage = 
            clubError.message || 
            clubError.details || 
            clubError.hint || 
            (clubError as any)?.code ||
            (clubError as any)?.status ||
            (typeof clubError === 'string' ? clubError : "Failed to create club. This might be a permissions issue. Please check if you're logged in and try again.")
          
          console.error("Error message extracted:", errorMessage)
          setError(errorMessage)
          return null
        }

        if (!clubData) {
          console.error("No club data returned from insert")
          setError("Failed to create club: No data returned")
          return null
        }

        // Add user as owner
        const { error: memberError } = await supabase
          .from("club_members")
          .insert({
            club_id: clubData.id,
            user_id: user.id,
            role: "owner",
          })

        if (memberError) {
          // Log full error for debugging
          try {
            console.error("Error adding owner membership:", JSON.stringify(memberError, Object.getOwnPropertyNames(memberError)))
          } catch {
            console.error("Error adding owner membership (raw):", memberError)
            console.error("Error adding owner membership (keys):", Object.keys(memberError))
          }
          
          // Clean up club
          await supabase.from("clubs").delete().eq("id", clubData.id)
          
          // Extract error message from various possible properties
          const errorMessage = 
            memberError.message || 
            memberError.details || 
            memberError.hint || 
            (memberError as any)?.code ||
            (memberError as any)?.status ||
            (typeof memberError === 'string' ? memberError : "Failed to add membership. Please try again.")
          
          console.error("Member error message extracted:", errorMessage)
          setError(errorMessage)
          return null
        }

        // Reload clubs
        await loadClubs()

        return {
          id: clubData.id,
          name: clubData.name,
          slug: clubData.slug,
          createdBy: clubData.created_by,
          createdAt: clubData.created_at,
        }
      } catch (err) {
        console.error("Unexpected error creating club:", err)
        setError(err instanceof Error ? err.message : "Failed to create club")
        return null
      }
    },
    [user, generateSlug, loadClubs]
  )

  // Set active club
  const setActiveClub = useCallback(
    async (clubId: string) => {
      if (!user) {
        setError("User not authenticated")
        return
      }

      try {
        setError(null)

        // Verify user is a member of this club
        const club = clubs.find((c) => c.id === clubId)
        if (!club) {
          setError("Club not found or you are not a member")
          return
        }

        // Update profile (use update instead of upsert since profile should already exist)
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            active_club_id: clubId,
          })
          .eq("id", user.id)

        if (updateError) {
          // Log full error for debugging
          console.error("Error updating active club - Full error object:", {
            message: updateError.message,
            details: updateError.details,
            hint: updateError.hint,
            code: (updateError as any)?.code,
            statusCode: (updateError as any)?.statusCode,
            error: updateError
          })
          
          // Extract error message from various possible properties
          const errorMessage = 
            updateError.message || 
            updateError.details || 
            updateError.hint || 
            (updateError as any)?.code ||
            (updateError as any)?.status ||
            (typeof updateError === 'string' ? updateError : "Failed to update active club. Please check your permissions and try again.")
          
          console.error("Update error message extracted:", errorMessage)
          setError(errorMessage)
          return
        }

        // Update state
        setActiveClubState(club)
        setActiveClubId(clubId)
      } catch (err) {
        console.error("Unexpected error setting active club:", err)
        setError(err instanceof Error ? err.message : "Failed to set active club")
      }
    },
    [user, clubs]
  )

  // Refresh clubs
  const refreshClubs = useCallback(async () => {
    await loadClubs()
  }, [loadClubs])

  // Load clubs on mount and when user changes
  useEffect(() => {
    loadClubs()
  }, [loadClubs])

  const needsOnboarding = !!user && !loading && clubs.length === 0

  return (
    <ClubContext.Provider
      value={{
        clubs,
        activeClub,
        activeClubId,
        loading,
        error,
        needsOnboarding,
        setActiveClub,
        createClub,
        refreshClubs,
        joinClubByCode,
      }}
    >
      {children}
    </ClubContext.Provider>
  )
}

export function useClub() {
  const context = useContext(ClubContext)
  if (context === undefined) {
    throw new Error("useClub must be used within a ClubProvider")
  }
  return context
}

