import { Session } from "@/types/session"
import { Player } from "@/types/player"
import { Transaction } from "@/types/transaction"

const STORAGE_KEY = "poker-sessions"
const PLAYERS_STORAGE_KEY = "poker-players"
const TRANSACTIONS_STORAGE_KEY = "poker-transactions"

/**
 * Get all sessions from localStorage
 * Returns empty array if no sessions exist or if localStorage is not available
 */
export function getSessions(): Session[] {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) {
      return []
    }
    return JSON.parse(data) as Session[]
  } catch (error) {
    console.error("Error reading sessions from localStorage:", error)
    return []
  }
}

/**
 * Get a single session by ID
 */
export function getSessionById(id: string): Session | null {
  const sessions = getSessions()
  return sessions.find((session) => session.id === id) || null
}

/**
 * Save a new session to localStorage
 * Adds the session to the existing array of sessions
 */
export function saveSession(session: Session): void {
  if (typeof window === "undefined") {
    return
  }

  try {
    const sessions = getSessions()
    sessions.push(session)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch (error) {
    console.error("Error saving session to localStorage:", error)
  }
}

/**
 * Update an existing session in localStorage
 * Replaces the session with the same ID
 */
export function updateSession(updatedSession: Session): void {
  if (typeof window === "undefined") {
    return
  }

  try {
    const sessions = getSessions()
    const index = sessions.findIndex((s) => s.id === updatedSession.id)
    if (index !== -1) {
      sessions[index] = updatedSession
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
    }
  } catch (error) {
    console.error("Error updating session in localStorage:", error)
  }
}

/**
 * Get all players from localStorage
 * Returns empty array if no players exist or if localStorage is not available
 */
export function getPlayers(): Player[] {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const data = localStorage.getItem(PLAYERS_STORAGE_KEY)
    if (!data) {
      return []
    }
    return JSON.parse(data) as Player[]
  } catch (error) {
    console.error("Error reading players from localStorage:", error)
    return []
  }
}

/**
 * Get players for a specific session
 */
export function getPlayersBySessionId(sessionId: string): Player[] {
  const players = getPlayers()
  return players.filter((player) => player.sessionId === sessionId)
}

/**
 * Save a new player to localStorage
 * Adds the player to the existing array of players
 */
export function savePlayer(player: Player): void {
  if (typeof window === "undefined") {
    return
  }

  try {
    const players = getPlayers()
    players.push(player)
    localStorage.setItem(PLAYERS_STORAGE_KEY, JSON.stringify(players))
  } catch (error) {
    console.error("Error saving player to localStorage:", error)
  }
}

/**
 * Get all transactions from localStorage
 * Returns empty array if no transactions exist or if localStorage is not available
 */
export function getTransactions(): Transaction[] {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const data = localStorage.getItem(TRANSACTIONS_STORAGE_KEY)
    if (!data) {
      return []
    }
    return JSON.parse(data) as Transaction[]
  } catch (error) {
    console.error("Error reading transactions from localStorage:", error)
    return []
  }
}

/**
 * Get buy-in transactions for a specific player in a session
 * Filters by sessionId, playerId, and type="buyin"
 */
export function getBuyinsByPlayer(
  sessionId: string,
  playerId: string
): Transaction[] {
  const transactions = getTransactions()
  return transactions.filter(
    (transaction) =>
      transaction.sessionId === sessionId &&
      transaction.playerId === playerId &&
      transaction.type === "buyin"
  )
}

/**
 * Get cash-out transactions for a specific player in a session
 * Filters by sessionId, playerId, and type="cashout"
 */
export function getCashoutsByPlayer(
  sessionId: string,
  playerId: string
): Transaction[] {
  const transactions = getTransactions()
  return transactions.filter(
    (transaction) =>
      transaction.sessionId === sessionId &&
      transaction.playerId === playerId &&
      transaction.type === "cashout"
  )
}

/**
 * Save a new transaction to localStorage
 * Adds the transaction to the existing array of transactions
 */
export function saveTransaction(transaction: Transaction): void {
  if (typeof window === "undefined") {
    return
  }

  try {
    const transactions = getTransactions()
    transactions.push(transaction)
    localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(transactions))
  } catch (error) {
    console.error("Error saving transaction to localStorage:", error)
  }
}

