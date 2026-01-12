import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Mode, Provider, ConversationWithMessages } from './types';

// Streaming state per mode
interface StreamingState {
  isStreaming: boolean;
  content: string;
}

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

  // Streaming state (per mode)
  streaming: Record<Mode, StreamingState>;
  setIsStreaming: (mode: Mode, streaming: boolean) => void;
  setStreamingContent: (mode: Mode, content: string) => void;
  appendStreamingContent: (mode: Mode, text: string) => void;

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

const initialStreamingState: Record<Mode, StreamingState> = {
  CHAT: { isStreaming: false, content: '' },
  DESIGN: { isStreaming: false, content: '' },
  BUILD: { isStreaming: false, content: '' },
};

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

      // Streaming (per mode)
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
        DESIGN: 'gemini',
        BUILD: 'gemini',
      },
      selectedModel: {
        CHAT: 'gemini-2.0-flash',
        DESIGN: 'gemini-2.0-flash',
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
