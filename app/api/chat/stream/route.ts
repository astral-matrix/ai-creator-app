import { NextRequest } from 'next/server';
import { userRepo, conversationRepo, messageRepo, workspaceRepo } from '@/lib/db/repositories';
import { streamChat, ChatMessage } from '@/lib/ai';
import { assembleSystemMessages } from '@/lib/ai/prompt-assembly';
import { Provider, Mode } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

const WORKSPACE_HOST_PATH = process.env.WORKSPACE_HOST_PATH || '/tmp/ai-creator-workspaces';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ChatStreamBody {
  anonUserId: string;
  conversationId?: string | null; // null for new conversation
  mode: Mode;
  provider: Provider;
  model: string;
  message: {
    clientMessageId: string;
    content: string;
  };
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const errorResponse = (message: string, status: number = 400) =>
    new Response(
      encoder.encode(`event: error\ndata: ${JSON.stringify({ message })}\n\n`),
      {
        status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      }
    );

  try {
    const body: ChatStreamBody = await request.json();
    const { anonUserId, conversationId, mode, provider, model, message } = body;

    // Validate required fields
    if (!anonUserId || !mode || !provider || !model || !message?.content) {
      return errorResponse('Missing required fields');
    }

    // Get or create user
    const user = await userRepo.findOrCreate(anonUserId);

    // Get existing conversation or create new one
    let conversation;
    let isNewConversation = false;
    let workspaceId: string | null = null;

    if (conversationId) {
      // Existing conversation
      conversation = await conversationRepo.findById(conversationId);
      if (!conversation || conversation.userId !== user.id) {
        return errorResponse('Conversation not found', 404);
      }
    } else {
      // Create new conversation with title from first message
      isNewConversation = true;
      const title = message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '');
      
      conversation = await conversationRepo.create({
        userId: user.id,
        mode,
        provider,
        model,
        title,
      });

      // For BUILD or DESIGN mode, also create a workspace
      // (DESIGN is now a sub-mode of BUILD in the UI, so it shares workspaces)
      if (mode === 'BUILD' || mode === 'DESIGN') {
        const workspaceUuid = uuidv4();
        const hostPath = path.join(WORKSPACE_HOST_PATH, workspaceUuid);
        fs.mkdirSync(hostPath, { recursive: true });

        const workspace = await workspaceRepo.create({
          userId: user.id,
          name: title,
          hostPath,
        });

        await conversationRepo.linkWorkspace(conversation.id, workspace.id);
        workspaceId = workspace.id;
      }

      // Update user preferences to set this as current conversation
      // For DESIGN mode, use BUILD preference key since DESIGN is under BUILD tab
      const prefKey = mode === 'DESIGN' 
        ? 'currentConversationIdBuild' 
        : `currentConversationId${mode.charAt(0) + mode.slice(1).toLowerCase()}`;
      await userRepo.updatePreferences(user.id, {
        [prefKey]: conversation.id,
      } as any);

      // Re-fetch to get linked workspace
      conversation = await conversationRepo.findById(conversation.id);
    }

    // Check for duplicate message (idempotency)
    if (message.clientMessageId) {
      const existing = await messageRepo.findByClientMessageId(message.clientMessageId);
      if (existing) {
        return errorResponse('Duplicate message', 409);
      }
    }

    // Persist user message
    await messageRepo.create({
      conversationId: conversation!.id,
      role: 'user',
      content: message.content,
      status: 'complete',
      clientMessageId: message.clientMessageId,
    });

    // Create assistant message with streaming status
    const assistantMessage = await messageRepo.create({
      conversationId: conversation!.id,
      role: 'assistant',
      content: '',
      status: 'streaming',
    });

    // Build messages array for LLM (existing history + new message)
    const historyMessages = (conversation!.messages || []).map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    const chatMessages: ChatMessage[] = [
      ...historyMessages,
      { role: 'user', content: message.content },
    ];

    // Assemble system messages
    // isDesignMode is true when mode === 'DESIGN' (sent from client when Design sub-mode is active)
    const isDesignMode = mode === 'DESIGN';
    const systemMessages = assembleSystemMessages(mode, isDesignMode);

    // Create readable stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send meta event with conversation info (important for new conversations)
          controller.enqueue(
            encoder.encode(
              `event: meta\ndata: ${JSON.stringify({
                messageId: assistantMessage.id,
                conversationId: conversation!.id,
                isNewConversation,
                title: conversation!.title,
                workspaceId: workspaceId || conversation!.workspaceId,
              })}\n\n`
            )
          );

          let fullContent = '';
          let tokenIn = 0;
          let tokenOut = 0;

          // Stream from LLM
          for await (const chunk of streamChat(provider, {
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
    return errorResponse(errorMessage, 500);
  }
}
