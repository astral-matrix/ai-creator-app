"use client";

import React, { useState } from "react";
import { ChevronDown, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ConversationSummary } from "@/lib/types";

interface ChatSelectorProps {
  currentTitle?: string | null;
  currentId?: string | null;
  conversations: ConversationSummary[];
  isLoading?: boolean;
  onSelectChat: (conversationId: string) => void;
}

export function ChatSelector({
  currentTitle,
  currentId,
  conversations,
  isLoading,
  onSelectChat,
}: ChatSelectorProps) {
  const [open, setOpen] = useState(false);

  // Don't render if there's no history
  if (!isLoading && conversations.length === 0) {
    return null;
  }

  // Show "Chat History" unless we have a real title (non-empty conversation with title)
  const hasRealTitle = currentTitle && currentTitle.trim().length > 0;
  const displayTitle = hasRealTitle ? currentTitle : "Chat History";
  const truncatedTitle =
    displayTitle.length > 25
      ? displayTitle.substring(0, 25) + "..."
      : displayTitle;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-8 px-3 gap-2 text-sm font-medium hover:bg-muted/50 max-w-[200px]"
        >
          <span className="truncate">{truncatedTitle}</span>
          <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px]">
        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Conversation list */}
        {!isLoading &&
          conversations.map((conv) => (
            <DropdownMenuItem
              key={conv.id}
              onClick={() => {
                onSelectChat(conv.id);
                setOpen(false);
              }}
              className={cn(
                "flex items-start gap-2 py-2",
                conv.id === currentId && "bg-muted"
              )}
            >
              <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium">
                  {conv.title || "Untitled"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {conv.messageCount} messages •{" "}
                  {formatRelativeTime(conv.updatedAt)}
                </div>
              </div>
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
