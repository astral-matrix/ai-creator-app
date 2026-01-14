#!/bin/bash

# AI Creator App - Development Startup Script (Concurrent Version)
# Uses concurrently to run both services with labeled output in one terminal
#
# Output shows prefixed logs like:
#   [runner] Listening on port 4050...
#   [nextjs] ▲ Next.js 14.x.x
#   [nextjs] - Local: http://localhost:3000
#
# Press Ctrl+C to stop all processes

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "Error: Docker is not running. Please start Docker Desktop."
    exit 1
fi

echo "🚀 Starting AI Creator development environment..."
echo ""

# Start PostgreSQL if not already running
echo "📦 Ensuring PostgreSQL is running..."
docker-compose up -d postgres
sleep 2

# Check if sandbox image exists, build if not
if ! docker image inspect ai-creator-sandbox:latest &> /dev/null; then
    echo "🔨 Building sandbox image (first time only)..."
    npm run sandbox:build
fi

echo ""
echo "Press Ctrl+C to stop all processes"
echo ""

# Trap Ctrl+C and kill all child processes
cleanup() {
    echo ""
    echo "Stopping all processes..."
    kill 0
    exit 0
}
trap cleanup SIGINT SIGTERM

npx concurrently \
  --names "runner,nextjs" \
  --prefix-colors "cyan,magenta" \
  --kill-others \
  --kill-others-on-fail \
  --handle-input \
  "cd services/runner && npm run dev" \
  "next dev"

# Wait for all background processes
wait
