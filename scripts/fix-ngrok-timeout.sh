#!/usr/bin/env bash
# Fix "ERR_CONNECTION_TIMED_OUT" and "ERR_NGROK_334" (endpoint already online) when using ngrok.
# Run this script in your terminal (not from Cursor), then restart dev + ngrok.

set -e

# Stop existing ngrok tunnel via local API (frees URL, fixes ERR_NGROK_334)
if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 1 http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -q 200; then
  echo "Stopping existing ngrok tunnel..."
  curl -s -X DELETE "http://127.0.0.1:4040/api/tunnels/command_line" >/dev/null 2>&1 || true
  sleep 1
fi

echo "Clearing ports 3000 and 3001..."
for port in 3000 3001; do
  pids=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "  Killing process(es) on :$port: $pids"
    echo "$pids" | xargs kill -9 2>/dev/null || true
  fi
done
sleep 1
echo ""
echo "Done. Next steps:"
echo "  1. In one terminal:  npm run dev"
echo "  2. In another:       ngrok http 3000"
echo ""
echo "Then use the ngrok URL (e.g. https://....ngrok-free.app) on your mobile device."
