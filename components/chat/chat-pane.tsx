"use client";

import React, { useCallback } from "react";
import { ChatHeader } from "./chat-header";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { useChat } from "@/lib/hooks/useChat";
import { useConversation } from "@/lib/hooks/useConversation";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAppStore } from "@/lib/store";
import { Mode } from "@/lib/types";

interface ChatPaneProps {
  mode: Mode;
}

export function ChatPane({ mode }: ChatPaneProps) {
  const { setSelectedProvider, setSelectedModel, conversations } = useAppStore();
  const conversation = conversations[mode];
  
  const {
    messages,
    isStreaming,
    streamingContent,
    draft,
    setDraft,
    sendMessage,
    cancelStream,
    provider,
    model,
  } = useChat(mode);

  const { createNewChat, isCreatingChat } = useConversation(mode);

  const { execCommand, applyPatch, isExecuting, isApplying, workspace } =
    useWorkspace(conversation?.workspaceId);

  const handleNewChat = () => {
    createNewChat({ provider, model });
  };

  const handleProviderChange = (newProvider: typeof provider) => {
    setSelectedProvider(mode, newProvider);
  };

  const handleModelChange = (newModel: string) => {
    setSelectedModel(mode, newModel);
  };

  const handleSend = () => {
    if (draft.trim()) {
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
    <div className="flex flex-col h-full bg-background">
      <ChatHeader
        mode={mode}
        title={conversation?.title}
        provider={provider}
        model={model}
        onNewChat={handleNewChat}
        onProviderChange={handleProviderChange}
        onModelChange={handleModelChange}
        isCreating={isCreatingChat}
      />

      <MessageList
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
        mode={mode}
        onApplyDiff={mode === "BUILD" ? handleApplyDiff : undefined}
        onRunCommand={mode === "BUILD" ? handleRunCommand : undefined}
        isApplying={isApplying}
        isExecuting={isExecuting}
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
