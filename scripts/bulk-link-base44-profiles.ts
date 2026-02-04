/**
 * One-time bulk identity linking for BASE44 legacy players.
 *
 * Uses PlayerProfile_export_*.csv (full_name, email, ...) to:
 * 1. Create auth users + profiles only for CSV rows (by email)
 * 2. Add them as base44 club members
 * 3. Link players by exact trimmed name match (UPDATE players.profile_id)
 *
 * Does NOT touch players without a match or already linked.
 * Link Players admin UI remains fully functional for future manual linking.
 *
 * Requires: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 * Usage: npx tsx scripts/bulk-link-base44-profiles.ts [path/to/PlayerProfile_export_*.csv]
 */

import * as dotenv from "dotenv"
import { createClient, UserResponse } from "@supabase/supabase-js"

// Prefer .env.local (Next.js convention) so SUPABASE_SERVICE_ROLE_KEY is available
dotenv.config({ path: ".env.local" })
dotenv.config()
import { parse } from "csv-parse/sync"
import * as fs from "fs"
import * as path from "path"

const csvPath =
  process.argv[2] ||
  path.join(process.cwd(), "Legacy_Data", "PlayerProfile_export_04022026.csv")
const url =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.error(
    "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY. Load .env.local or set env."
  )
  process.exit(1)
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

type CsvRow = { full_name: string; email: string }

function loadCsv(filePath: string): CsvRow[] {
  const raw = fs.readFileSync(filePath, "utf-8")
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[]
  return rows
    .map((r) => ({
      full_name: (r.full_name ?? "").trim(),
      email: (r.email ?? "").trim().toLowerCase(),
    }))
    .filter((r) => r.email.length > 0)
}

async function getBase44ClubId(): Promise<string> {
  const { data, error } = await supabase
    .from("clubs")
    .select("id")
    .eq("slug", "base44")
    .limit(1)
    .single()
  if (error || !data?.id) {
    throw new Error("Base44 club not found. Run migrations and ensure club exists.")
  }
  return data.id
}

/** Load all auth users into a map email (lowercase) -> id. */
async function loadEmailToUserId(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  let page = 1
  const perPage = 1000
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    })
    if (error) throw new Error(`listUsers: ${error.message}`)
    for (const u of data.users) {
      if (u.email) map.set(u.email.toLowerCase(), u.id)
    }
    if (data.users.length < perPage) break
    page++
  }
  return map
}

async function ensureUserAndProfile(
  emailToId: Map<string, string>,
  email: string,
  fullName: string
): Promise<string> {
  const existing = emailToId.get(email.toLowerCase())
  if (existing) {
    await supabase.from("profiles").upsert(
      { id: existing, email, display_name: fullName },
      { onConflict: "id" }
    )
    return existing
  }
  const { data: userData, error: createError } =
    await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
  if (createError) {
    if (createError.message?.includes("already been registered")) {
      const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const user = listData?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
      if (user) {
        emailToId.set(email.toLowerCase(), user.id)
        await supabase.from("profiles").upsert(
          { id: user.id, email, display_name: fullName },
          { onConflict: "id" }
        )
        return user.id
      }
    }
    throw new Error(`createUser(${email}): ${createError.message}`)
  }
  const userId = (userData as UserResponse).user?.id
  if (!userId) throw new Error(`createUser returned no id for ${email}`)
  emailToId.set(email.toLowerCase(), userId)
  await supabase.from("profiles").upsert(
    { id: userId, email, display_name: fullName },
    { onConflict: "id" }
  )
  return userId
}

async function ensureClubMember(clubId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("club_members").upsert(
    { club_id: clubId, user_id: userId, role: "member" },
    { onConflict: "club_id,user_id" }
  )
  if (error) throw new Error(`ensureClubMember: ${error.message}`)
}

/** Build map: trimmed player name -> list of player ids (unlinked only). */
async function buildUnlinkedPlayersByName(
  clubId: string
): Promise<Map<string, string[]>> {
  const { data, error } = await supabase
    .from("players")
    .select("id, name")
    .eq("club_id", clubId)
    .is("profile_id", null)
  if (error) throw new Error(`list players: ${error.message}`)
  const map = new Map<string, string[]>()
  for (const row of data ?? []) {
    const name = (row.name ?? "").trim()
    if (!name) continue
    const list = map.get(name) ?? []
    list.push(row.id)
    map.set(name, list)
  }
  return map
}

async function linkPlayersByName(
  unlinkedByName: Map<string, string[]>,
  playerNameTrimmed: string,
  profileId: string
): Promise<number> {
  const ids = unlinkedByName.get(playerNameTrimmed)
  if (!ids || ids.length === 0) return 0
  const { error } = await supabase
    .from("players")
    .update({ profile_id: profileId })
    .in("id", ids)
  if (error) throw new Error(`update players: ${error.message}`)
  unlinkedByName.delete(playerNameTrimmed)
  return ids.length
}

async function main() {
  console.log("CSV path:", csvPath)
  if (!fs.existsSync(csvPath)) {
    console.error("File not found:", csvPath)
    process.exit(1)
  }

  const rows = loadCsv(csvPath)
  console.log("Rows with email:", rows.length)

  const base44Id = await getBase44ClubId()
  console.log("Base44 club id:", base44Id)

  let linksApplied = 0
  const emailToId = await loadEmailToUserId()
  const unlinkedByName = await buildUnlinkedPlayersByName(base44Id)

  for (const row of rows) {
    const nameTrimmed = row.full_name.trim()
    if (!nameTrimmed) continue

    let profileId = emailToId.get(row.email)
    if (!profileId) {
      profileId = await ensureUserAndProfile(emailToId, row.email, row.full_name)
      await ensureClubMember(base44Id, profileId)
    } else {
      await supabase.from("profiles").upsert(
        { id: profileId, email: row.email, display_name: row.full_name },
        { onConflict: "id" }
      )
    }

    const updated = await linkPlayersByName(unlinkedByName, nameTrimmed, profileId)
    linksApplied += updated
  }

  console.log("Done. Unique profiles ensured:", emailToId.size)
  console.log("Player rows linked:", linksApplied)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
