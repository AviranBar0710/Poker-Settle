import { createClient } from "@supabase/supabase-js"

/**
 * Wraps fetch to catch "Load failed" / network errors (common on mobile Safari via ngrok).
 * Returns a 503 response instead of throwing, so Supabase handles it gracefully.
 */
function safeFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return fetch(input, init).catch((err: unknown) => {
    const msg = String((err as Error)?.message ?? "")
    const name = String((err as Error)?.name ?? "")
    const isNetworkError =
      name === "TypeError" ||
      name === "AuthRetryableFetchError" ||
      msg === "Load failed" ||
      msg === "Failed to fetch" ||
      msg === "fetch failed" ||
      msg.toLowerCase().includes("load failed") ||
      msg.toLowerCase().includes("failed to fetch")
    if (isNetworkError) {
      return new Response(
        JSON.stringify({
          error: "network_error",
          error_description: "Network unavailable. Please check your connection.",
        }),
        {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "Content-Type": "application/json" },
        }
      )
    }
    throw err
  })
}

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    global: { fetch: safeFetch },
    auth: {
      flowType: "pkce",
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
)
