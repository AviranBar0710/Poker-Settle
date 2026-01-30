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

