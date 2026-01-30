// Session data model
export type Session = {
  id: string
  name: string
  currency: "USD" | "ILS" | "EUR"
  createdAt: string
  finalizedAt?: string
  clubId?: string // Added for multi-tenant (optional for backward compatibility)
}

