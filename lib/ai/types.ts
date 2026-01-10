export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamChunk {
  type: 'delta' | 'usage' | 'error';
  text?: string;
  tokenIn?: number;
  tokenOut?: number;
  error?: string;
}

export interface ProviderAdapter {
  streamChat(params: StreamChatParams): AsyncIterable<StreamChunk>;
}

export interface StreamChatParams {
  model: string;
  systemMessages: string[];
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}
