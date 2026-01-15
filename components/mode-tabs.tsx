"use client";

import React from "react";
import { MessageSquare, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { UIMode } from "@/lib/types";

interface ModeTabsProps {
  activeMode: UIMode;
  onModeChange: (mode: UIMode) => void;
}

const modes: { id: UIMode; label: string; icon: React.ElementType; description: string }[] = [
  {
    id: "CHAT",
    label: "Chat",
    icon: MessageSquare,
    description: "General conversation",
  },
  {
    id: "BUILD",
    label: "Build",
    icon: Wrench,
    description: "Design & code",
  },
];

export function ModeTabs({ activeMode, onModeChange }: ModeTabsProps) {
  return (
    <div className="flex items-center bg-muted rounded-xl p-1 gap-1">
      {modes.map((mode) => {
        const Icon = mode.icon;
        const isActive = activeMode === mode.id;

        return (
          <button
            key={mode.id}
            onClick={() => onModeChange(mode.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <Icon className="w-4 h-4" />
            <span>{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
