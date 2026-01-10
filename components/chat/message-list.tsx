"use client";

import React, { useEffect, useRef } from "react";
import { User, Bot, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { MessageData, Mode } from "@/lib/types";
import { MessageRenderer } from "./message-renderer";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MessageListProps {
  messages: MessageData[];
  streamingContent?: string;
  isStreaming?: boolean;
  mode: Mode;
  onApplyDiff?: (patch: string) => void;
  onRunCommand?: (command: string) => void;
  isApplying?: boolean;
  isExecuting?: boolean;
}

export function MessageList({
  messages,
  streamingContent,
  isStreaming,
  mode,
  onApplyDiff,
  onRunCommand,
  isApplying,
  isExecuting,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-4">
            <Bot className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
          <p className="text-muted-foreground text-sm">
            {mode === "CHAT" &&
              "Ask me anything! I can help with questions, brainstorming, and general assistance."}
            {mode === "DESIGN" &&
              "Let's design something together. I can help with architecture, planning, and specifications."}
            {mode === "BUILD" &&
              "Ready to build! I can generate code, create files, and help you execute commands."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-6" ref={scrollRef}>
        {messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            mode={mode}
            onApplyDiff={onApplyDiff}
            onRunCommand={onRunCommand}
            isApplying={isApplying}
            isExecuting={isExecuting}
          />
        ))}

        {/* Streaming message */}
        {isStreaming && streamingContent && (
          <div className="flex gap-4 animate-fade-in">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <MessageRenderer
                content={streamingContent}
                mode={mode}
                onApplyDiff={onApplyDiff}
                onRunCommand={onRunCommand}
              />
              <div className="flex items-center gap-1 mt-2">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <span
                  className="w-2 h-2 bg-primary rounded-full animate-pulse"
                  style={{ animationDelay: "0.2s" }}
                />
                <span
                  className="w-2 h-2 bg-primary rounded-full animate-pulse"
                  style={{ animationDelay: "0.4s" }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

interface MessageItemProps {
  message: MessageData;
  mode: Mode;
  onApplyDiff?: (patch: string) => void;
  onRunCommand?: (command: string) => void;
  isApplying?: boolean;
  isExecuting?: boolean;
}

function MessageItem({
  message,
  mode,
  onApplyDiff,
  onRunCommand,
  isApplying,
  isExecuting,
}: MessageItemProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isFailed = message.status === "failed";

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="bg-muted/50 rounded-lg px-4 py-2 text-sm text-muted-foreground max-w-md">
          <MessageRenderer content={message.content} mode={mode} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-4 animate-fade-in",
        isUser && "flex-row-reverse"
      )}
    >
      <div className="flex-shrink-0">
        {isUser ? (
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
            <User className="w-4 h-4" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary-foreground" />
          </div>
        )}
      </div>
      <div
        className={cn(
          "flex-1 min-w-0",
          isUser && "flex justify-end"
        )}
      >
        <div
          className={cn(
            isUser &&
              "bg-primary/10 rounded-2xl rounded-tr-sm px-4 py-3 inline-block max-w-[85%]"
          )}
        >
          {isFailed && (
            <div className="flex items-center gap-2 text-destructive text-sm mb-2">
              <AlertCircle className="w-4 h-4" />
              <span>Failed to generate response</span>
            </div>
          )}
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <MessageRenderer
              content={message.content}
              mode={mode}
              onApplyDiff={onApplyDiff}
              onRunCommand={onRunCommand}
              isApplying={isApplying}
              isExecuting={isExecuting}
            />
          )}
        </div>
      </div>
    </div>
  );
}
