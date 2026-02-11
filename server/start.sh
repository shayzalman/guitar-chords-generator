#!/bin/bash
set -e

# Start bgutil PO token server in background
echo "Starting PO token server..."
node /opt/bgutil/server/build/main.js &
POT_PID=$!

# Wait briefly for the server to be ready
sleep 2

# Verify it's running
if ! kill -0 $POT_PID 2>/dev/null; then
    echo "WARNING: PO token server failed to start"
fi

# Start the FastAPI app
exec uvicorn app:app --host 0.0.0.0 --port 8080
