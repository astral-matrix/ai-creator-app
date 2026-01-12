"use client";

import React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChatSelector } from "./chat-selector";
import { Mode, Provider, MODELS, ConversationSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChatHeaderProps {
  mode: Mode;
  title?: string | null;
  conversationId?: string | null;
  provider: Provider;
  model: string;
  conversations: ConversationSummary[];
  isLoadingConversations?: boolean;
  onNewChat: () => void;
  onSelectChat: (conversationId: string) => void;
  onProviderChange: (provider: Provider) => void;
  onModelChange: (model: string) => void;
}

export function ChatHeader({
  mode,
  title,
  conversationId,
  provider,
  model,
  conversations,
  isLoadingConversations,
  onNewChat,
  onSelectChat,
  onProviderChange,
  onModelChange,
}: ChatHeaderProps) {
  const availableModels = Object.entries(MODELS).flatMap(([p, models]) =>
    models.map((m) => ({ ...m, provider: p as Provider }))
  );

  const currentModel = availableModels.find(
    (m) => m.provider === provider && m.id === model
  );

  return (
    <div className="border-b border-border bg-card/50 px-4 py-3">
      <div className="flex items-center justify-between">
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

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Select
              value={`${provider}:${model}`}
              onValueChange={(value) => {
                const [p, m] = value.split(":");
                onProviderChange(p as Provider);
                onModelChange(m);
              }}
            >
              <SelectTrigger className="w-[200px] h-8 text-xs">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <ProviderIcon provider={provider} />
                    <span>{currentModel?.name || model}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MODELS).map(([p, models]) => (
                  <React.Fragment key={p}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                      {p}
                    </div>
                    {models.map((m) => (
                      <SelectItem key={`${p}:${m.id}`} value={`${p}:${m.id}`}>
                        <div className="flex items-center gap-2">
                          <ProviderIcon provider={p as Provider} />
                          <span>{m.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </React.Fragment>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ModeBadge mode={mode} />
        </div>
      </div>
    </div>
  );
}

function ProviderIcon({ provider }: { provider: Provider }) {
  const colors: Record<Provider, string> = {
    openai: "bg-emerald-500",
    anthropic: "bg-orange-500",
    xai: "bg-blue-500",
    groq: "bg-purple-500",
    gemini: "bg-cyan-500",
  };

  return (
    <div className={cn("w-2 h-2 rounded-full", colors[provider])} />
  );
}

function ModeBadge({ mode }: { mode: Mode }) {
  const variants: Record<Mode, { label: string; className: string }> = {
    CHAT: {
      label: "Chat Mode",
      className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    },
    DESIGN: {
      label: "Design Mode",
      className: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    },
    BUILD: {
      label: "Build Mode",
      className: "bg-green-500/20 text-green-400 border-green-500/30",
    },
  };

  const { label, className } = variants[mode];

  return (
    <Badge variant="outline" className={cn("text-xs", className)}>
      {label}
    </Badge>
  );
}
