PROJECT AGENT SKILLS — Poker Session App
=======================================

This project aims to deliver a PREMIUM mobile-first experience.
UX quality is more important than feature velocity.

CORE PRINCIPLES (NON-NEGOTIABLE)
--------------------------------

1. MOBILE_FIRST_ABSOLUTE
- Assume screen width: 360–390px
- Touch-only input (no hover assumptions)
- One-handed usage is the default
- Desktop is secondary and may be degraded initially

2. ZERO_BUG_TOLERANCE_MOBILE
Any of the following is considered a blocker:
- Text overflow or clipping
- Horizontal scrolling
- Layout jumps
- Inputs covered by the keyboard
- Missed taps or small hit areas
- Focus loss during interaction

3. UX_CONFIDENCE_OVER_DENSITY
- Fewer actions per screen
- Clear primary action at all times
- User must always feel "I know what happens next"

4. THUMB_REACH_PRIORITY
- Primary actions must be reachable by thumb
- Destructive or critical actions must not be at the top edge
- Bottom areas are preferred for CTAs
GN_SYSTEM_ENFORCER
- Use shadcn/ui components only
- Tailwind spacing scale only
- No ad-hoc CSS
- All components must define:
  - default
  - loading
  - disabled
  - error
  states

6. NO_DESKTOP_OPTIMIZATION_UNLESS_REQUESTED
- Do not optimize layouts for desktop unless explicitly asked
- Desktop parity comes after mobile WOW is achieved

7. FLOW_BEFORE_UI
- User flow must be defined and approved before UI work
- Empty states, error states, and success states are mandatory

VIOLATIONS
----------
If any of the above principles are violated:
- STOP
- Explain the conflict
- Ask for guidance before proceeding
