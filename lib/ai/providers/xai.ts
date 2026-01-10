import { ProviderAdapter, StreamChatParams, StreamChunk } from '../types';

interface XAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface XAIStreamResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class XAIAdapter implements ProviderAdapter {
  private apiKey: string;
  private baseUrl: string = 'https://api.x.ai/v1';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.XAI_API_KEY || '';
  }

  async *streamChat(params: StreamChatParams): AsyncIterable<StreamChunk> {
    const { model, systemMessages, messages, maxTokens = 4096, temperature = 0.7 } = params;

    // Build messages array
    const xaiMessages: XAIMessage[] = [
      ...systemMessages.map((content) => ({
        role: 'system' as const,
        content,
      })),
      ...messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    ];

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.mapModel(model),
          messages: xaiMessages,
          max_tokens: maxTokens,
          temperature,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        yield { type: 'error', error: `xAI API error: ${response.status} - ${errorText}` };
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        yield { type: 'error', error: 'No response body from xAI' };
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let totalTokensIn = 0;
      let totalTokensOut = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json: XAIStreamResponse = JSON.parse(trimmed.slice(6));
            const delta = json.choices[0]?.delta?.content;
            if (delta) {
              yield { type: 'delta', text: delta };
            }

            if (json.usage) {
              totalTokensIn = json.usage.prompt_tokens;
              totalTokensOut = json.usage.completion_tokens;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      if (totalTokensIn > 0 || totalTokensOut > 0) {
        yield { type: 'usage', tokenIn: totalTokensIn, tokenOut: totalTokensOut };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown xAI error';
      yield { type: 'error', error: message };
    }
  }

  private mapModel(model: string): string {
    const modelMap: Record<string, string> = {
      'grok-latest': 'grok-beta', // Map to actual available model
    };
    return modelMap[model] || model;
  }
}
