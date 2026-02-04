/**
 * Currency utilities for consistent display across the app.
 * Use symbols (₪ $ €) instead of codes to reduce width and prevent overlap on mobile.
 */
export type CurrencyCode = "USD" | "ILS" | "EUR"

export function getCurrencySymbol(currency: CurrencyCode): string {
  return currency === "ILS" ? "₪" : currency === "EUR" ? "€" : "$"
}
