// Transaction data model
export type Transaction = {
  id: string
  sessionId: string
  playerId: string
  type: "buyin" | "cashout"
  amount: number
  createdAt: string
}

