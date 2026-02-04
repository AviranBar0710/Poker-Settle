# Base44 Legacy Migration Guide

One-time production migration of poker sessions from base44 CSVs into Poker Settle.

## Prerequisites

- Apply migrations up to `20250126000002_base44_migrate_data.sql` (or run them in Supabase SQL Editor)
- Export base44 data as CSVs: **GameSession** and **GamePlayer**

## Expected CSV Format (matches base44 export)

### GameSession

| Column       | Type   | Required | Notes                         |
|--------------|--------|----------|-------------------------------|
| id           | text   | yes      | Unique session identifier     |
| game_date    | text   | no       | Session date (ISO 8601)       |
| currency     | text   | no       | USD, ILS, EUR (default: USD)  |
| is_sample    | text   | no       | `"true"` / `"false"` – only `false` migrated |
| created_date | text   | no       | Alternative date              |
| (others)     | —      | no       | chip_ratio, status, total_pot, etc. |

### GamePlayer

| Column            | Type    | Required | Notes                    |
|-------------------|---------|----------|--------------------------|
| id                | text    | yes      | Unique player row id     |
| game_session_id   | text    | yes      | Must match GameSession.id|
| player_name       | text    | no       | Player name              |
| total_buy_in      | numeric | yes      | Total buy-in amount      |
| final_value       | numeric | yes      | **SOURCE OF TRUTH** – never modified |
| is_sample         | text    | no       | Only `false` rows migrated |
| (others)          | —       | no       | player_name_display, etc. |

## Migration Steps

### 1. Apply staging migrations

In Supabase SQL Editor, run in order:

1. `20250126000000_base44_staging_tables.sql`
2. `20250126000001_base44_staging_csv_columns.sql`

Or use `supabase db push` (000002 will fail until staging is populated—run it after loading CSVs).

### 2. Load CSVs into staging tables

**Supabase Dashboard:** Table Editor → select `staging_base44_game_session` → Add data → Import CSV from file. Repeat for `staging_base44_game_player`.

**Load order:** GameSession first (GamePlayer references it).

### 3. Run data migration

After loading both CSVs, in Supabase SQL Editor run `20250126000002_base44_migrate_data.sql`.

### 4. Validation queries

```sql
-- Per-session balance (delta should be 0)
SELECT s.id, s.name,
       SUM(CASE WHEN t.type = 'buyin' THEN t.amount ELSE 0 END) AS buyins,
       SUM(CASE WHEN t.type = 'cashout' THEN t.amount ELSE 0 END) AS cashouts,
       SUM(CASE WHEN t.type = 'buyin' THEN t.amount ELSE 0 END) -
       SUM(CASE WHEN t.type = 'cashout' THEN t.amount ELSE 0 END) AS delta
FROM sessions s
LEFT JOIN transactions t ON t.session_id = s.id
WHERE s.club_id = (SELECT id FROM clubs WHERE slug = 'base44' LIMIT 1)
GROUP BY s.id, s.name;

-- Row counts comparison
SELECT 'staging_sessions' AS source, COUNT(*) FROM staging_base44_game_session
  WHERE (is_sample IS NULL OR LOWER(TRIM(is_sample)) NOT IN ('true', '1'))
UNION ALL
SELECT 'migrated_sessions', COUNT(*) FROM sessions WHERE club_id = (SELECT id FROM clubs WHERE slug = 'base44' LIMIT 1)
UNION ALL
SELECT 'staging_players', COUNT(*) FROM staging_base44_game_player gp
  WHERE (gp.is_sample IS NULL OR LOWER(TRIM(gp.is_sample)) NOT IN ('true', '1'))
  AND EXISTS (SELECT 1 FROM staging_base44_game_session gs WHERE gs.id = gp.game_session_id
    AND (gs.is_sample IS NULL OR LOWER(TRIM(gs.is_sample)) NOT IN ('true', '1')))
UNION ALL
SELECT 'migrated_players', COUNT(*) FROM players WHERE club_id = (SELECT id FROM clubs WHERE slug = 'base44' LIMIT 1);
```

## Migration Rules

- **final_value** is never modified.
- Each real player gets exactly 2 transactions: BUYIN = total_buy_in, CASHOUT = final_value.
- Per-session delta = Σ(total_buy_in) − Σ(final_value). If non-zero, a synthetic player "House / Rounding" is added to balance the session.
- No auth users created. No profile_id linking.
- Only rows with `is_sample` not `'true'`/`'1'` are migrated.

---

## Bulk identity linking (PlayerProfile CSV)

After sessions and players are migrated, you can link legacy player **names** to app **profiles** using an export of BASE44 player identities.

### Purpose

- **Enrichment only:** The CSV is used only to create auth users + profiles for known players and to link `players.profile_id` by **exact trimmed name match**.
- Players that do **not** appear in the CSV (or have no matching name in migrated data) stay `profile_id = NULL`. They can be linked later via the **Link Players** admin UI.
- No flags or locks are added; future manual linking remains fully supported.

### PlayerProfile CSV format

Export from BASE44 as `PlayerProfile_export_*.csv`. Required columns:

| Column   | Use                    |
|----------|------------------------|
| full_name| Matched to `players.name` (trimmed, exact) |
| email    | Used to create/find auth user and profile  |
| phone_number, cumulative_profit_loss, etc. | Ignored for linking |

### How to run

1. **Prerequisites**
   - Migrations applied (including `20250127000001_link_players_admin_rpc.sql`).
   - Base44 club exists (`slug = 'base44'`).
   - `profiles` table exists (Supabase often creates it via auth trigger; the script upserts by `id`).

2. **Environment**
   - `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`) in `.env.local` or env.

3. **Run the script**
   ```bash
   npm run bulk-link-base44
   # Or with explicit CSV path:
   npx tsx scripts/bulk-link-base44-profiles.ts path/to/PlayerProfile_export_04022026.csv
   ```
   Default CSV path: `Legacy_Data/PlayerProfile_export_04022026.csv`.

### What the script does

1. **Parse CSV** – Keeps rows with non-empty `email`; uses `full_name` and `email` only.
2. **For each row (by unique email):**
   - If the email already has an auth user, uses that user id and upserts `profiles` (id, email, display_name).
   - Otherwise creates an auth user (`email_confirm: true`), then upserts `profiles`.
   - Adds the user as a **base44 club member** (role `member`) so they can see the club when they sign in.
3. **Linking:** For each CSV row, updates `players` where `club_id = base44` and `trim(name) = trim(full_name)` and `profile_id IS NULL`, setting `profile_id` to that profile. Each unlinked player row is linked at most once (script uses a single snapshot of unlinked players).

### Safety and future linking

- **Only links when there is an exact match:** `trim(players.name) = trim(full_name)` and `profile_id IS NULL`. No other players are updated.
- **No schema or flag changes:** No columns or flags are added that would block later manual linking.
- **Link Players UI unchanged:** Admins can still use **Assign** / **Link all** for any remaining or new unlinked players at any time.
