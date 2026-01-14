#!/bin/bash

# AI Creator App - Development Startup Script
# Uses tmux to run both services with switchable panes
#
# Keybindings:
#   Ctrl+b then 0   - Switch to Runner pane
#   Ctrl+b then 1   - Switch to Next.js pane
#   Ctrl+b then n   - Next pane
#   Ctrl+b then p   - Previous pane
#   Ctrl+b then d   - Detach (services keep running)
#   tmux attach     - Reattach to session
#   Ctrl+c          - Stop current process
#   Ctrl+b then :kill-session  - Kill entire session

SESSION_NAME="ai-creator-dev"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo "Error: tmux is not installed."
    echo "Install with: brew install tmux"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "Error: Docker is not running. Please start Docker Desktop."
    exit 1
fi

cd "$PROJECT_ROOT"

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

# Kill existing tmux session if it exists
tmux kill-session -t "$SESSION_NAME" 2>/dev/null

# Create new tmux session with first window for runner
tmux new-session -d -s "$SESSION_NAME" -n "runner" -c "$PROJECT_ROOT"

# Start runner service in first pane
tmux send-keys -t "$SESSION_NAME:runner" "cd $PROJECT_ROOT && npm run runner" C-m

# Create second window for Next.js
tmux new-window -t "$SESSION_NAME" -n "nextjs" -c "$PROJECT_ROOT"

# Start Next.js dev server in second window
tmux send-keys -t "$SESSION_NAME:nextjs" "cd $PROJECT_ROOT && npm run dev" C-m

# Select the Next.js window (usually the one you want to see first)
tmux select-window -t "$SESSION_NAME:nextjs"

echo "Keybindings:"
echo "  Ctrl+b then 0   - Switch to Runner"
echo "  Ctrl+b then 1   - Switch to Next.js"
echo "  Ctrl+b then n/p - Next/Previous window"
echo "  Ctrl+b then d   - Detach (keeps running)"
echo "  Ctrl+b then q   - Quit and kill all processes"
echo ""

# Attach to the session
tmux attach-session -t "$SESSION_NAME"

# When tmux exits (detach or kill), offer to clean up
if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "Session ended."
else
    echo ""
    echo "Detached from session. Processes still running."
    echo "To kill all: tmux kill-session -t $SESSION_NAME"
fi
