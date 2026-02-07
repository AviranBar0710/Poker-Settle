import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** App-wide date display format: DD-MM-YYYY */
export function formatDateDDMMYYYY(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()
  return `${day}-${month}-${year}`
}

/**
 * Generate a unique session ID
 * Uses a combination of timestamp and random string
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36)
  const randomStr = Math.random().toString(36).substring(2, 9)
  return `${timestamp}-${randomStr}`
}

/**
 * Generate a unique player ID
 * Uses a combination of timestamp and random string
 */
export function generatePlayerId(): string {
  const timestamp = Date.now().toString(36)
  const randomStr = Math.random().toString(36).substring(2, 9)
  return `${timestamp}-${randomStr}`
}

/**
 * Generate a unique transaction ID
 * Uses a combination of timestamp and random string
 */
export function generateTransactionId(): string {
  const timestamp = Date.now().toString(36)
  const randomStr = Math.random().toString(36).substring(2, 9)
  return `${timestamp}-${randomStr}`
}
