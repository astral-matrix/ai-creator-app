import OpenAI from 'openai';
import { ProviderAdapter, StreamChatParams, StreamChunk, ChatMessage } from '../types';

export class OpenAIAdapter implements ProviderAdapter {
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  async *streamChat(params: StreamChatParams): AsyncIterable<StreamChunk> {
    const { model, systemMessages, messages, maxTokens = 4096, temperature = 0.7 } = params;

    // Build messages array with system messages first
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      ...systemMessages.map((content) => ({
        role: 'system' as const,
        content,
      })),
      ...messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      })),
    ];

    try {
      const stream = await this.client.chat.completions.create({
        model: this.mapModel(model),
        messages: openaiMessages,
        max_tokens: maxTokens,
        temperature,
        stream: true,
        stream_options: { include_usage: true },
      });

      let totalTokensIn = 0;
      let totalTokensOut = 0;

      for await (const chunk of stream) {
        // Handle content delta
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield { type: 'delta', text: delta };
        }

        // Handle usage info (comes at the end)
        if (chunk.usage) {
          totalTokensIn = chunk.usage.prompt_tokens;
          totalTokensOut = chunk.usage.completion_tokens;
        }
      }

      // Emit usage at the end
      if (totalTokensIn > 0 || totalTokensOut > 0) {
        yield { type: 'usage', tokenIn: totalTokensIn, tokenOut: totalTokensOut };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown OpenAI error';
      yield { type: 'error', error: message };
    }
  }

  private mapModel(model: string): string {
    // Map our model IDs to actual OpenAI model IDs
    const modelMap: Record<string, string> = {
      'gpt-4.1-nano': 'gpt-4.1-nano',
      'gpt-4o-mini': 'gpt-4o-mini',
      'gpt-4.1-mini': 'gpt-4.1-mini',
      'gpt-4.1': 'gpt-4.1',
      'gpt-4o': 'gpt-4o',
      'gpt-5-nano': 'gpt-5-nano',
      'o1': 'o1',
      'o3-mini': 'o3-mini',
    };
    return modelMap[model] || model;
  }
}
