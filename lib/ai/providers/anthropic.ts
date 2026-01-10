import Anthropic from '@anthropic-ai/sdk';
import { ProviderAdapter, StreamChatParams, StreamChunk, ChatMessage } from '../types';

export class AnthropicAdapter implements ProviderAdapter {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  async *streamChat(params: StreamChatParams): AsyncIterable<StreamChunk> {
    const { model, systemMessages, messages, maxTokens = 4096, temperature = 0.7 } = params;

    // Anthropic uses a single system string
    const systemPrompt = systemMessages.join('\n\n');

    // Convert messages to Anthropic format (no system role in messages)
    const anthropicMessages: Anthropic.MessageParam[] = messages
      .filter((msg) => msg.role !== 'system')
      .map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

    // Ensure conversation starts with user message
    if (anthropicMessages.length === 0 || anthropicMessages[0].role !== 'user') {
      // This shouldn't happen in normal flow, but handle gracefully
      anthropicMessages.unshift({
        role: 'user',
        content: 'Hello',
      });
    }

    try {
      const stream = await this.client.messages.stream({
        model: this.mapModel(model),
        system: systemPrompt,
        messages: anthropicMessages,
        max_tokens: maxTokens,
        temperature,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          const delta = event.delta;
          if ('text' in delta) {
            yield { type: 'delta', text: delta.text };
          }
        }
      }

      // Get final message for usage
      const finalMessage = await stream.finalMessage();
      yield {
        type: 'usage',
        tokenIn: finalMessage.usage.input_tokens,
        tokenOut: finalMessage.usage.output_tokens,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Anthropic error';
      yield { type: 'error', error: message };
    }
  }

  private mapModel(model: string): string {
    // Map our model IDs to actual Anthropic model IDs
    const modelMap: Record<string, string> = {
      'opus-4.5-high': 'claude-sonnet-4-20250514', // Fallback to available model
    };
    return modelMap[model] || model;
  }
}
