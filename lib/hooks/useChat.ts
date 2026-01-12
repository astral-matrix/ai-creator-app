"use client";

import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { nanoid } from 'nanoid';
import { useAppStore } from '../store';
import { Mode, MessageData } from '../types';

interface UseChatOptions {
  onStreamComplete?: (content: string) => void;
}

export function useChat(mode: Mode, options?: UseChatOptions) {
  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    userId,
    conversations,
    setConversation,
    isStreaming,
    setIsStreaming,
    streamingContent,
    setStreamingContent,
    appendStreamingContent,
    selectedProvider,
    selectedModel,
    drafts,
    setDraft,
  } = useAppStore();

  const conversation = conversations[mode];
  const provider = selectedProvider[mode];
  const model = selectedModel[mode];
  const draft = drafts[mode];

  // Helper to get fresh conversation state (avoids stale closures)
  const getConversation = () => useAppStore.getState().conversations[mode];

  const sendMessage = useCallback(
    async (content: string) => {
      if (!userId || !conversation?.id || isStreaming || !content.trim()) {
        return;
      }

      const clientMessageId = nanoid();

      // Optimistically add user message
      const userMessage: MessageData = {
        id: clientMessageId,
        conversationId: conversation.id,
        role: 'user',
        content: content.trim(),
        status: 'complete',
        clientMessageId,
        tokenIn: null,
        tokenOut: null,
        metadata: null,
        createdAt: new Date().toISOString(),
      };

      // If this is the first message, set title immediately (optimistic update)
      const isFirstMessage = !conversation.messages || conversation.messages.length === 0;
      const newTitle = isFirstMessage 
        ? content.trim().slice(0, 30) + (content.trim().length > 30 ? '...' : '')
        : conversation.title;

      setConversation(mode, {
        ...conversation,
        title: newTitle,
        messages: [...(conversation.messages || []), userMessage],
      });

      // Clear draft
      setDraft(mode, '');

      // Start streaming
      setIsStreaming(true);
      setStreamingContent('');

      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            anonUserId: userId,
            conversationId: conversation.id,
            mode,
            provider,
            model,
            message: {
              clientMessageId,
              content: content.trim(),
            },
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let assistantMessageId = '';
        let fullContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              const eventType = line.slice(7);
              continue;
            }

            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.messageId && !assistantMessageId) {
                  assistantMessageId = data.messageId;
                }

                if (data.text) {
                  fullContent += data.text;
                  appendStreamingContent(data.text);
                }

                if (data.tokenIn !== undefined) {
                  // Stream complete
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }

        // Add assistant message to conversation (use fresh state)
        if (assistantMessageId && fullContent) {
          const currentConv = getConversation();
          const assistantMessage: MessageData = {
            id: assistantMessageId,
            conversationId: conversation.id,
            role: 'assistant',
            content: fullContent,
            status: 'complete',
            clientMessageId: null,
            tokenIn: null,
            tokenOut: null,
            metadata: null,
            createdAt: new Date().toISOString(),
          };

          setConversation(mode, {
            ...currentConv,
            messages: [...(currentConv?.messages || []), assistantMessage],
          });

          // Call onStreamComplete callback if provided
          if (options?.onStreamComplete) {
            options.onStreamComplete(fullContent);
          }
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          // User cancelled
          return;
        }

        console.error('Chat error:', error);

        // Add error message (use fresh state)
        const currentConv = getConversation();
        const errorMessage: MessageData = {
          id: nanoid(),
          conversationId: conversation.id,
          role: 'assistant',
          content: 'Sorry, an error occurred. Please try again.',
          status: 'failed',
          clientMessageId: null,
          tokenIn: null,
          tokenOut: null,
          metadata: null,
          createdAt: new Date().toISOString(),
        };

        setConversation(mode, {
          ...currentConv,
          messages: [...(currentConv?.messages || []), errorMessage],
        });
      } finally {
        setIsStreaming(false);
        setStreamingContent('');
        abortControllerRef.current = null;

        // Refetch to sync with server
        queryClient.invalidateQueries({
          queryKey: ['conversation', mode, conversation.id],
        });
        // Also refresh conversations list (for updated title/message count)
        queryClient.invalidateQueries({
          queryKey: ['conversations'],
        });
      }
    },
    [
      userId,
      conversation,
      mode,
      provider,
      model,
      isStreaming,
      setConversation,
      setDraft,
      setIsStreaming,
      setStreamingContent,
      appendStreamingContent,
      queryClient,
    ]
  );

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      setStreamingContent('');
    }
  }, [setIsStreaming, setStreamingContent]);

  return {
    messages: conversation?.messages || [],
    isStreaming,
    streamingContent,
    draft,
    setDraft: (content: string) => setDraft(mode, content),
    sendMessage,
    cancelStream,
    provider,
    model,
  };
}
