import { ProviderAdapter, StreamChatParams, StreamChunk } from '../types';

interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export class GeminiAdapter implements ProviderAdapter {
  private apiKey: string;
  private baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
  }

  async *streamChat(params: StreamChatParams): AsyncIterable<StreamChunk> {
    const { model, systemMessages, messages, maxTokens = 4096, temperature = 0.7 } = params;

    // Build contents array (Gemini format)
    const contents: GeminiContent[] = messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    // Combine system messages into a system instruction
    const systemInstruction = systemMessages.join('\n\n');

    try {
      const modelName = this.mapModel(model);
      const response = await fetch(
        `${this.baseUrl}/models/${modelName}:streamGenerateContent?key=${this.apiKey}&alt=sse`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents,
            systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
            generationConfig: {
              maxOutputTokens: maxTokens,
              temperature,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error:', response.status, errorText);
        yield { type: 'error', error: `Gemini API error: ${response.status} - ${errorText}` };
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        yield { type: 'error', error: 'No response body from Gemini' };
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
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            
            // Extract text from candidates
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              yield { type: 'delta', text };
            }

            // Extract usage metadata
            if (json.usageMetadata) {
              totalTokensIn = json.usageMetadata.promptTokenCount || 0;
              totalTokensOut = json.usageMetadata.candidatesTokenCount || 0;
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
      const message = error instanceof Error ? error.message : 'Unknown Gemini error';
      console.error('Gemini error:', message);
      yield { type: 'error', error: message };
    }
  }

  private mapModel(model: string): string {
    // Gemini model mapping
    const modelMap: Record<string, string> = {
      'gemini-2.0-flash': 'gemini-2.0-flash-exp',
      'gemini-1.5-flash': 'gemini-1.5-flash',
      'gemini-1.5-pro': 'gemini-1.5-pro',
    };
    return modelMap[model] || model;
  }
}
