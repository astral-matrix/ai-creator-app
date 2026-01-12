import { NextRequest } from 'next/server';
import { userRepo, conversationRepo, messageRepo } from '@/lib/db/repositories';
import { streamChat, ChatMessage } from '@/lib/ai';
import { assembleSystemMessages } from '@/lib/ai/prompt-assembly';
import { ChatStreamRequest, Provider, Mode } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const body: ChatStreamRequest = await request.json();
    const { anonUserId, conversationId, mode, provider, model, message } = body;

    // Validate required fields
    if (!anonUserId || !conversationId || !mode || !provider || !model || !message?.content) {
      return new Response(
        encoder.encode(`event: error\ndata: ${JSON.stringify({ message: 'Missing required fields' })}\n\n`),
        {
          status: 400,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        }
      );
    }

    // Verify user and conversation
    const user = await userRepo.findOrCreate(anonUserId);
    const conversation = await conversationRepo.findById(conversationId);

    if (!conversation || conversation.userId !== user.id) {
      return new Response(
        encoder.encode(`event: error\ndata: ${JSON.stringify({ message: 'Conversation not found' })}\n\n`),
        {
          status: 404,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        }
      );
    }

    // Check for duplicate message (idempotency)
    if (message.clientMessageId) {
      const existing = await messageRepo.findByClientMessageId(message.clientMessageId);
      if (existing) {
        return new Response(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ message: 'Duplicate message', code: 'DUPLICATE' })}\n\n`),
          {
            status: 409,
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
            },
          }
        );
      }
    }

    // Persist user message
    const userMessage = await messageRepo.create({
      conversationId,
      role: 'user',
      content: message.content,
      status: 'complete',
      clientMessageId: message.clientMessageId,
    });

    // Create assistant message with streaming status
    const assistantMessage = await messageRepo.create({
      conversationId,
      role: 'assistant',
      content: '',
      status: 'streaming',
    });

    // Build messages array for LLM
    const historyMessages = conversation.messages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    // Add the new user message
    const chatMessages: ChatMessage[] = [
      ...historyMessages,
      { role: 'user', content: message.content },
    ];

    // Assemble system messages
    const systemMessages = assembleSystemMessages(mode as Mode);

    // Create readable stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send meta event
          controller.enqueue(
            encoder.encode(
              `event: meta\ndata: ${JSON.stringify({
                messageId: assistantMessage.id,
                conversationId,
              })}\n\n`
            )
          );

          let fullContent = '';
          let tokenIn = 0;
          let tokenOut = 0;

          // Stream from LLM
          for await (const chunk of streamChat(provider as Provider, {
            model,
            systemMessages,
            messages: chatMessages,
          })) {
            if (chunk.type === 'delta' && chunk.text) {
              fullContent += chunk.text;
              controller.enqueue(
                encoder.encode(`event: delta\ndata: ${JSON.stringify({ text: chunk.text })}\n\n`)
              );
            } else if (chunk.type === 'usage') {
              tokenIn = chunk.tokenIn || 0;
              tokenOut = chunk.tokenOut || 0;
            } else if (chunk.type === 'error') {
              controller.enqueue(
                encoder.encode(`event: error\ndata: ${JSON.stringify({ message: chunk.error })}\n\n`)
              );
              await messageRepo.updateStatus(assistantMessage.id, 'failed');
              controller.close();
              return;
            }
          }

          // Update assistant message with full content
          await messageRepo.updateContent(assistantMessage.id, fullContent, 'complete');

          // Update usage if available
          if (tokenIn > 0 || tokenOut > 0) {
            await messageRepo.updateUsage(assistantMessage.id, tokenIn, tokenOut);
          }

          // Auto-generate title if this is the first message or has placeholder title
          const isPlaceholderTitle = !conversation.title || conversation.title.startsWith('Untitled-');
          if (conversation.messages.length === 0 && isPlaceholderTitle) {
            // Use first ~30 chars of the user's message as title
            const title = message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '');
            await conversationRepo.updateTitle(conversationId, title);
          }

          // Send done event
          controller.enqueue(
            encoder.encode(
              `event: done\ndata: ${JSON.stringify({
                messageId: assistantMessage.id,
                tokenIn,
                tokenOut,
              })}\n\n`
            )
          );

          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ message: errorMessage })}\n\n`)
          );
          await messageRepo.updateStatus(assistantMessage.id, 'failed');
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat stream error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      encoder.encode(`event: error\ndata: ${JSON.stringify({ message: errorMessage })}\n\n`),
      {
        status: 500,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      }
    );
  }
}
