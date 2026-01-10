import { readFileSync } from 'fs';
import { join } from 'path';
import { Mode } from '../types';

// Cache the system prompt
let cachedSystemPrompt: string | null = null;

export function getBaseSystemPrompt(): string {
  if (!cachedSystemPrompt) {
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

export function assembleSystemMessages(mode: Mode): string[] {
  const messages: string[] = [];

  // System #1: Base system prompt
  messages.push(getBaseSystemPrompt());

  // System #2: Strict lock message
  messages.push(getStrictLockMessage(mode));

  // System #3: Build mode output guidance (only for BUILD mode)
  if (mode === 'BUILD') {
    messages.push(getBuildModeOutputGuidance());
  }

  return messages;
}
