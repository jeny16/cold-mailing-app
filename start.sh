#!/bin/bash
cd "$(dirname "$0")"

echo "=================================================="
echo "  🚀 Starting Job Application Mailer"
echo "  Backend:  http://127.0.0.1:5080"
echo "  Frontend: http://127.0.0.1:5180"
echo "=================================================="

# Free dedicated ports if occupied
lsof -ti :5080 | xargs kill -9 2>/dev/null || true
lsof -ti :5180 | xargs kill -9 2>/dev/null || true

# Auto-open browser
(sleep 2 && (open http://localhost:5180 2>/dev/null || xdg-open http://localhost:5180 2>/dev/null || true)) &

npm run dev
