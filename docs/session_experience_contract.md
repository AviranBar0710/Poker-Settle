# Session Experience Contract  
Poker Session App  
Version: 1.0

This document defines the **mandatory experience rules** for a poker session.
The app is not a collection of screens — it is a **guided, stage-based process**.

Any flow that violates this contract creates silent user failure and is unacceptable.

---

## 1. Canonical Session Stages

A session is always in **exactly one stage**.  
Stages are explicit, named, and determine what the user can and cannot do.

---

### Stage 1 — Player Setup

**Purpose:** Define who is participating.

**Allowed actions:**
- Add player
- Edit player name
- Remove player

**Disallowed actions:**
- Buy-ins
- Cash-outs

**Exit condition:**
- At least one player exists

**User understanding:**
> "I'm just defining who's playing. No money yet."

---

### Stage 2 — Buy-ins (Critical Stage)

**Purpose:** Define the financial basis of the session.

**Allowed actions:**
- Add buy-in(s) per player (amounts may differ)
- Edit or delete buy-ins
- Add additional players
- Remove players who never bought in

**Disallowed actions:**
- Cash-outs

**Completion condition (hard):**
- Every remaining player has at least one buy-in

**Critical rule:**
> A player with no buy-in **did not participate in the game**.

The system must:
- Clearly indicate players without buy-ins
- Encourage or require removing them before proceeding

**User understanding:**
> "Everyone here has put money in. If not — they shouldn't be here."

---

### Stage 3 — Chip Entry (Cash-outs)

**Entry action (explicit):**
- "Start chip entry"

**Hard gate:**
- This action is **blocked** until:
  - Every remaining player has ≥1 buy-in

The app must clearly explain why it is blocked.

**Effects of entering this stage:**
- Buy-ins are considered **logically locked**
- No new players may be added

**Important clarification:**
- Buy-ins remain editable at all times
- Editing buy-ins after this point is allowed and does NOT block progress

**Allowed actions:**
- Add cash-outs per player
- t buy-ins (correction allowed)

**Disallowed actions:**
- Adding players

**User understanding:**
> "The game is over. I'm recording final chip results.  
> I can still fix mistakes, but the table is closed."

---

### Stage 4 — Review & Settlement

**Purpose:** Validate correctness before finalization.

**Allowed actions:**
- Review balances and settlements
- Edit buy-ins
- Edit cash-outs

**Disallowed actions:**
- Adding players

**User understanding:**
> "This is a sanity check. I'm making sure everything adds up."

---

### Stage 5 — Finalized

**Purpose:** Freeze results.

**Allowed actions:**
- View results
- Share results

**Disallowed actions:**
- Any mutation of players or transactions

**User understanding:**
> "This session is done. Numbers are final."

---

## 2. Start Chip Entry — Safety Rule (Non-Negotiable)

> **The user must never be allowed to enter Chip Entry with incorrect or incomplete buy-ins.**

Enforcement requirements:
- The app must always show:
  - Which players have buy-ins
  - Which players do not
- "Start chip entry":
  - Is disabled until all players have buy-ins
  - Explains exactly what is missing

The user must never guess whether they are "ready".

---

## 3. Late Join Rule

- Players may be added:
  - During Player Setup
  - During Buy-ins
- Players may NOT be added:
  - After Chip Entry has started

**User understanding:**
> "Once we start chip entry, the table is closed."

---

## 4. Buy-in Edit Semantics (Clarified)

- Buy-ins are editable **at all times**
- Editing buy-ins after Chip Entry:
  - Is allowed
  - Does not block progress
  - Does not require restarting the stage

**Design intent:**
- Correcting mistakes is always possible
- The system trusts the user, but makes stages explicit

---

## 5. Mistake Recovery Rule

There is exactly **one mental model** for fixing money mistakes:

> "If the number is wrong, I go to transactions and fix it."

The user must never:
- Wonder if a buy-in can be edited
- Guess whether a mistake is ptions to find the fix

---

## 6. Irreversible Actions

### Irreversible actions:
1. Removing a player
2. Finalizing the session

Rules:
- Must be explicit
- Must be confirmed
- Must clearly explain consequences

Accidental irreversible actions are considered critical UX failures.

---

## 7. Stage Awareness Guarantee

At all times, the user must know:
- Which stage they are in
- What this stage means
- What they are expected to do next
- Why certain actions are unavailable

If an action is blocked, the reason must be visible **before** the user tries to do it.

---

## 8. Enforcement Clause

Any flow that allows the user to:
- Enter Chip Entry without complete buy-ins
- Discover rules by trial and error
- Guess whether a mistake is fixable

→ Violates this contract.

This contract defines the **physics of the session**.
UI, components, and flows must obey it.
