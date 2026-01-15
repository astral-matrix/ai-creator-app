"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "../store";
import { UIMode, ConversationSummary, ConversationWithMessages } from "../types";

export function useConversations(uiMode?: UIMode) {
  const { userId, setConversation, setIsDesignMode } = useAppStore();
  const queryClient = useQueryClient();

  // Fetch all conversations for the user
  // For BUILD UI mode, fetch both BUILD and DESIGN mode conversations
  const query = useQuery({
    queryKey: ["conversations", userId, uiMode],
    queryFn: async (): Promise<ConversationSummary[]> => {
      if (!userId) return [];

      const params = new URLSearchParams({ anonUserId: userId });
      
      // For BUILD UI mode, we need to fetch both BUILD and DESIGN conversations
      // For CHAT, just fetch CHAT
      // If no mode specified, fetch all
      if (uiMode === "BUILD") {
        // Fetch all and filter client-side to include both BUILD and DESIGN
        const res = await fetch(`/api/conversations?${params.toString()}`);
        if (!res.ok) {
          throw new Error("Failed to fetch conversations");
        }
        const data = await res.json();
        // Filter to only BUILD and DESIGN mode conversations
        return data.conversations.filter(
          (c: ConversationSummary) => c.mode === "BUILD" || c.mode === "DESIGN"
        );
      } else if (uiMode) {
        params.append("mode", uiMode);
        const res = await fetch(`/api/conversations?${params.toString()}`);
        if (!res.ok) {
          throw new Error("Failed to fetch conversations");
        }
        const data = await res.json();
        return data.conversations;
      } else {
        // No mode filter - fetch all
        const res = await fetch(`/api/conversations?${params.toString()}`);
        if (!res.ok) {
          throw new Error("Failed to fetch conversations");
        }
        const data = await res.json();
        return data.conversations;
      }
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
      targetMode: UIMode;
    }) => {
      if (!userId) throw new Error("No user ID");

      // Fetch the full conversation with messages
      const res = await fetch(
        `/api/conversations/${conversationId}?anonUserId=${userId}`
      );

      if (!res.ok) {
        throw new Error("Failed to fetch conversation");
      }

      const conversation: ConversationWithMessages = await res.json();

      // Map the conversation's actual mode to determine if it's a DESIGN conversation
      const isDesignConversation = conversation.mode === "DESIGN";

      // Update user preferences to set this as current conversation
      // Use BUILD for the preference key since DESIGN is now under BUILD tab
      const prefKey = targetMode === "BUILD" ? "currentConversationIdBuild" : "currentConversationIdChat";
      
      await fetch("/api/bootstrap", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anonUserId: userId,
          preferences: {
            [prefKey]: conversationId,
          },
        }),
      });

      return { conversation, targetMode, isDesignConversation };
    },
    onSuccess: ({ conversation, targetMode, isDesignConversation }) => {
      setConversation(targetMode, conversation);
      // Set design mode based on the conversation's actual mode
      if (targetMode === "BUILD") {
        setIsDesignMode(isDesignConversation);
      }
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
