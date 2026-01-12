"use client";

import React, { useCallback, useState } from "react";
import { ChatHeader } from "./chat-header";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { useChat } from "@/lib/hooks/useChat";
import { useConversation } from "@/lib/hooks/useConversation";
import { useConversations } from "@/lib/hooks/useConversations";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAppStore } from "@/lib/store";
import { Mode } from "@/lib/types";
import { extractAllDiffPatches, extractAllCommands } from "@/lib/rendering/block-parser";

interface ChatPaneProps {
  mode: Mode;
}

export function ChatPane({ mode }: ChatPaneProps) {
  const { setSelectedProvider, setSelectedModel, conversations } = useAppStore();
  const conversation = conversations[mode];
  const [autoApplyStatus, setAutoApplyStatus] = useState<string | null>(null);

  const { 
    execCommand, 
    applyPatch, 
    isExecuting, 
    isApplying, 
    workspace, 
    startDaemon,
    startWorkspace,
    refetch: refetchWorkspace,
  } = useWorkspace(conversation?.workspaceId);

  // Auto-apply diffs and run commands when AI finishes in BUILD mode
  const handleStreamComplete = useCallback(
    async (content: string) => {
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
            conversationId: conversation?.id,
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
            // Match: node app.js, npm start, npm run dev, python server.py, etc.
            const isServerCommand = 
              /^node\s+\S+\.js/.test(cmd) ||  // node something.js
              /^npm\s+(start|run\s+(dev|start|server))/.test(cmd) ||  // npm start, npm run dev
              /^npx\s+(serve|http-server)/.test(cmd) ||  // npx serve
              /^python\s+.*server/.test(cmd) ||  // python server.py
              /^(http-server|serve)\b/.test(cmd);  // http-server, serve
            
            if (isServerCommand) {
              // Start as daemon for server commands
              try {
                await startDaemon({
                  daemonId: `server-${Date.now()}`,
                  command: cmd,
                });
                setAutoApplyStatus("Server started as background process");
              } catch (err) {
                console.error("Failed to start daemon:", err);
                // Fall back to regular exec
                await execCommand({ command: cmd, conversationId: conversation?.id });
              }
            } else {
              // Regular command execution
              const result = await execCommand({
                command: cmd,
                conversationId: conversation?.id,
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
        
        // Clear status after a delay
        setTimeout(() => setAutoApplyStatus(null), 3000);
      } catch (error) {
        console.error("Auto-apply error:", error);
        setAutoApplyStatus("Error applying changes");
        setTimeout(() => setAutoApplyStatus(null), 3000);
      }
    },
    [mode, workspace, applyPatch, execCommand, startDaemon, startWorkspace, refetchWorkspace, conversation?.id]
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
  } = useChat(mode, { onStreamComplete: handleStreamComplete });

  const { startNewChat } = useConversation(mode);
  const { conversations: allConversations, isLoading: isLoadingConversations, selectConversation } = useConversations(mode);

  const handleNewChat = () => {
    startNewChat();
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

  const handleSend = async () => {
    if (draft.trim()) {
      // Auto-start workspace in BUILD mode when first message is sent
      if (mode === "BUILD" && workspace && workspace.status !== "running") {
        setAutoApplyStatus("Starting workspace...");
        try {
          startWorkspace();
          // Don't wait - let it start in background while message is sent
        } catch (err) {
          console.error("Failed to auto-start workspace:", err);
        }
      }
      sendMessage(draft);
    }
  };

  const handleApplyDiff = useCallback(
    async (patch: string) => {
      if (!workspace) {
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
      } catch (error) {
        alert("Failed to apply patch");
      }
    },
    [workspace, applyPatch, conversation?.id]
  );

  const handleRunCommand = useCallback(
    async (command: string) => {
      if (!workspace) {
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
      } catch (error) {
        alert("Failed to execute command");
      }
    },
    [workspace, execCommand, conversation?.id]
  );

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
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onProviderChange={handleProviderChange}
        onModelChange={handleModelChange}
      />

      <MessageList
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming || isSending}
        mode={mode}
        onApplyDiff={mode === "BUILD" ? handleApplyDiff : undefined}
        onRunCommand={mode === "BUILD" ? handleRunCommand : undefined}
        isApplying={isApplying}
        isExecuting={isExecuting}
        autoApplyStatus={autoApplyStatus}
      />

      <ChatInput
        value={draft}
        onChange={setDraft}
        onSend={handleSend}
        onCancel={cancelStream}
        isStreaming={isStreaming}
        placeholder={
          mode === "CHAT"
            ? "Ask me anything..."
            : mode === "DESIGN"
            ? "Describe what you want to design..."
            : "Tell me what to build..."
        }
      />
    </div>
  );
}
