# AI Creator App

A production-grade web application that provides a Cursor-like AI chat pane with a live Preview pane that can run AI-generated code in server-side sandboxes.

## Features

- **Multi-Mode Chat Interface**: Switch between CHAT, DESIGN, and BUILD modes with strict tab locks
- **Multi-Provider LLM Support**: Groq (free!), OpenAI, Anthropic, and xAI integration
- **Live Code Preview**: Run AI-generated code in isolated Docker containers
- **Diff & Command Blocks**: Apply file changes and execute commands directly from chat
- **Persistent State**: Chat history, preferences, and workspace state persist across sessions
- **Streaming Responses**: Real-time SSE streaming for AI responses

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **State Management**: Zustand + TanStack Query
- **Database**: PostgreSQL with Prisma ORM
- **LLM Providers**: Groq (free), OpenAI, Anthropic, xAI
- **Sandbox**: Docker containers via dockerode
- **Streaming**: Server-Sent Events (SSE)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 20+** - [Download](https://nodejs.org/)
- **Docker & Docker Compose** - [Download](https://www.docker.com/products/docker-desktop/)
- **Git** - [Download](https://git-scm.com/)

## Quick Start

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <your-repo-url>
cd ai-creator-app-GPT

# Install main app dependencies
npm install

# Install runner service dependencies
cd services/runner
npm install
cd ../..
```

### 2. Environment Setup

Create a `.env` file in the project root:

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_creator?schema=public"

# FREE LLM API - Groq (recommended to start)
GROQ_API_KEY="gsk_your_groq_key_here"

# Optional paid providers (uncomment if you have keys)
# OPENAI_API_KEY="sk-your-openai-key"
# ANTHROPIC_API_KEY="sk-ant-your-anthropic-key"
# XAI_API_KEY="xai-your-xai-key"

# Runner Service
RUNNER_BASE_URL="http://localhost:4050"

# Sandbox Configuration
SANDBOX_IMAGE_TAG="ai-creator-sandbox:latest"
WORKSPACE_HOST_PATH="/tmp/ai-creator-workspaces"
```

### 3. Get a FREE Groq API Key

Groq offers **free API access** with generous rate limits - no credit card required!

1. Go to **https://console.groq.com/keys**
2. Sign up for a free account (GitHub or Google login available)
3. Click **"Create API Key"**
4. Copy the key and add it to your `.env` file:
   ```
   GROQ_API_KEY="gsk_xxxxxxxxxxxxxxxxxxxx"
   ```

Groq provides access to powerful open-source models with extremely fast inference:
- **Llama 3.3 70B** - Best quality, great for complex tasks
- **Llama 3.1 8B** - Fastest, good for simple tasks
- **Mixtral 8x7B** - Good balance of speed and quality

### 4. Start PostgreSQL

```bash
docker-compose up -d postgres
```

Wait a few seconds for PostgreSQL to initialize.

### 5. Initialize Database

```bash
npm run db:push
```

### 6. Build Sandbox Image

```bash
npm run sandbox:build
```

### 7. Start the Application

You need two terminal windows:

**Terminal 1 - Runner Service:**
```bash
npm run runner
```

**Terminal 2 - Next.js App:**
```bash
npm run dev
```

### 8. Open the App

Navigate to **http://localhost:3000** in your browser.

## Modes

### CHAT Mode
- General conversation and Q&A
- Brainstorming and ideation
- No code execution capabilities
- Default model: Llama 3.3 70B (Groq)

### DESIGN Mode
- System design and architecture planning
- Technical specifications and tradeoff analysis
- No code execution
- Default model: Llama 3.3 70B (Groq)

### BUILD Mode
- Active code generation
- File changes via unified diffs
- Command execution in sandboxed containers
- Live preview of running apps
- Default model: Llama 3.3 70B (Groq)

## Available Models

### Free (Groq) ⭐

| Provider | Model ID        | Description                    |
|----------|-----------------|--------------------------------|
| Groq     | llama-3.3-70b   | Best quality, fast inference   |
| Groq     | llama-3.1-8b    | Fastest, good for simple tasks |
| Groq     | mixtral-8x7b    | Balanced speed and quality     |

### Paid (Optional)

| Provider   | Model ID           | Description          |
|------------|-------------------|----------------------|
| OpenAI     | gpt-5.2           | Latest GPT model     |
| OpenAI     | gpt-5.2-thinking  | Enhanced reasoning   |
| Anthropic  | opus-4.5-high     | Most capable Claude  |
| xAI        | grok-latest       | xAI Grok model       |

## NPM Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run runner` | Start sandbox runner service |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Run database migrations |
| `npm run db:studio` | Open Prisma Studio (database GUI) |
| `npm run docker:up` | Start Docker services |
| `npm run docker:down` | Stop Docker services |
| `npm run sandbox:build` | Build sandbox Docker image |

## Ports Used

| Port | Service |
|------|---------|
| 3000 | Next.js application |
| 4050 | Runner service |
| 5432 | PostgreSQL database |

## Project Structure

```
/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── bootstrap/     # User initialization
│   │   ├── chat/stream/   # SSE chat streaming
│   │   ├── conversations/ # Conversation CRUD
│   │   ├── models/        # Available models
│   │   ├── preview/       # Reverse proxy for previews
│   │   └── workspaces/    # Workspace management
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main page
├── components/            # React components
│   ├── chat/             # Chat UI components
│   ├── preview/          # Preview pane
│   └── ui/               # Base UI components
├── lib/
│   ├── ai/               # LLM provider adapters
│   ├── db/               # Database layer
│   ├── hooks/            # React hooks
│   ├── prompts/          # System prompts
│   ├── rendering/        # Block parsing
│   ├── store.ts          # Zustand store
│   └── types.ts          # TypeScript types
├── prisma/
│   └── schema.prisma     # Database schema
├── services/
│   └── runner/           # Sandbox runner service
├── .env                  # Environment variables (create this)
├── docker-compose.yml    # Docker services
└── package.json          # Dependencies
```

## Running Web Servers (Daemon Processes)

The app supports running **background/daemon processes** like web servers that persist in the container. This is essential for previewing web applications.

### How It Works

When you ask the AI to build a web app, it needs to start the server as a **daemon** (background process) so it keeps running and can be previewed. Regular commands are synchronous and wait for completion, which doesn't work for long-running servers.

### API Usage

**Start a daemon (e.g., web server):**
```typescript
// From the useWorkspace hook
const { startDaemon, stopDaemon, getDaemonLogs, daemons } = useWorkspace(workspaceId);

// Start a Node.js server as a background process
await startDaemon({
  daemonId: 'web-server',      // Unique identifier for this daemon
  command: 'node server.js',   // The command to run
  workingDir: '/workspace'     // Optional working directory
});
```

**Check daemon status:**
```typescript
// List all running daemons
console.log(daemons);
// Output: [{ id: 'web-server', command: 'node server.js', pid: 1234, status: 'running', startedAt: '...' }]
```

**Get daemon logs:**
```typescript
// Get the last 100 lines of logs
const logs = await getDaemonLogs('web-server', 100);
console.log(logs);
```

**Stop a daemon:**
```typescript
await stopDaemon('web-server');
```

### REST API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/workspaces/{id}/daemon/start` | POST | Start a daemon process |
| `/api/workspaces/{id}/daemon/{daemonId}/stop` | POST | Stop a daemon |
| `/api/workspaces/{id}/daemon/{daemonId}/logs` | GET | Get daemon logs |
| `/api/workspaces/{id}/daemon/{daemonId}` | GET | Get daemon status |
| `/api/workspaces/{id}/daemons` | GET | List all daemons |

### Example: Starting an Express Server

```javascript
// In the container, this runs as a daemon:
// Command: "node server.js"

// server.js
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello from the sandbox!');
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

The server runs on port 3000 inside the container, which is mapped to a dynamic host port (10000+). The preview pane automatically proxies requests to this port.

### Important Notes

1. **Daemons persist** until explicitly stopped or the container is stopped
2. **Logs are stored** in `/tmp/daemon-{daemonId}.log` inside the container
3. **Port 3000** is the expected port for web servers (mapped to host automatically)
4. **Use unique daemon IDs** - starting a daemon with an existing ID will fail if it's running
5. **Daemon status is monitored** - the system detects when daemons exit

## Security

- Containers run as non-root user with dropped capabilities
- Resource limits: 512MB RAM, 50% CPU, 100 PIDs max
- Path traversal protection in all file operations
- No privileged containers
- Workspace isolation via Docker networking

## Troubleshooting

### "Environment variable not found: DATABASE_URL"
Create a `.env` file in the project root with the `DATABASE_URL` variable.

### "Cannot connect to PostgreSQL"
1. Ensure Docker is running
2. Run `docker-compose up -d postgres`
3. Wait a few seconds and try again

### "Sandbox image not found"
Run `npm run sandbox:build` to build the sandbox Docker image.

### "Runner service not responding"
Make sure the runner service is running with `npm run runner`.

### "API key errors"
Verify your API keys in `.env` are correct. For Groq, the key should start with `gsk_`.

### "Groq rate limit exceeded"
Groq's free tier has rate limits. Wait a moment and try again, or consider upgrading to a paid plan.

## License

MIT
