import { ParsedBlock } from '../types';

// Regex patterns for parsing
const CODE_BLOCK_REGEX = /```(\w+)?\n([\s\S]*?)```/g;
const DIFF_HEADER_REGEX = /^---\s+(?:a\/)?(.+)$/m;
const AUTO_RAN_REGEX = /^Auto-Ran command:\s*(.*)$/m;

export function parseMessageContent(content: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  let lastIndex = 0;

  // Reset regex
  CODE_BLOCK_REGEX.lastIndex = 0;

  let match;
  while ((match = CODE_BLOCK_REGEX.exec(content)) !== null) {
    // Add text before this code block
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index).trim();
      if (textBefore) {
        // Check if this text contains "Auto-Ran command:" header
        const autoRanMatch = textBefore.match(AUTO_RAN_REGEX);
        if (autoRanMatch) {
          // Split text and mark the command
          const beforeAutoRan = textBefore.slice(0, autoRanMatch.index).trim();
          if (beforeAutoRan) {
            blocks.push({ type: 'text', content: beforeAutoRan });
          }
        } else {
          blocks.push({ type: 'text', content: textBefore });
        }
      }
    }

    const language = match[1]?.toLowerCase() || '';
    const codeContent = match[2];

    // Check for Auto-Ran command header before this block
    const textBefore = content.slice(lastIndex, match.index);
    const isAutoRan = AUTO_RAN_REGEX.test(textBefore);

    if (language === 'diff') {
      // Parse diff block
      const diffInfo = parseDiff(codeContent);
      blocks.push({
        type: 'diff',
        content: codeContent,
        filename: diffInfo.filename,
        additions: diffInfo.additions,
        deletions: diffInfo.deletions,
      });
    } else if ((language === 'bash' || language === 'sh' || language === 'shell') && isAutoRan) {
      // Command block
      blocks.push({
        type: 'command',
        content: codeContent.trim(),
        language,
        isAutoRan: true,
      });
    } else {
      // Regular code block
      blocks.push({
        type: 'code',
        content: codeContent,
        language,
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex).trim();
    if (remaining) {
      // Remove any trailing Auto-Ran markers
      const cleanedRemaining = remaining.replace(AUTO_RAN_REGEX, '').trim();
      if (cleanedRemaining) {
        blocks.push({ type: 'text', content: cleanedRemaining });
      }
    }
  }

  return blocks;
}

function parseDiff(diffContent: string): {
  filename: string | undefined;
  additions: number;
  deletions: number;
} {
  let filename: string | undefined;
  let additions = 0;
  let deletions = 0;

  const lines = diffContent.split('\n');

  for (const line of lines) {
    // Try to extract filename from --- or +++ lines
    if (line.startsWith('--- ') || line.startsWith('+++ ')) {
      const match = line.match(/^(?:---|\+\+\+)\s+(?:[ab]\/)?(.+)$/);
      if (match && match[1] !== '/dev/null') {
        filename = match[1];
      }
    }

    // Count additions and deletions (excluding header lines)
    if (line.startsWith('+') && !line.startsWith('+++')) {
      additions++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      deletions++;
    }
  }

  return { filename, additions, deletions };
}

export function extractDiffPatch(content: string): string | null {
  // Extract the full diff content from a message
  const match = content.match(/```diff\n([\s\S]*?)```/);
  return match ? match[1] : null;
}

export function extractAllDiffPatches(content: string): string[] {
  // Extract all diff blocks from a message
  const diffs: string[] = [];
  const regex = /```diff\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    diffs.push(match[1]);
  }
  return diffs;
}

export function extractCommand(content: string): string | null {
  // Extract command from Auto-Ran command block
  const match = content.match(/Auto-Ran command:.*?\n```(?:bash|sh|shell)?\n([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

export function extractAllCommands(content: string): string[] {
  // Extract all Auto-Ran commands from a message
  const commands: string[] = [];
  const regex = /Auto-Ran command:.*?\n```(?:bash|sh|shell)?\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    commands.push(match[1].trim());
  }
  return commands;
}
