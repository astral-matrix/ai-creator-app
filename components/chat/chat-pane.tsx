"use client";

import React, { useCallback, useState } from "react";
import { Wrench } from "lucide-react";
import { ChatHeader } from "./chat-header";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { Button } from "@/components/ui/button";
import { useChat } from "@/lib/hooks/useChat";
import { useConversation } from "@/lib/hooks/useConversation";
import { useConversations } from "@/lib/hooks/useConversations";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAppStore } from "@/lib/store";
import { UIMode } from "@/lib/types";
import { extractAllDiffPatches, extractAllCommands } from "@/lib/rendering/block-parser";

interface ChatPaneProps {
  mode: UIMode;
}

// Separate component for BUILD mode workspace functionality
function useBuildModeWorkspace(mode: UIMode, conversationWorkspaceId?: string | null) {
  const [autoApplyStatus, setAutoApplyStatus] = useState<string | null>(null);
  
  // Only fetch workspace data for BUILD mode
  const workspaceHook = useWorkspace(mode === "BUILD" ? conversationWorkspaceId : null);
  
  const { 
    execCommand, 
    applyPatch, 
    isExecuting, 
    isApplying, 
    workspace, 
    startDaemon,
    startWorkspace,
    refetch: refetchWorkspace,
  } = workspaceHook;

  // Auto-apply handler - only active for BUILD mode
  const handleStreamComplete = useCallback(
    async (content: string, conversationId?: string) => {
      if (mode !== "BUILD") return;

      // Extract all diffs and commands
      const diffs = extractAllDiffPatches(content);
      const commands = extractAllCommands(content);

      if (diffs.length === 0 && commands.length === 0) return;

      // Check if we have a workspace
      if (!workspace) {
        setAutoApplyStatus("No workspace available - please refresh and try again");
        setTimeout(() => setAutoApplyStatus(null), 5000);
        return;
      }

      setAutoApplyStatus("Applying changes...");

      try {
        // Apply all diffs
        for (let i = 0; i < diffs.length; i++) {
          setAutoApplyStatus(`Applying file ${i + 1} of ${diffs.length}...`);
          const result = await applyPatch({
            patch: diffs[i],
            conversationId,
          });
          if (!result.success) {
            console.error(`Failed to apply diff ${i + 1}:`, result.errors);
          }
        }

        // Start workspace if not running and we have commands to execute
        if (commands.length > 0 && workspace.status !== "running") {
          setAutoApplyStatus("Starting workspace...");
          try {
            startWorkspace();
            // Wait for workspace to start
            await new Promise(resolve => setTimeout(resolve, 3000));
            await refetchWorkspace();
          } catch (err) {
            console.error("Failed to start workspace:", err);
          }
        }

        // Run all commands (if workspace is running)
        const currentWorkspace = workspace; // Use current state
        if (currentWorkspace?.status === "running" && commands.length > 0) {
          for (let i = 0; i < commands.length; i++) {
            const cmd = commands[i];
            setAutoApplyStatus(`Running command ${i + 1} of ${commands.length}...`);
            
            // Check if this looks like a server start command
            const isServerCommand = 
              /^node\s+\S+\.js/.test(cmd) ||
              /^npm\s+(start|run\s+(dev|start|server))/.test(cmd) ||
              /^npx\s+(serve|http-server)/.test(cmd) ||
              /^python\s+.*server/.test(cmd) ||
              /^(http-server|serve)\b/.test(cmd);
            
            if (isServerCommand) {
              try {
                await startDaemon({
                  daemonId: `server-${Date.now()}`,
                  command: cmd,
                });
                setAutoApplyStatus("Server started as background process");
              } catch (err) {
                console.error("Failed to start daemon:", err);
                await execCommand({ command: cmd, conversationId });
              }
            } else {
              const result = await execCommand({
                command: cmd,
                conversationId,
              });
              if (result.exitCode !== 0) {
                console.error(`Command failed:`, result.stderr);
              }
            }
          }
        }

        setAutoApplyStatus(
          `Applied ${diffs.length} file(s)${commands.length > 0 ? `, ran ${commands.length} command(s)` : ""}`
        );
        
        setTimeout(() => setAutoApplyStatus(null), 3000);
      } catch (error) {
        console.error("Auto-apply error:", error);
        setAutoApplyStatus("Error applying changes");
        setTimeout(() => setAutoApplyStatus(null), 3000);
      }
    },
    [mode, workspace, applyPatch, execCommand, startDaemon, startWorkspace, refetchWorkspace]
  );

  // Auto-start workspace when first message is sent
  const autoStartWorkspace = useCallback(() => {
    if (mode === "BUILD" && workspace && workspace.status !== "running") {
      setAutoApplyStatus("Starting workspace...");
      try {
        startWorkspace();
      } catch (err) {
        console.error("Failed to auto-start workspace:", err);
      }
    }
  }, [mode, workspace, startWorkspace]);

  return {
    workspace: mode === "BUILD" ? workspace : null,
    isExecuting: mode === "BUILD" ? isExecuting : false,
    isApplying: mode === "BUILD" ? isApplying : false,
    autoApplyStatus: mode === "BUILD" ? autoApplyStatus : null,
    handleStreamComplete: mode === "BUILD" ? handleStreamComplete : undefined,
    autoStartWorkspace: mode === "BUILD" ? autoStartWorkspace : undefined,
    applyPatch: mode === "BUILD" ? applyPatch : null,
    execCommand: mode === "BUILD" ? execCommand : null,
  };
}

export function ChatPane({ mode }: ChatPaneProps) {
  const { 
    setSelectedProvider, 
    setSelectedModel, 
    conversations,
    isDesignMode,
    setIsDesignMode,
  } = useAppStore();
  const conversation = conversations[mode];

  // Use BUILD mode workspace features conditionally
  const {
    workspace,
    isExecuting,
    isApplying,
    autoApplyStatus,
    handleStreamComplete,
    autoStartWorkspace,
    applyPatch,
    execCommand,
  } = useBuildModeWorkspace(mode, conversation?.workspaceId);

  // Create the stream complete handler that includes conversationId
  const onStreamComplete = useCallback(
    (content: string) => {
      if (handleStreamComplete) {
        handleStreamComplete(content, conversation?.id);
      }
    },
    [handleStreamComplete, conversation?.id]
  );

  const {
    messages,
    isStreaming,
    isSending,
    streamingContent,
    draft,
    setDraft,
    sendMessage,
    cancelStream,
    provider,
    model,
    title,
  } = useChat(mode, { onStreamComplete: mode === "BUILD" ? onStreamComplete : undefined });

  const { startNewChat } = useConversation(mode);
  const { conversations: allConversations, isLoading: isLoadingConversations, selectConversation } = useConversations(mode);

  const handleNewChat = () => {
    startNewChat();
    // Reset design mode when starting new chat
    if (mode === "BUILD") {
      setIsDesignMode(false);
    }
  };

  const handleSelectChat = (conversationId: string) => {
    selectConversation({ conversationId, targetMode: mode });
  };

  const handleProviderChange = (newProvider: typeof provider) => {
    setSelectedProvider(mode, newProvider);
  };

  const handleModelChange = (newModel: string) => {
    setSelectedModel(mode, newModel);
  };

  const handleDesignModeToggle = () => {
    setIsDesignMode(!isDesignMode);
  };

  const handleBuildClick = () => {
    // Switch from Design Mode to Build Mode
    setIsDesignMode(false);
  };

  const handleSend = async () => {
    if (draft.trim()) {
      // Auto-start workspace in BUILD mode when first message is sent
      if (autoStartWorkspace) {
        autoStartWorkspace();
      }
      sendMessage(draft);
    }
  };

  const handleApplyDiff = useCallback(
    async (patch: string) => {
      if (!workspace || !applyPatch) {
        alert("No workspace available. Create a workspace first.");
        return;
      }
      try {
        const result = await applyPatch({
          patch,
          conversationId: conversation?.id,
        });
        if (!result.success) {
          alert(`Failed to apply patch: ${result.errors?.join(", ")}`);
        }
      } catch {
        alert("Failed to apply patch");
      }
    },
    [workspace, applyPatch, conversation?.id]
  );

  const handleRunCommand = useCallback(
    async (command: string) => {
      if (!workspace || !execCommand) {
        alert("No workspace available. Create a workspace first.");
        return;
      }
      if (workspace.status !== "running") {
        alert("Workspace is not running. Start the preview first.");
        return;
      }
      try {
        const result = await execCommand({
          command,
          conversationId: conversation?.id,
        });
        if (result.exitCode !== 0) {
          console.error("Command failed:", result.stderr);
        }
      } catch {
        alert("Failed to execute command");
      }
    },
    [workspace, execCommand, conversation?.id]
  );

  // Determine if BUILD button should show (in Design Mode within BUILD pane)
  const showBuildButton = mode === "BUILD" && isDesignMode;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <ChatHeader
        mode={mode}
        title={isSending ? "Sending..." : title}
        conversationId={conversation?.id}
        provider={provider}
        model={model}
        conversations={allConversations}
        isLoadingConversations={isLoadingConversations}
        isDesignMode={mode === "BUILD" ? isDesignMode : undefined}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onProviderChange={handleProviderChange}
        onModelChange={handleModelChange}
        onDesignModeToggle={mode === "BUILD" ? handleDesignModeToggle : undefined}
      />

      <MessageList
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming || isSending}
        mode={mode}
        onApplyDiff={mode === "BUILD" && !isDesignMode ? handleApplyDiff : undefined}
        onRunCommand={mode === "BUILD" && !isDesignMode ? handleRunCommand : undefined}
        isApplying={isApplying}
        isExecuting={isExecuting}
        autoApplyStatus={autoApplyStatus}
      />

      {/* BUILD button - appears at bottom when in Design Mode */}
      {showBuildButton && (
        <div className="flex justify-center py-3 border-t border-border bg-card/30">
          <Button
            onClick={handleBuildClick}
            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            <Wrench className="h-4 w-4" />
            BUILD
          </Button>
        </div>
      )}

      <ChatInput
        value={draft}
        onChange={setDraft}
        onSend={handleSend}
        onCancel={cancelStream}
        isStreaming={isStreaming}
        placeholder={
          mode === "CHAT"
            ? "Ask me anything..."
            : isDesignMode
            ? "Describe what you want to design..."
            : "Tell me what to build..."
        }
      />
    </div>
  );
}
