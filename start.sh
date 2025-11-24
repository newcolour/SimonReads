#!/bin/bash

# Start Vite dev server in background
npm run dev &
VITE_PID=$!

# Wait a few seconds for Vite to start
sleep 3

# Compile TypeScript
npx tsc -p electron/tsconfig.json

# Start Electron
VITE_DEV_SERVER_URL=http://localhost:5173 npx electron .

# Cleanup on exit
kill $VITE_PID
