MOBILE UX CONTRACT — Poker Session App
=====================================

This document defines NON-NEGOTIABLE mobile interaction rules.
Any violation is considered a bug.

1. TOUCH TARGETS
- Minimum touch size: 44x44px
- Icon-only buttons must have invisible padding to reach 44px
- No stacked micro-actions in a single row

2. BOTTOM SHEETS & DIALOGS
- All dialogs are bottom sheets on mobile
- Must include:
  - Visible drag handle
  - Bottom-aligned primary CTA
  - Secondary action also reachable by thumb
- Close (X) button at TOP is forbidden on mobile

3. KEYBOARD SAFETY
- Any input that opens keyboard must:
  - Never be covered
  - Scroll into view automatically
  - Keep primary CTA visible or sticky
- Numeric inputs default to bottom-aligned layout

4. CTA HIERARCHY
- Exactly ONE primary action per screen
- Secondary actions must be visually weaker
- No competing CTAs in sticky footers

5. FEEDBACK & STATES
- Every action must have:
  - Idle
  - Loading
  - Success
  - Error
- Hover states a forbidden on mobile
- Active / pressed states are mandatory

6. PHASE GUIDANCE
- Current phase must always answer:
  "What should I do now?"
- Explanations must be visible on mobile
- No hidden desktop-only hints

7. EMPTY & EDGE STATES
- Empty state must guide the next action
- Add-first-action must be bottom reachable
- Never center CTAs vertically on mobile

If a requested change violates this contract:
STOP and ask for guidance.
