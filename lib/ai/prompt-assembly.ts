import { readFileSync } from 'fs';
import { join } from 'path';
import { Mode } from '../types';

// Cache the system prompt (disabled in development for hot reload)
let cachedSystemPrompt: string | null = null;
const isDev = process.env.NODE_ENV !== 'production';

export function getBaseSystemPrompt(): string {
  if (!cachedSystemPrompt || isDev) {
    try {
      const promptPath = join(process.cwd(), 'lib/prompts/mode_switching_system_prompt.txt');
      cachedSystemPrompt = readFileSync(promptPath, 'utf-8');
    } catch (error) {
      console.error('Failed to load system prompt:', error);
      // Fallback system prompt
      cachedSystemPrompt = `You are a versatile AI assistant that operates in three distinct modes: CHAT, DESIGN, and BUILD.
Your behavior adapts based on the currently active mode.

CHAT MODE: General conversation, Q&A, brainstorming.
DESIGN MODE: System design, architecture planning, technical specification.
BUILD MODE: Active code generation, file manipulation, command execution.

In BUILD MODE:
- Use unified diff format for file changes
- Label commands with "Auto-Ran command:" prefix
- NEVER claim execution occurred unless confirmed by the system`;
    }
  }
  return cachedSystemPrompt;
}

export function getStrictLockMessage(mode: Mode): string {
  return `Active mode is ${mode}. Tabs are strict locks. Do not switch modes implicitly. Only switch if user explicitly asks.`;
}

export function getBuildModeOutputGuidance(): string {
  return `OUTPUT FORMAT REQUIREMENTS FOR BUILD MODE:

When proposing file changes, output unified diffs in \`\`\`diff fences:
\`\`\`diff
--- a/path/to/file.ts
+++ b/path/to/file.ts
@@ -line,count +line,count @@
 context line
-removed line
+added line
\`\`\`

When proposing commands to execute, output in \`\`\`bash fences and prefix with "Auto-Ran command:":
Auto-Ran command: install dependencies
\`\`\`bash
npm install
\`\`\`

CRITICAL: Never claim execution occurred. The user must click Run/Apply in the UI. Wait for system confirmation before acknowledging execution.`;
}

export function getSandboxEnvironmentGuidance(): string {
  return `SANDBOX ENVIRONMENT CONSTRAINTS:

Your code runs in an isolated Docker container with the following constraints:

PORT REQUIREMENTS:
- Web servers MUST listen on port 3000 (this is the ONLY exposed port)
- Do NOT use ports 8080, 8000, 5000, or any other port
- The preview pane can ONLY display apps running on port 3000
- Example: app.listen(3000) or server.listen(3000)

AVAILABLE TOOLS:
- Node.js 20 with npm and pnpm
- Python 3 with pip
- Git, curl, bash

RESOURCE LIMITS:
- 512MB RAM
- 50% CPU
- Working directory: /workspace

DAEMON PROCESSES:
- Long-running servers (like web apps) should be started as daemon processes
- Regular commands wait for completion and will timeout for servers
- The system will handle daemon management automatically

FILE OPERATIONS:
- All files are created in /workspace
- Use relative paths from /workspace

IMPORTANT: When creating web applications:
1. ALWAYS configure the server to listen on port 3000. This is non-negotiable.
2. ALWAYS include a root route (GET /) that serves an HTML page with the app's UI
3. Don't just create API endpoints - create a usable web interface at the root URL`;
}

export function assembleSystemMessages(mode: Mode): string[] {
  const messages: string[] = [];

  // System #1: Base system prompt
  messages.push(getBaseSystemPrompt());

  // System #2: Strict lock message
  messages.push(getStrictLockMessage(mode));

  // System #3: Build mode output guidance (only for BUILD mode)
  if (mode === 'BUILD') {
    messages.push(getBuildModeOutputGuidance());
    // System #4: Sandbox environment constraints
    messages.push(getSandboxEnvironmentGuidance());
  }

  return messages;
}
