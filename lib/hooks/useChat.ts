"use client";

import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { nanoid } from 'nanoid';
import { useAppStore } from '../store';
import { UIMode, Mode, MessageData, ConversationWithMessages } from '../types';

interface UseChatOptions {
  onStreamComplete?: (content: string) => void;
}

export function useChat(uiMode: UIMode, options?: UseChatOptions) {
  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isSending, setIsSending] = useState(false);

  const {
    userId,
    conversations,
    setConversation,
    streaming,
    setIsStreaming,
    setStreamingContent,
    appendStreamingContent,
    selectedProvider,
    selectedModel,
    drafts,
    setDraft,
    isDesignMode,
    setIsDesignMode,
  } = useAppStore();

  const conversation = conversations[uiMode];
  const provider = selectedProvider[uiMode];
  const model = selectedModel[uiMode];
  const draft = drafts[uiMode];
  
  // Get streaming state for this specific mode
  const isStreaming = streaming[uiMode].isStreaming;
  const streamingContent = streaming[uiMode].content;

  // Determine the actual backend mode to send to API
  // If in BUILD UI mode and Design sub-mode is active, send DESIGN mode
  const getBackendMode = useCallback((): Mode => {
    if (uiMode === 'BUILD' && isDesignMode) {
      return 'DESIGN';
    }
    return uiMode;
  }, [uiMode, isDesignMode]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!userId || isStreaming || isSending || !content.trim()) {
        return;
      }

      const clientMessageId = nanoid();
      const trimmedContent = content.trim();
      const backendMode = getBackendMode();

      // Clear draft immediately
      setDraft(uiMode, '');

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
        setConversation(uiMode, {
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
            mode: backendMode, // Send the actual backend mode (DESIGN or BUILD)
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

        // Start streaming state (mode-specific)
        setIsSending(false);
        setIsStreaming(uiMode, true);
        setStreamingContent(uiMode, '');

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
                      mode: backendMode, // Store the actual backend mode
                      title: newTitle,
                      provider,
                      model,
                      workspaceId: newWorkspaceId,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      messages: [{ ...userMessage, conversationId: newConversationId }],
                    };
                    setConversation(uiMode, newConv);
                  }
                }

                if (data.messageId && !assistantMessageId) {
                  assistantMessageId = data.messageId;
                }

                if (data.text) {
                  fullContent += data.text;
                  appendStreamingContent(uiMode, data.text);
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }

        // Get fresh conversation state
        const currentConv = useAppStore.getState().conversations[uiMode];

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

          setConversation(uiMode, {
            ...currentConv,
            messages: [...(currentConv.messages || []), assistantMessage],
          });

          // Check if AI agent switched modes (only for BUILD UI mode)
          if (uiMode === 'BUILD') {
            // Check for mode switch signals in the AI response
            if (fullContent.includes('Design mode selected...') || 
                fullContent.includes('Switched to Design Mode')) {
              setIsDesignMode(true);
            } else if (fullContent.includes('Build mode selected...') || 
                       fullContent.includes('Switched to Build Mode')) {
              setIsDesignMode(false);
            }
          }

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
        const currentConv = useAppStore.getState().conversations[uiMode];

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

          setConversation(uiMode, {
            ...currentConv,
            messages: [...(currentConv.messages || []), errorMessage],
          });
        }
      } finally {
        setIsSending(false);
        setIsStreaming(uiMode, false);
        setStreamingContent(uiMode, '');
        abortControllerRef.current = null;

        // Refresh data from server
        queryClient.invalidateQueries({ queryKey: ['conversation', uiMode] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }
    },
    [
      userId,
      conversation,
      uiMode,
      provider,
      model,
      isStreaming,
      isSending,
      isDesignMode,
      getBackendMode,
      setConversation,
      setDraft,
      setIsStreaming,
      setStreamingContent,
      appendStreamingContent,
      setIsDesignMode,
      queryClient,
      options,
    ]
  );

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsSending(false);
      setIsStreaming(uiMode, false);
      setStreamingContent(uiMode, '');
    }
  }, [uiMode, setIsStreaming, setStreamingContent]);

  return {
    messages: conversation?.messages || [],
    isStreaming,
    isSending,
    streamingContent,
    draft,
    setDraft: (content: string) => setDraft(uiMode, content),
    sendMessage,
    cancelStream,
    provider,
    model,
    conversationId: conversation?.id,
    title: conversation?.title,
  };
}
