# AI Creator App

A production-grade web application that provides a Cursor-like AI chat pane with a live Preview pane that can run AI-generated code in server-side sandboxes.

## Features

- **Multi-Mode Chat Interface**: Switch between CHAT, DESIGN, and BUILD modes with strict tab locks
- **Multi-Provider LLM Support**: OpenAI, Anthropic, and xAI integration
- **Live Code Preview**: Run AI-generated code in isolated Docker containers
- **Diff & Command Blocks**: Apply file changes and execute commands directly from chat
- **Persistent State**: Chat history, preferences, and workspace state persist across sessions
- **Streaming Responses**: Real-time SSE streaming for AI responses

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **State Management**: Zustand + TanStack Query
- **Database**: PostgreSQL with Prisma ORM
- **LLM Providers**: OpenAI, Anthropic, xAI
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

# LLM API Keys (replace with your actual keys)
OPENAI_API_KEY="sk-your-openai-key"
ANTHROPIC_API_KEY="sk-ant-your-anthropic-key"
XAI_API_KEY="xai-your-xai-key"

# Runner Service
RUNNER_BASE_URL="http://localhost:4050"

# Sandbox Configuration
SANDBOX_IMAGE_TAG="ai-creator-sandbox:latest"
WORKSPACE_HOST_PATH="/tmp/ai-creator-workspaces"

# Optional: Rate limiting
RATE_LIMIT_REQUESTS_PER_MINUTE=60
```

> **Note**: You need at least one valid LLM API key. Get yours from:
> - OpenAI: https://platform.openai.com/api-keys
> - Anthropic: https://console.anthropic.com/
> - xAI: https://x.ai/api

### 3. Start PostgreSQL

```bash
docker-compose up -d postgres
```

Wait a few seconds for PostgreSQL to initialize.

### 4. Initialize Database

```bash
npm run db:push
```

### 5. Build Sandbox Image

```bash
npm run sandbox:build
```

### 6. Start the Application

You need two terminal windows:

**Terminal 1 - Runner Service:**
```bash
npm run runner
```

**Terminal 2 - Next.js App:**
```bash
npm run dev
```

### 7. Open the App

Navigate to **http://localhost:3000** in your browser.

## Modes

### CHAT Mode
- General conversation and Q&A
- Brainstorming and ideation
- No code execution capabilities
- Default model: GPT-5.2

### DESIGN Mode
- System design and architecture planning
- Technical specifications and tradeoff analysis
- No code execution
- Default model: GPT-5.2 Thinking

### BUILD Mode
- Active code generation
- File changes via unified diffs
- Command execution in sandboxed containers
- Live preview of running apps
- Default model: Claude Opus 4.5

## Available Models

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
Verify your API keys in `.env` are correct.

## License

MIT
