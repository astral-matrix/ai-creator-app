import { Provider } from '../types';
import { ProviderAdapter, StreamChatParams, StreamChunk } from './types';
import { OpenAIAdapter } from './providers/openai';
import { AnthropicAdapter } from './providers/anthropic';
import { XAIAdapter } from './providers/xai';
import { GroqAdapter } from './providers/groq';

// Singleton instances
let openaiAdapter: OpenAIAdapter | null = null;
let anthropicAdapter: AnthropicAdapter | null = null;
let xaiAdapter: XAIAdapter | null = null;
let groqAdapter: GroqAdapter | null = null;

export function getAdapter(provider: Provider): ProviderAdapter {
  switch (provider) {
    case 'openai':
      if (!openaiAdapter) {
        openaiAdapter = new OpenAIAdapter();
      }
      return openaiAdapter;
    case 'anthropic':
      if (!anthropicAdapter) {
        anthropicAdapter = new AnthropicAdapter();
      }
      return anthropicAdapter;
    case 'xai':
      if (!xaiAdapter) {
        xaiAdapter = new XAIAdapter();
      }
      return xaiAdapter;
    case 'groq':
      if (!groqAdapter) {
        groqAdapter = new GroqAdapter();
      }
      return groqAdapter;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export async function* streamChat(
  provider: Provider,
  params: StreamChatParams
): AsyncIterable<StreamChunk> {
  const adapter = getAdapter(provider);
  yield* adapter.streamChat(params);
}

export { type ProviderAdapter, type StreamChatParams, type StreamChunk, type ChatMessage } from './types';
