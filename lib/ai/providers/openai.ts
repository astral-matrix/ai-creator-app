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
    // In production, these would be real model names
    const modelMap: Record<string, string> = {
      'gpt-5.2': 'gpt-4o', // Fallback to available model
      'gpt-5.2-thinking': 'gpt-4o', // Fallback to available model
    };
    return modelMap[model] || model;
  }
}
