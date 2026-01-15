"use client";

import React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatSelector } from "./chat-selector";
import { UIMode, ConversationSummary } from "@/lib/types";

interface ChatHeaderProps {
  mode: UIMode;
  title?: string | null;
  conversationId?: string | null;
  conversations: ConversationSummary[];
  isLoadingConversations?: boolean;
  onNewChat: () => void;
  onSelectChat: (conversationId: string) => void;
}

export function ChatHeader({
  mode,
  title,
  conversationId,
  conversations,
  isLoadingConversations,
  onNewChat,
  onSelectChat,
}: ChatHeaderProps) {
  return (
    <div className="border-b border-border bg-card/50 px-4 py-3">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onNewChat}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
        <div className="h-4 w-px bg-border" />
        <ChatSelector
          currentTitle={title}
          currentId={conversationId}
          conversations={conversations}
          isLoading={isLoadingConversations}
          onSelectChat={onSelectChat}
        />
      </div>
    </div>
  );
}
