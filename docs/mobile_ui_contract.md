MOBILE UI CONTRACT — Poker Session App
=====================================

This document defines NON-NEGOTIABLE UI rules.
Any implementation MUST comply strictly.

The goal:
Deliver a premium, confident, mobile-first experience.
UX quality is more important than speed or feature density.

Target device:
- Mobile only
- Screen width: 360–390px
- Touch-only
- One-handed usage assumed at all times

────────────────────────────────────────
GENERAL UI PRINCIPLES
────────────────────────────────────────

1. MOBILE-ONLY MINDSET
- Design ONLY for mobile.
- No hover states.
- No desktop-first assumptions.
- Desktop may appear acceptable but is never optimized unless explicitly requested.

2. ONE PRIMARY ACTION PER SCREEN
- Every screen or sheet has exactly ONE primary CTA.
- Secondary actions must be visually weaker and clearly secondary.
- No competing CTAs on the same hierarchy level.

3. BOTTOM-FIRST HIERARCHY
- Primary actions are always bottom-aligned.
- Critical actions must never be placed at the top edge.
- Top areas are informational only.

4. ZERO VISUAL NOISE
- No decorative UI.
- No unnecessary borders or dividers.
- No dense layouts.
- White space and clarity are preferred over information density.

────────────────────────────────────────
TOUCH & INTERACTION RULES
────────────────────────────────────────

5. TOUCH TARGET SIZE (CRITICAL)
- Minimum touch target height: 48px.
- Buttons, rows, list items, and interactive areas must be 48px+.
- Icon-only actions are forbidden unless wrapped in a 48px container.

6. TAP FEEDBACK (MANDATORY)
- Every tap must produce immediate feedback:
  - Visual pressed/active state
  - Optional haptic feedback (if available)
- No silent or ambiguous interactions.

7. NO MISSED TAPS
- Avoid multiple small actions in one row.
- Avoid clustered icons.
- Prefer one clear action per row or section.

────────────────────────────────────────
BOTTOM SHEETS & DIALOGS
────────────────────────────────────────

8. BOTTOM SHEETS ONLY
- All dialogs are bottom sheets.
- No center modals.
- No popovers.
- No alerts that block swipe dismissal unless explicitly destructive.

9. DRAG HANDLE
- Every bottom sheet MUST display a visible drag handle.
- Swipe-down-to-dismiss must always work.

10. EXIT SAFETY
- User must always be able to exit without committing an action.
- Swipe-down is always available.
- Destructive actions require explicit confirmation.

────────────────────────────────────────
KEYBOARD & INPUT SAFETY
────────────────────────────────────────

11. KEYBOARD AWARENESS (ZERO TOLERANCE)
- Inputs must NEVER be covered by the keyboard.
- Focused inputs must be visible at all times.
- Primary CTA must be sticky ABOVE the keyboard.

12. INPUT BEHAVIOR
- Text inputs auto-focus on open.
- Numeric inputs use numeric keyboard only.
- Invalid input disables CTA immediately (no submit + error later).

13. NO LAYOUT JUMPS
- Keyboard appearance must not cause layout jumps.
- Content above the input remains visually stable.

────────────────────────────────────────
BUTTONS & STATES
────────────────────────────────────────

14. BUTTON STATES (MANDATORY)
Every button must define ALL of the following states:
- Default
- Pressed / Active
- Loading
- Disabled
- Error

Buttons without full state coverage are invalid.

15. LOADING FEEDBACK
- Loading must be explicit and visible.
- Spinner or loading label is required.
- "..." alone is NOT sufficient feedback.
- The UI must never feel frozen or unresponsive.

────────────────────────────────────────
TYPOGRAPHY & TEXT
────────────────────────────────────────

16. TEXT SIZES
- Interactive text must be at least text-sm.
- text-xs is allowed ONLY for non-interactive metadata.
- Primary actions use confident, readable sizes.

17. CTA LABELS
- Short, decisive verbs.
- No long sentences.
- No wrapping or truncation allowed.
- If text does not fit, it must be shortened.

────────────────────────────────────────
COLORS & VISUAL LANGUAGE
────────────────────────────────────────

18. SEMANTIC COLORS ONLY
Allowed roles:
- Primary
- Destructive
- Muted
- Success
- Error

No ad-hoc or decorative colors.

19. DESTRUCTIVE CLARITY
- Destructive actions must be visually distinct.
- Never placed near primary CTAs.
- Always require confirmation.

────────────────────────────────────────
ANIMATION & MOTION
────────────────────────────────────────

20. MOTION PHILOSOPHY
- Subtle, fast, confidence-building.
- No playful, bouncy, or decorative motion.
- Bottom sheets slide from bottom only.

21. CONSISTENCY
- Same animation style across the app.
- Same durations across the app.
- No one-off animations.

────────────────────────────────────────
ABSOLUTE VIOLATIONS
────────────────────────────────────────

If ANY of the following occur, STOP immediately:
- Text overflow or clipping
- Horizontal scrolling
- Inputs covered by keyboard
- Touch targets smaller than 48px
- Multiple primary CTAs
- Hover-only feedback
- Desktop-first optimization

In case of conflict:
- STOP
- Explain the conflict clearly
- Ask for explicit guidance before proceeding
