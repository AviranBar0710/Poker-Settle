# Poker Settlement App

A minimal Next.js application for poker cash-game settlement.

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

### ngrok (mobile testing)

1. Start the dev server: `npm run dev`
2. In another terminal: `npm run ngrok` (or `ngrok http 3000`)
3. Open the ngrok URL (e.g. `https://….ngrok-free.app`) on your phone.

**"This site can't be reached" / ERR_CONNECTION_TIMED_OUT**

- ngrok forwards to `localhost:3000`. If nothing responds there, you get a timeout.
- **Fix:** Run `./scripts/fix-ngrok-timeout.sh` in your terminal (outside Cursor), then run `npm run dev` and `ngrok http 3000` again.
- **Quick workaround:** If the dev server is on 3001 (e.g. "Port 3000 is in use… using 3001"), run `npm run ngrok:3001` instead so ngrok forwards to the active app.

## Features

- Create a poker session with a name and currency
- View session details by ID
- All data stored in browser localStorage

## Release and deploy

### Push to Git

1. Create a new repository on GitHub (or GitLab/Bitbucket). Do not initialize with a README.
2. Add the remote and push:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin master
   ```
   (Use your repo URL and branch name if different.)

### Deploy to Vercel

1. Sign in at [vercel.com](https://vercel.com) and **Add New Project** → import your repo.
2. In **Settings → Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy. Then in **Supabase Dashboard → Authentication → URL Configuration**:
   - Set **Site URL** to your Vercel URL (e.g. `https://your-project.vercel.app`).
   - Add `https://your-project.vercel.app/auth/callback` to **Redirect URLs**.
4. If you use Google sign-in, add the production origin and callback in Google Cloud Console (see [docs/GOOGLE_AUTH_SETUP.md](docs/GOOGLE_AUTH_SETUP.md)).

