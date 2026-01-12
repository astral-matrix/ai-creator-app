"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAppStore } from '../store';
import { Mode, ConversationWithMessages, Provider } from '../types';

// A conversation is empty if it has no messages
function isEmpty(conv: ConversationWithMessages | null): boolean {
  if (!conv) return false;
  return !conv.messages || conv.messages.length === 0;
}

export function useConversation(mode: Mode) {
  const { userId, conversations, setConversation } = useAppStore();
  const queryClient = useQueryClient();

  const conversation = conversations[mode];

  const query = useQuery({
    queryKey: ['conversation', mode, conversation?.id],
    queryFn: async (): Promise<ConversationWithMessages | null> => {
      if (!userId || !conversation?.id) return null;

      const res = await fetch(
        `/api/conversations/${conversation.id}?anonUserId=${userId}`
      );

      if (!res.ok) {
        throw new Error('Failed to fetch conversation');
      }

      return res.json();
    },
    enabled: !!userId && !!conversation?.id,
  });

  // Update store when data changes - use useEffect to avoid setState during render
  useEffect(() => {
    if (query.data && query.data.id === conversation?.id) {
      // Only update if the data is actually different
      const currentMessages = conversation?.messages || [];
      const newMessages = query.data.messages || [];
      
      if (currentMessages.length !== newMessages.length || 
          JSON.stringify(currentMessages) !== JSON.stringify(newMessages)) {
        setConversation(mode, query.data);
      }
    }
  }, [query.data, conversation?.id, conversation?.messages, mode, setConversation]);

  const newChatMutation = useMutation({
    mutationFn: async ({
      provider,
      model,
    }: {
      provider: Provider;
      model: string;
    }) => {
      // Check if current conversation is empty and should be deleted
      const shouldDeleteCurrent = isEmpty(conversation);
      const currentId = conversation?.id;

      const res = await fetch('/api/conversations/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anonUserId: userId,
          mode,
          provider,
          model,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create conversation');
      }

      // Delete the empty placeholder conversation if needed
      if (shouldDeleteCurrent && currentId) {
        await fetch(
          `/api/conversations/${currentId}?anonUserId=${userId}`,
          { method: 'DELETE' }
        ).catch(console.error); // Don't fail if delete fails
      }

      return res.json();
    },
    onSuccess: (data) => {
      setConversation(mode, { ...data, messages: [] });
      queryClient.invalidateQueries({ queryKey: ['conversation', mode] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  return {
    conversation: conversation || query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createNewChat: newChatMutation.mutate,
    isCreatingChat: newChatMutation.isPending,
  };
}
