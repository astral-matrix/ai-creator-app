import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Mode, Provider, ConversationWithMessages, WorkspaceData } from './types';

interface AppState {
  // User
  userId: string | null;
  setUserId: (id: string) => void;

  // Mode
  activeMode: Mode;
  setActiveMode: (mode: Mode) => void;

  // Conversations per mode
  conversations: Record<Mode, ConversationWithMessages | null>;
  setConversation: (mode: Mode, conversation: ConversationWithMessages | null) => void;

  // Streaming state
  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;
  streamingContent: string;
  setStreamingContent: (content: string) => void;
  appendStreamingContent: (text: string) => void;

  // Workspace
  currentWorkspace: WorkspaceData | null;
  setCurrentWorkspace: (workspace: WorkspaceData | null) => void;

  // Provider/model selection (per mode)
  selectedProvider: Record<Mode, Provider>;
  selectedModel: Record<Mode, string>;
  setSelectedProvider: (mode: Mode, provider: Provider) => void;
  setSelectedModel: (mode: Mode, model: string) => void;

  // UI state
  previewPanelOpen: boolean;
  setPreviewPanelOpen: (open: boolean) => void;
  logsPanelOpen: boolean;
  setLogsPanelOpen: (open: boolean) => void;

  // Drafts per mode
  drafts: Record<Mode, string>;
  setDraft: (mode: Mode, content: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // User
      userId: null,
      setUserId: (id) => set({ userId: id }),

      // Mode
      activeMode: 'CHAT',
      setActiveMode: (mode) => set({ activeMode: mode }),

      // Conversations
      conversations: {
        CHAT: null,
        DESIGN: null,
        BUILD: null,
      },
      setConversation: (mode, conversation) =>
        set((state) => ({
          conversations: {
            ...state.conversations,
            [mode]: conversation,
          },
        })),

      // Streaming
      isStreaming: false,
      setIsStreaming: (streaming) => set({ isStreaming: streaming }),
      streamingContent: '',
      setStreamingContent: (content) => set({ streamingContent: content }),
      appendStreamingContent: (text) =>
        set((state) => ({ streamingContent: state.streamingContent + text })),

      // Workspace
      currentWorkspace: null,
      setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),

      // Provider/model
      selectedProvider: {
        CHAT: 'openai',
        DESIGN: 'openai',
        BUILD: 'anthropic',
      },
      selectedModel: {
        CHAT: 'gpt-5.2',
        DESIGN: 'gpt-5.2-thinking',
        BUILD: 'opus-4.5-high',
      },
      setSelectedProvider: (mode, provider) =>
        set((state) => ({
          selectedProvider: {
            ...state.selectedProvider,
            [mode]: provider,
          },
        })),
      setSelectedModel: (mode, model) =>
        set((state) => ({
          selectedModel: {
            ...state.selectedModel,
            [mode]: model,
          },
        })),

      // UI state
      previewPanelOpen: true,
      setPreviewPanelOpen: (open) => set({ previewPanelOpen: open }),
      logsPanelOpen: false,
      setLogsPanelOpen: (open) => set({ logsPanelOpen: open }),

      // Drafts
      drafts: {
        CHAT: '',
        DESIGN: '',
        BUILD: '',
      },
      setDraft: (mode, content) =>
        set((state) => ({
          drafts: {
            ...state.drafts,
            [mode]: content,
          },
        })),
    }),
    {
      name: 'ai-creator-storage',
      partialize: (state) => ({
        userId: state.userId,
        activeMode: state.activeMode,
        selectedProvider: state.selectedProvider,
        selectedModel: state.selectedModel,
        previewPanelOpen: state.previewPanelOpen,
        drafts: state.drafts,
      }),
    }
  )
);
