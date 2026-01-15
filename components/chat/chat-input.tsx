"use client";

import React, { useRef, useEffect, KeyboardEvent, ReactNode } from "react";
import { Send, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancel?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onCancel,
  isStreaming,
  disabled,
  placeholder = "Type a message...",
  leftAction,
  rightAction,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && value.trim()) {
        onSend();
      }
    }
  };

  const handleSend = () => {
    if (!isStreaming && value.trim()) {
      onSend();
    }
  };

  return (
    <div className="bg-card/50 p-4">
      {/* Action buttons row - above text input */}
      {(leftAction || rightAction) && (
        <div className="flex justify-between items-center mb-2 max-w-4xl mx-auto">
          <div>{leftAction}</div>
          <div>{rightAction}</div>
        </div>
      )}
      
      <div className="flex items-end gap-3 max-w-4xl mx-auto">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isStreaming}
            className={cn(
              "min-h-[52px] max-h-[200px] pr-12 resize-none",
              "bg-muted border-0 focus-visible:ring-1 focus-visible:ring-primary"
            )}
            rows={1}
          />
        </div>
        <div className="flex-shrink-0">
          {isStreaming ? (
            <Button
              onClick={onCancel}
              variant="destructive"
              size="icon"
              className="h-[52px] w-[52px] rounded-xl"
            >
              <Square className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={!value.trim() || disabled}
              size="icon"
              className="h-[52px] w-[52px] rounded-xl"
            >
              {disabled ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center mt-2">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
