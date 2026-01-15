import { readFileSync } from 'fs';
import { join } from 'path';
import { Mode } from '../types';

// Cache prompts (disabled in development for hot reload)
let cachedSystemPrompt: string | null = null;
let cachedDesignGuidance: string | null = null;
let cachedTasksGuidance: string | null = null;
const isDev = process.env.NODE_ENV !== 'production';

export function getBaseSystemPrompt(): string {
  if (!cachedSystemPrompt || isDev) {
    try {
      const promptPath = join(process.cwd(), 'lib/prompts/mode_switching_system_prompt.txt');
      cachedSystemPrompt = readFileSync(promptPath, 'utf-8');
    } catch (error) {
      console.error('Failed to load system prompt:', error);
      // Fallback system prompt
      cachedSystemPrompt = `You are a versatile AI assistant that operates in two UI tabs with three modes: CHAT, DESIGN, and BUILD.
Your behavior adapts based on the currently active mode.

CHAT MODE (CHAT tab): General conversation, Q&A, brainstorming.
DESIGN MODE (BUILD tab): System design, architecture planning, technical specification. Save designs to /design/*.md
BUILD MODE (BUILD tab): Active code generation, file manipulation, command execution. Track tasks in /tasks/*.md

In BUILD MODE:
- Use unified diff format for file changes
- Label commands with "Auto-Ran command:" prefix
- NEVER claim execution occurred unless confirmed by the system
- Check /design/ for relevant design docs before implementing`;
    }
  }
  return cachedSystemPrompt;
}

export function getDesignModeGuidance(): string {
  if (!cachedDesignGuidance || isDev) {
    try {
      const promptPath = join(process.cwd(), 'lib/prompts/design_mode_guidance.txt');
      cachedDesignGuidance = readFileSync(promptPath, 'utf-8');
    } catch (error) {
      console.error('Failed to load design mode guidance:', error);
      cachedDesignGuidance = `DESIGN MODE: Save all design outputs to /design/{feature-name}.md using diff format.
When design is complete, ask "Ready to build?" and wait for user confirmation.`;
    }
  }
  return cachedDesignGuidance;
}

export function getBuildModeTasksGuidance(): string {
  if (!cachedTasksGuidance || isDev) {
    try {
      const promptPath = join(process.cwd(), 'lib/prompts/build_mode_tasks_guidance.txt');
      cachedTasksGuidance = readFileSync(promptPath, 'utf-8');
    } catch (error) {
      console.error('Failed to load build mode tasks guidance:', error);
      cachedTasksGuidance = `BUILD MODE: Track implementation in /tasks/{feature-name}-tasks.md.
Check /design/ for relevant design docs. Mark tasks complete as you finish them.`;
    }
  }
  return cachedTasksGuidance;
}

export function getStrictLockMessage(mode: Mode, isDesignMode?: boolean): string {
  if (mode === 'BUILD' && isDesignMode) {
    return `Active mode is DESIGN (within BUILD tab). You are in planning/architecture mode. Do not generate code diffs for application files. Save design outputs to /design/*.md files only.`;
  }
  if (mode === 'BUILD') {
    return `Active mode is BUILD. You may generate code, diffs, and execute commands. Check /design/ for relevant design docs. Track progress in /tasks/*.md.`;
  }
  return `Active mode is ${mode}. Do not switch modes without user confirmation.`;
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

CRITICAL: Never claim execution occurred. The user must click Run/Apply in the UI. Wait for system confirmation before acknowledging execution.

TASK TRACKING:
- Create/update task list in /tasks/{feature}-tasks.md
- Mark tasks complete as you finish them
- Reference design docs from /design/ when available`;
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

PROJECT DOCUMENTATION:
- Design docs: /workspace/design/*.md
- Task lists: /workspace/tasks/*.md

IMPORTANT: When creating web applications:
1. ALWAYS configure the server to listen on port 3000. This is non-negotiable.
2. ALWAYS include a root route (GET /) that serves an HTML page with the app's UI
3. Don't just create API endpoints - create a usable web interface at the root URL`;
}

export function assembleSystemMessages(mode: Mode, isDesignMode?: boolean): string[] {
  const messages: string[] = [];

  // System #1: Base system prompt
  messages.push(getBaseSystemPrompt());

  // System #2: Mode-specific lock message
  messages.push(getStrictLockMessage(mode, isDesignMode));

  // System #3: Mode-specific guidance
  if (mode === 'DESIGN' || (mode === 'BUILD' && isDesignMode)) {
    // Design mode guidance
    messages.push(getDesignModeGuidance());
  } else if (mode === 'BUILD') {
    // Build mode guidance
    messages.push(getBuildModeOutputGuidance());
    messages.push(getBuildModeTasksGuidance());
    // Sandbox environment constraints
    messages.push(getSandboxEnvironmentGuidance());
  }

  return messages;
}
