/**
 * Session-related constants
 * Extracted from app/session/[id]/page.tsx for centralization
 */

/**
 * Tolerance for floating-point P/L comparisons.
 * Used to determine if a value is effectively zero, positive, or negative.
 */
export const BALANCE_TOLERANCE = 0.01

/**
 * Delay in milliseconds before resetting copy feedback state.
 * Used after copying summary or link to clipboard.
 */
export const COPY_FEEDBACK_DELAY_MS = 2000

/**
 * Delay in milliseconds before closing dialogs after certain actions.
 * Used to allow state updates to complete before closing.
 */
export const CLOSE_DELAY_MS = 100
