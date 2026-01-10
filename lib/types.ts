// Enums matching Prisma schema
export type Mode = 'CHAT' | 'DESIGN' | 'BUILD';
export type Provider = 'openai' | 'anthropic' | 'xai' | 'groq';
export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'streaming' | 'complete' | 'failed';
export type WorkspaceStatus = 'stopped' | 'running' | 'error';
export type ProcessStatus = 'running' | 'exited' | 'failed';

// Model definitions
export interface ModelInfo {
  id: string;
  name: string;
  provider: Provider;
  description?: string;
}

export const MODELS: Record<Provider, ModelInfo[]> = {
  openai: [
    { id: 'gpt-5.2', name: 'GPT-5.2', provider: 'openai', description: 'Latest GPT model' },
    { id: 'gpt-5.2-thinking', name: 'GPT-5.2 Thinking', provider: 'openai', description: 'Enhanced reasoning' },
  ],
  anthropic: [
    { id: 'opus-4.5-high', name: 'Claude Opus 4.5', provider: 'anthropic', description: 'Most capable Claude' },
  ],
  xai: [
    { id: 'grok-latest', name: 'Grok Latest', provider: 'xai', description: 'xAI Grok model' },
  ],
  groq: [
    { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', provider: 'groq', description: 'Fast & free via Groq' },
    { id: 'llama-3.1-8b', name: 'Llama 3.1 8B', provider: 'groq', description: 'Fast & free via Groq' },
    { id: 'mixtral-8x7b', name: 'Mixtral 8x7B', provider: 'groq', description: 'Fast & free via Groq' },
  ],
};

export const MODE_DEFAULTS: Record<Mode, { provider: Provider; model: string }> = {
  CHAT: { provider: 'groq', model: 'llama-3.3-70b' },
  DESIGN: { provider: 'groq', model: 'llama-3.3-70b' },
  BUILD: { provider: 'groq', model: 'llama-3.3-70b' },
};

// API Types
export interface BootstrapResponse {
  userId: string;
  preferences: {
    theme: string;
    currentConversationIdChat: string | null;
    currentConversationIdDesign: string | null;
    currentConversationIdBuild: string | null;
    defaultProviderChat: Provider;
    defaultModelChat: string;
    defaultProviderDesign: Provider;
    defaultModelDesign: string;
    defaultProviderBuild: Provider;
    defaultModelBuild: string;
  };
  conversations: {
    chat: ConversationSummary | null;
    design: ConversationSummary | null;
    build: ConversationSummary | null;
  };
}

export interface ConversationSummary {
  id: string;
  mode: Mode;
  title: string | null;
  provider: Provider;
  model: string;
  workspaceId: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ConversationWithMessages {
  id: string;
  userId: string;
  mode: Mode;
  title: string | null;
  provider: Provider;
  model: string;
  workspaceId: string | null;
  createdAt: string;
  updatedAt: string;
  messages: MessageData[];
}

export interface MessageData {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  clientMessageId: string | null;
  tokenIn: number | null;
  tokenOut: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface WorkspaceData {
  id: string;
  userId: string;
  name: string | null;
  status: WorkspaceStatus;
  containerId: string | null;
  hostPath: string;
  exposedPort: number | null;
  previewUrlPath: string | null;
  lastCommandAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Chat streaming types
export interface ChatStreamRequest {
  anonUserId: string;
  conversationId: string;
  mode: Mode;
  provider: Provider;
  model: string;
  message: {
    clientMessageId: string;
    content: string;
  };
}

export interface StreamEvent {
  type: 'meta' | 'delta' | 'done' | 'error';
  data: unknown;
}

export interface StreamMetaEvent {
  type: 'meta';
  data: {
    messageId: string;
    conversationId: string;
  };
}

export interface StreamDeltaEvent {
  type: 'delta';
  data: {
    text: string;
  };
}

export interface StreamDoneEvent {
  type: 'done';
  data: {
    messageId: string;
    tokenIn?: number;
    tokenOut?: number;
  };
}

export interface StreamErrorEvent {
  type: 'error';
  data: {
    message: string;
    code?: string;
  };
}

// Block parsing types
export interface ParsedBlock {
  type: 'text' | 'code' | 'diff' | 'command';
  content: string;
  language?: string;
  filename?: string;
  isAutoRan?: boolean;
  additions?: number;
  deletions?: number;
}

// Workspace execution types
export interface ExecRequest {
  command: string;
  workingDir?: string;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}

export interface PatchRequest {
  patch: string;
}

export interface PatchResult {
  success: boolean;
  filesChanged: string[];
  errors?: string[];
}

// Daemon process types
export interface DaemonInfo {
  id: string;
  command: string;
  pid: number;
  status: 'running' | 'exited' | 'failed';
  startedAt: string;
}

export interface StartDaemonRequest {
  daemonId: string;
  command: string;
  workingDir?: string;
}

export interface StartDaemonResult {
  daemonId: string;
  pid: number;
}
