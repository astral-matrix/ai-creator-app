"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "../store";
import { Mode, ConversationSummary, ConversationWithMessages } from "../types";

// A conversation is empty if it has no messages
function isEmpty(conv: ConversationWithMessages | null): boolean {
  if (!conv) return false;
  return !conv.messages || conv.messages.length === 0;
}

export function useConversations(mode?: Mode) {
  const { userId, conversations, setConversation } = useAppStore();
  const queryClient = useQueryClient();

  // Fetch all conversations for the user (optionally filtered by mode)
  const query = useQuery({
    queryKey: ["conversations", userId, mode],
    queryFn: async (): Promise<ConversationSummary[]> => {
      if (!userId) return [];

      const params = new URLSearchParams({ anonUserId: userId });
      if (mode) {
        params.append("mode", mode);
      }

      const res = await fetch(`/api/conversations?${params.toString()}`);

      if (!res.ok) {
        throw new Error("Failed to fetch conversations");
      }

      const data = await res.json();
      return data.conversations;
    },
    enabled: !!userId,
  });

  // Select a conversation by ID
  const selectMutation = useMutation({
    mutationFn: async ({
      conversationId,
      targetMode,
    }: {
      conversationId: string;
      targetMode: Mode;
    }) => {
      if (!userId) throw new Error("No user ID");

      // Check if current conversation is empty and should be deleted
      const currentConv = conversations[targetMode];
      const shouldDeleteCurrent = isEmpty(currentConv) && currentConv?.id !== conversationId;

      // Fetch the full conversation with messages
      const res = await fetch(
        `/api/conversations/${conversationId}?anonUserId=${userId}`
      );

      if (!res.ok) {
        throw new Error("Failed to fetch conversation");
      }

      const conversation: ConversationWithMessages = await res.json();

      // Delete the empty placeholder conversation if needed
      if (shouldDeleteCurrent && currentConv?.id) {
        await fetch(
          `/api/conversations/${currentConv.id}?anonUserId=${userId}`,
          { method: "DELETE" }
        ).catch(console.error); // Don't fail if delete fails
      }

      // Update user preferences to set this as current conversation
      await fetch("/api/bootstrap", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anonUserId: userId,
          preferences: {
            [`currentConversationId${targetMode.charAt(0) + targetMode.slice(1).toLowerCase()}`]:
              conversationId,
          },
        }),
      });

      return { conversation, targetMode };
    },
    onSuccess: ({ conversation, targetMode }) => {
      setConversation(targetMode, conversation);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  return {
    conversations: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    selectConversation: selectMutation.mutate,
    isSelecting: selectMutation.isPending,
  };
}
