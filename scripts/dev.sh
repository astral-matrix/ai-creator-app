#!/bin/bash

# AI Creator App - Development Startup Script (mprocs Version)
# Uses mprocs for an interactive TUI with clickable process tabs
#
# Navigation:
#   Click on process name or use Up/Down arrows to switch
#   q - Quit all processes
#   x - Stop selected process
#   s - Start selected process
#   r - Restart selected process

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "Error: Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Check if mprocs is installed
if ! command -v mprocs &> /dev/null; then
    echo "Error: mprocs is not installed."
    echo "Install with: brew install mprocs"
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

# Run mprocs with both services
mprocs "npm run runner" "npm run dev"
