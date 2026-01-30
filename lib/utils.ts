import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
