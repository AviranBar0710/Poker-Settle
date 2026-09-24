/**
 * PostgREST (Supabase) silently caps every response at `max-rows` (1000 by default).
 * A plain `.select()` over a large table returns only the first 1000 rows with no
 * error — so any multi-session query (club stats, history, session lists) must page.
 */
export const SUPABASE_PAGE_SIZE = 1000

type PageResult<T> = PromiseLike<{ data: T[] | null; error: unknown }>

/**
 * Fetch every row of a query by paging with `.range(from, to)`.
 *
 * `buildPage` must build a fresh query for each call and apply a deterministic
 * `.order(...)` (end with a unique column such as `id`), otherwise pages can
 * overlap or skip rows.
 *
 * Example:
 *   fetchAllRows((from, to) =>
 *     supabase.from("transactions").select("*").in("session_id", ids)
 *       .order("created_at").order("id").range(from, to))
 */
export async function fetchAllRows<T>(
  buildPage: (from: number, to: number) => PageResult<T>
): Promise<{ data: T[]; error: unknown }> {
  const rows: T[] = []
  for (;;) {
    const from = rows.length
    const { data, error } = await buildPage(from, from + SUPABASE_PAGE_SIZE - 1)
    if (error) return { data: rows, error }
    const page = data ?? []
    rows.push(...page)
    // Stop on an empty page rather than a short one: the server's max-rows may be
    // lower than our page size, so a short page does not prove we reached the end.
    if (page.length === 0) return { data: rows, error: null }
  }
}
