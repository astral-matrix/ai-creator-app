import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UIMode, Provider, ConversationWithMessages } from './types';

// Streaming state per UI mode
interface StreamingState {
  isStreaming: boolean;
  content: string;
}

interface AppState {
  // User
  userId: string | null;
  setUserId: (id: string) => void;

  // Mode - now uses UIMode (CHAT or BUILD only)
  activeMode: UIMode;
  setActiveMode: (mode: UIMode) => void;

  // Design Mode sub-state (within BUILD pane)
  isDesignMode: boolean;
  setIsDesignMode: (isDesign: boolean) => void;

  // Conversations per UI mode (DESIGN conversations appear under BUILD)
  conversations: Record<UIMode, ConversationWithMessages | null>;
  setConversation: (mode: UIMode, conversation: ConversationWithMessages | null) => void;

  // Streaming state (per UI mode)
  streaming: Record<UIMode, StreamingState>;
  setIsStreaming: (mode: UIMode, streaming: boolean) => void;
  setStreamingContent: (mode: UIMode, content: string) => void;
  appendStreamingContent: (mode: UIMode, text: string) => void;

  // Provider/model selection (per UI mode)
  selectedProvider: Record<UIMode, Provider>;
  selectedModel: Record<UIMode, string>;
  setSelectedProvider: (mode: UIMode, provider: Provider) => void;
  setSelectedModel: (mode: UIMode, model: string) => void;

  // UI state
  previewPanelOpen: boolean;
  setPreviewPanelOpen: (open: boolean) => void;
  logsPanelOpen: boolean;
  setLogsPanelOpen: (open: boolean) => void;

  // Drafts per UI mode
  drafts: Record<UIMode, string>;
  setDraft: (mode: UIMode, content: string) => void;
}

const initialStreamingState: Record<UIMode, StreamingState> = {
  CHAT: { isStreaming: false, content: '' },
  BUILD: { isStreaming: false, content: '' },
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // User
      userId: null,
      setUserId: (id) => set({ userId: id }),

      // Mode - defaults to CHAT
      activeMode: 'CHAT',
      setActiveMode: (mode) => set({ activeMode: mode }),

      // Design Mode sub-state
      isDesignMode: false,
      setIsDesignMode: (isDesign) => set({ isDesignMode: isDesign }),

      // Conversations (2 UI modes: CHAT and BUILD)
      conversations: {
        CHAT: null,
        BUILD: null,
      },
      setConversation: (mode, conversation) =>
        set((state) => ({
          conversations: {
            ...state.conversations,
            [mode]: conversation,
          },
        })),

      // Streaming (per UI mode)
      streaming: initialStreamingState,
      setIsStreaming: (mode, isStreaming) =>
        set((state) => ({
          streaming: {
            ...state.streaming,
            [mode]: {
              ...state.streaming[mode],
              isStreaming,
            },
          },
        })),
      setStreamingContent: (mode, content) =>
        set((state) => ({
          streaming: {
            ...state.streaming,
            [mode]: {
              ...state.streaming[mode],
              content,
            },
          },
        })),
      appendStreamingContent: (mode, text) =>
        set((state) => ({
          streaming: {
            ...state.streaming,
            [mode]: {
              ...state.streaming[mode],
              content: state.streaming[mode].content + text,
            },
          },
        })),

      // Provider/model - defaults to Gemini (free)
      selectedProvider: {
        CHAT: 'gemini',
        BUILD: 'gemini',
      },
      selectedModel: {
        CHAT: 'gemini-2.0-flash',
        BUILD: 'gemini-2.0-flash',
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
        isDesignMode: state.isDesignMode,
        selectedProvider: state.selectedProvider,
        selectedModel: state.selectedModel,
        previewPanelOpen: state.previewPanelOpen,
        drafts: state.drafts,
      }),
    }
  )
);
