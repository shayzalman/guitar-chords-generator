#!/bin/sh

# Start bgutil PO token server in background
echo "Starting PO token server..."
node /opt/bgutil/server/build/main.js &
POT_PID=$!

# Wait for server to be ready (poll /ping endpoint)
for i in 1 2 3 4 5 6 7 8 9 10; do
    if curl -s http://127.0.0.1:4416/ping > /dev/null 2>&1; then
        echo "PO token server is ready (pid=$POT_PID)"
        break
    fi
    echo "Waiting for PO token server... ($i)"
    sleep 1
done

if ! curl -s http://127.0.0.1:4416/ping > /dev/null 2>&1; then
    echo "WARNING: PO token server not reachable after 10s"
fi

# Start the FastAPI app (use PORT env var from Cloud Run, default 8080)
exec uvicorn app:app --host 0.0.0.0 --port "${PORT:-8080}"
