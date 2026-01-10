"use client";

import React, { useEffect } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { ModeTabs } from "@/components/mode-tabs";
import { ChatPane } from "@/components/chat/chat-pane";
import { PreviewPane } from "@/components/preview/preview-pane";
import { useBootstrap } from "@/lib/hooks/useBootstrap";
import { useAppStore } from "@/lib/store";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { cn } from "@/lib/utils";

export default function Home() {
  const { isLoading, error } = useBootstrap();
  const { activeMode, setActiveMode, conversations, previewPanelOpen } = useAppStore();

  const currentConversation = conversations[activeMode];

  const { createWorkspace, isCreating } = useWorkspace(currentConversation?.workspaceId);

  const handleCreateWorkspace = () => {
    createWorkspace({
      conversationId: currentConversation?.id,
      name: `Workspace - ${currentConversation?.title || "New Project"}`,
    });
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Sparkles className="w-8 h-8 text-primary-foreground" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-8">
          <h1 className="text-xl font-semibold text-destructive mb-2">
            Failed to load
          </h1>
          <p className="text-muted-foreground mb-4">
            {error instanceof Error ? error.message : "An error occurred"}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-border bg-card/50 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-lg">AI Creator</span>
            </div>
          </div>

          <ModeTabs activeMode={activeMode} onModeChange={setActiveMode} />

          <div className="w-[140px]" /> {/* Spacer for balance */}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Chat pane */}
        <div
          className={cn(
            "flex-1 min-w-0 border-r border-border",
            previewPanelOpen && activeMode === "BUILD" ? "max-w-[55%]" : ""
          )}
        >
          <ChatPane mode={activeMode} />
        </div>

        {/* Preview pane (only in BUILD mode) */}
        {activeMode === "BUILD" && previewPanelOpen && (
          <div className="w-[45%] flex-shrink-0">
            <PreviewPane
              workspaceId={currentConversation?.workspaceId}
              conversationId={currentConversation?.id}
              onCreateWorkspace={handleCreateWorkspace}
            />
          </div>
        )}
      </main>
    </div>
  );
}
