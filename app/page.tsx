"use client";

import React from "react";
import { Loader2, Sparkles } from "lucide-react";
import { ModeTabs } from "@/components/mode-tabs";
import { ChatPane } from "@/components/chat/chat-pane";
import { PreviewPane } from "@/components/preview/preview-pane";
import { useBootstrap } from "@/lib/hooks/useBootstrap";
import { useAppStore } from "@/lib/store";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Provider, MODELS, UIMode } from "@/lib/types";

// Provider icon component
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

// Mode badge component
function ModeBadge({ mode, isDesignMode }: { mode: UIMode; isDesignMode?: boolean }) {
  // If in BUILD mode but Design sub-mode is active, show Design badge
  if (mode === "BUILD" && isDesignMode) {
    return (
      <Badge variant="outline" className="text-xs bg-purple-500/20 text-purple-400 border-purple-500/30">
        Design Mode
      </Badge>
    );
  }

  // Only show badge for BUILD mode (not CHAT)
  if (mode === "BUILD") {
    return (
      <Badge variant="outline" className="text-xs bg-green-500/20 text-green-400 border-green-500/30">
        Build Mode
      </Badge>
    );
  }

  // Return null for CHAT mode - no badge shown
  return null;
}

export default function Home() {
  const { isLoading, error } = useBootstrap();
  const { 
    activeMode, 
    setActiveMode, 
    conversations, 
    previewPanelOpen, 
    isDesignMode,
    selectedProvider,
    selectedModel,
    setSelectedProvider,
    setSelectedModel,
  } = useAppStore();

  const currentConversation = conversations[activeMode];
  const provider = selectedProvider[activeMode];
  const model = selectedModel[activeMode];

  const { createWorkspace, isCreating } = useWorkspace(currentConversation?.workspaceId);

  const handleCreateWorkspace = () => {
    createWorkspace({
      conversationId: currentConversation?.id,
      name: `Workspace - ${currentConversation?.title || "New Project"}`,
    });
  };

  const handleProviderChange = (newProvider: Provider) => {
    setSelectedProvider(activeMode, newProvider);
  };

  const handleModelChange = (newModel: string) => {
    setSelectedModel(activeMode, newModel);
  };

  const availableModels = Object.entries(MODELS).flatMap(([p, models]) =>
    models.map((m) => ({ ...m, provider: p as Provider }))
  );

  const currentModel = availableModels.find(
    (m) => m.provider === provider && m.id === model
  );

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
          {/* Left: Logo, Title, and Mode Badge */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-lg">AI Creator</span>
            </div>
            {/* Mode Badge - only visible in BUILD mode */}
            <ModeBadge mode={activeMode} isDesignMode={activeMode === "BUILD" ? isDesignMode : false} />
          </div>

          {/* Center: Mode tabs */}
          <ModeTabs 
            activeMode={activeMode} 
            onModeChange={setActiveMode}
          />

          {/* Right: LLM Model Selector */}
          <div className="flex items-center">
            <Select
              value={`${provider}:${model}`}
              onValueChange={(value) => {
                const [p, m] = value.split(":");
                handleProviderChange(p as Provider);
                handleModelChange(m);
              }}
            >
              <SelectTrigger className="w-[180px] h-8 text-xs">
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
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Chat pane */}
        <div
          className={cn(
            "flex-1 min-w-0 border-r border-border overflow-hidden",
            previewPanelOpen && activeMode === "BUILD" ? "w-[55%] flex-shrink-0" : ""
          )}
        >
          <ChatPane mode={activeMode} />
        </div>

        {/* Preview pane (only in BUILD mode, regardless of Design sub-mode) */}
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
