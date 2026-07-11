# Poker Settle

A web application for managing and settling poker cash-game sessions within clubs. Players can create clubs, invite members, track buy-ins and cashouts during live sessions, and automatically calculate settlements when the game ends.

## Purpose

Poker Settle removes the manual bookkeeping from home poker games. It handles the full lifecycle of a cash-game session: creating a game, adding players, recording buy-ins and cashouts, and computing who owes whom at the end. Clubs provide multi-tenant organization so different poker groups each have their own players, sessions, and statistics.

## Key Features

- **Club Management** — Create or join clubs with invite codes; role-based membership (owner, admin, member)
- **Session Lifecycle** — Stage-based flow from setup through active play to finalization
- **Buy-in & Cashout Tracking** — Record multiple buy-ins and cashouts per player during a session
- **Automatic Settlement** — Calculate net results and generate optimized transfer instructions
- **Player Statistics** — Per-player historical stats across sessions
- **Invite Links** — Share tokenized links so players can join a session directly
- **Hands Chance Calculator** — Built-in poker odds calculator for evaluating hand probabilities
- **Mobile-First Design** — Responsive UI optimized for use at the table on a phone

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js](https://nextjs.org) (App Router) |
| Language | [TypeScript](https://www.typescriptlang.org) |
| UI | [React](https://react.dev) 19, [Tailwind CSS](https://tailwindcss.com), [Radix UI](https://www.radix-ui.com) primitives |
| Backend & Auth | [Supabase](https://supabase.com) (PostgreSQL, Auth, Row-Level Security) |
| Hosting | [Vercel](https://vercel.com) |
| Analytics | [Vercel Analytics](https://vercel.com/analytics) |
| Testing | [Playwright](https://playwright.dev) (end-to-end) |
| Poker Odds | [poker-odds-calc](https://www.npmjs.com/package/poker-odds-calc) |

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set the required environment variables (see [Deploy to Vercel](#deploy-to-vercel) for the full list):
```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Mobile Testing with ngrok

1. Start the dev server: `npm run dev`
2. In another terminal: `npm run ngrok` (or `ngrok http 3000`)
3. Open the ngrok URL on your phone.

If the dev server started on port 3001, use `npm run ngrok:3001` instead.

## Deploy to Vercel

1. Import the repository at [vercel.com](https://vercel.com).
2. Add environment variables: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Deploy. Then in **Supabase Dashboard > Authentication > URL Configuration**:
   - Set **Site URL** to your Vercel URL.
   - Add `https://<your-project>.vercel.app/auth/callback` to **Redirect URLs**.
4. For Google sign-in setup, see [docs/GOOGLE_AUTH_SETUP.md](docs/GOOGLE_AUTH_SETUP.md).

## Project Structure

```
app/             → Next.js App Router pages and layouts
components/      → Shared UI and feature components
contexts/        → React context providers (Auth, Club, UI state)
features/        → Feature modules (e.g. hands-chance calculator)
hooks/           → Custom React hooks
lib/             → Utilities, Supabase client, calculations
types/           → TypeScript type definitions
supabase/        → Database migrations and Supabase config
tests/           → Playwright end-to-end tests
```
