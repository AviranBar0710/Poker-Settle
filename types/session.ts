// Session data model
export type Session = {
  id: string
  name: string
  currency: "USD" | "ILS" | "EUR"
  createdAt: string
  finalizedAt?: string
  clubId?: string // Added for multi-tenant (optional for backward compatibility)
  chip_entry_started_at?: string // Added for stage engine (Stage 2 → 3 transition)
  inviteToken?: string // Plain token (only available when generating, not stored)
  inviteEnabled?: boolean // Whether invite link is enabled
  inviteTokenCreatedAt?: string // When token was first created
  inviteTokenRegeneratedAt?: string // When token was last regenerated
}

