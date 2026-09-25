#!/bin/bash
# Move to the directory where this script resides
cd "$(dirname "$0")"

echo "=================================================="
echo "  🚀 Starting Job Application Mailer"
echo "  Backend:  http://127.0.0.1:5080"
echo "  Frontend: http://127.0.0.1:5180"
echo "=================================================="

# Check if MongoDB is running, start via brew if needed
if ! pgrep -x "mongod" > /dev/null; then
  echo "[Info] Starting MongoDB daemon..."
  brew services start mongodb-community 2>/dev/null || true
fi

# Free ports 5080 and 5180 if anything was lingering
lsof -ti :5080 | xargs kill -9 2>/dev/null || true
lsof -ti :5180 | xargs kill -9 2>/dev/null || true

# Open browser automatically after 2 seconds
(sleep 2 && open http://localhost:5180 2>/dev/null || true) &

# Run Frontend and Backend simultaneously
npm run dev
