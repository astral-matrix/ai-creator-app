"use client";

import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { nanoid } from 'nanoid';
import { useAppStore } from '../store';
import { Mode, MessageData, ConversationWithMessages } from '../types';

interface UseChatOptions {
  onStreamComplete?: (content: string) => void;
}

export function useChat(mode: Mode, options?: UseChatOptions) {
  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isSending, setIsSending] = useState(false);

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

  const sendMessage = useCallback(
    async (content: string) => {
      if (!userId || isStreaming || isSending || !content.trim()) {
        return;
      }

      const clientMessageId = nanoid();
      const trimmedContent = content.trim();

      // Clear draft immediately
      setDraft(mode, '');

      // Set sending state (shows "Sending..." for new conversations)
      setIsSending(true);

      // Create optimistic user message
      const userMessage: MessageData = {
        id: clientMessageId,
        conversationId: conversation?.id || 'pending',
        role: 'user',
        content: trimmedContent,
        status: 'complete',
        clientMessageId,
        tokenIn: null,
        tokenOut: null,
        metadata: null,
        createdAt: new Date().toISOString(),
      };

      // If we have a conversation, add message optimistically
      if (conversation) {
        setConversation(mode, {
          ...conversation,
          messages: [...(conversation.messages || []), userMessage],
        });
      }

      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            anonUserId: userId,
            conversationId: conversation?.id || null, // null triggers new conversation creation
            mode,
            provider,
            model,
            message: {
              clientMessageId,
              content: trimmedContent,
            },
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        // Start streaming state
        setIsSending(false);
        setIsStreaming(true);
        setStreamingContent('');

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let assistantMessageId = '';
        let fullContent = '';
        let newConversationId: string | null = null;
        let newTitle: string | null = null;
        let newWorkspaceId: string | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                // Handle meta event (contains conversation info for new conversations)
                if (data.conversationId && !newConversationId) {
                  newConversationId = data.conversationId;
                  newTitle = data.title;
                  newWorkspaceId = data.workspaceId;
                  
                  // If this is a new conversation, create it in the store
                  if (data.isNewConversation) {
                    const newConv: ConversationWithMessages = {
                      id: newConversationId,
                      userId,
                      mode,
                      title: newTitle,
                      provider,
                      model,
                      workspaceId: newWorkspaceId,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      messages: [{ ...userMessage, conversationId: newConversationId }],
                    };
                    setConversation(mode, newConv);
                  }
                }

                if (data.messageId && !assistantMessageId) {
                  assistantMessageId = data.messageId;
                }

                if (data.text) {
                  fullContent += data.text;
                  appendStreamingContent(data.text);
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }

        // Get fresh conversation state
        const currentConv = useAppStore.getState().conversations[mode];

        // Add assistant message to conversation
        if (assistantMessageId && fullContent && currentConv) {
          const assistantMessage: MessageData = {
            id: assistantMessageId,
            conversationId: currentConv.id,
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
            messages: [...(currentConv.messages || []), assistantMessage],
          });

          // Call onStreamComplete callback if provided
          if (options?.onStreamComplete) {
            options.onStreamComplete(fullContent);
          }
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return;
        }

        console.error('Chat error:', error);

        // Get fresh conversation state for error handling
        const currentConv = useAppStore.getState().conversations[mode];

        if (currentConv) {
          const errorMessage: MessageData = {
            id: nanoid(),
            conversationId: currentConv.id,
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
            messages: [...(currentConv.messages || []), errorMessage],
          });
        }
      } finally {
        setIsSending(false);
        setIsStreaming(false);
        setStreamingContent('');
        abortControllerRef.current = null;

        // Refresh data from server
        queryClient.invalidateQueries({ queryKey: ['conversation', mode] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }
    },
    [
      userId,
      conversation,
      mode,
      provider,
      model,
      isStreaming,
      isSending,
      setConversation,
      setDraft,
      setIsStreaming,
      setStreamingContent,
      appendStreamingContent,
      queryClient,
      options,
    ]
  );

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsSending(false);
      setIsStreaming(false);
      setStreamingContent('');
    }
  }, [setIsStreaming, setStreamingContent]);

  return {
    messages: conversation?.messages || [],
    isStreaming,
    isSending, // New: true while waiting for server to create conversation
    streamingContent,
    draft,
    setDraft: (content: string) => setDraft(mode, content),
    sendMessage,
    cancelStream,
    provider,
    model,
    conversationId: conversation?.id,
    title: conversation?.title,
  };
}
