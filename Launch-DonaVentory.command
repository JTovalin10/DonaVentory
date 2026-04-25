#!/bin/bash
cd "$(dirname "$0")"
echo "Starting DonaVentory Production Intake..."
# Start server in background
npm run dev &
# Save the PID of the server to kill it later if needed
SERVER_PID=$!
echo "Waiting for the server to initialize (5s)..."
sleep 5
# Open the browser
open http://localhost:5173
echo ""
echo "Application launched!"
echo "To stop the server, close this terminal window or press Ctrl+C."
echo ""
# Keep terminal open
wait $SERVER_PID
