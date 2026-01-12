# State Management Architecture

This document describes the state management architecture for the AI Creator App, including the design decisions, data flow, and guidelines for extending the system.

## Overview

The application uses a hybrid state management approach:

1. **Zustand** - For global UI state and per-mode state that needs to persist across component unmounts
2. **React Query** - For server state (conversations, workspaces, daemons)
3. **Local React State** - For ephemeral UI state within components

## Architecture Diagram

```mermaid
flowchart TD
    subgraph GlobalState [Global State - Zustand]
        UserId[userId]
        ActiveMode[activeMode]
    end

    subgraph PerModeState [Per-Mode State - Zustand]
        ChatConv[conversations.CHAT]
        DesignConv[conversations.DESIGN]
        BuildConv[conversations.BUILD]
        
        ChatStream[streaming.CHAT]
        DesignStream[streaming.DESIGN]
        BuildStream[streaming.BUILD]
        
        ChatDraft[drafts.CHAT]
        DesignDraft[drafts.DESIGN]
        BuildDraft[drafts.BUILD]
        
        ChatProvider[selectedProvider.CHAT]
        DesignProvider[selectedProvider.DESIGN]
        BuildProvider[selectedProvider.BUILD]
    end

    subgraph ServerState [Server State - React Query]
        ConversationQuery[useConversation]
        ConversationsQuery[useConversations]
        WorkspaceQuery[useWorkspace]
        DaemonsQuery[daemons query]
    end

    subgraph UIComponents [UI Components]
        ChatPane[ChatPane]
        PreviewPane[PreviewPane]
        ChatHeader[ChatHeader]
    end

    GlobalState --> UIComponents
    PerModeState --> UIComponents
    ServerState --> UIComponents
```

## State Definitions

### Global State (Shared Across All Modes)

| State | Type | Description |
|-------|------|-------------|
| `userId` | `string \| null` | Anonymous user identifier |
| `activeMode` | `Mode` | Currently active tab (CHAT, DESIGN, BUILD) |
| `previewPanelOpen` | `boolean` | Whether preview panel is visible |
| `logsPanelOpen` | `boolean` | Whether logs panel is expanded |

### Per-Mode State (Isolated Per Mode)

| State | Type | Description |
|-------|------|-------------|
| `conversations[mode]` | `ConversationWithMessages \| null` | Current conversation for each mode |
| `streaming[mode]` | `{ isStreaming: boolean; content: string }` | Streaming state per mode |
| `drafts[mode]` | `string` | Unsent message draft per mode |
| `selectedProvider[mode]` | `Provider` | Selected AI provider per mode |
| `selectedModel[mode]` | `string` | Selected AI model per mode |

### Server State (React Query)

| Query | Scope | Description |
|-------|-------|-------------|
| `['conversation', mode]` | Per-mode | Fetches current conversation for mode |
| `['conversations', mode]` | Per-mode | Lists all conversations for mode |
| `['workspace', workspaceId]` | BUILD only | Fetches workspace data |
| `['daemons', workspaceId]` | BUILD only | Lists running daemon processes |

## Data Flow

### Mode Switching Flow

```mermaid
sequenceDiagram
    participant User
    participant ModeTabs
    participant Store
    participant ChatPane
    participant useConversation

    User->>ModeTabs: Click mode tab
    ModeTabs->>Store: setActiveMode(newMode)
    Store-->>ChatPane: Re-render with new mode
    ChatPane->>useConversation: Initialize for new mode
    useConversation->>Store: Access conversations[newMode]
    useConversation-->>ChatPane: Return mode-specific data
```

### Message Sending Flow (New Conversation)

```mermaid
sequenceDiagram
    participant User
    participant ChatPane
    participant useChat
    participant StreamAPI
    participant Store

    User->>ChatPane: Type message & send
    ChatPane->>useChat: sendMessage(content)
    useChat->>Store: setIsStreaming(mode, true)
    useChat->>StreamAPI: POST /api/chat/stream
    StreamAPI-->>useChat: meta event (conversationId, title)
    useChat->>Store: setConversation(mode, newConv)
    StreamAPI-->>useChat: text events
    useChat->>Store: appendStreamingContent(mode, text)
    StreamAPI-->>useChat: done
    useChat->>Store: setIsStreaming(mode, false)
```

### BUILD Mode Workspace Flow

```mermaid
sequenceDiagram
    participant ChatPane
    participant useBuildModeWorkspace
    participant useWorkspace
    participant ReactQuery

    ChatPane->>useBuildModeWorkspace: Initialize
    Note over useBuildModeWorkspace: Check if mode === BUILD
    alt BUILD mode
        useBuildModeWorkspace->>useWorkspace: Fetch workspace data
        useWorkspace->>ReactQuery: query(['workspace', id])
        ReactQuery-->>useWorkspace: workspace data
        useWorkspace-->>useBuildModeWorkspace: workspace, mutations
    else Other modes
        useBuildModeWorkspace-->>ChatPane: null workspace, no-op functions
    end
```

## Mode Isolation

The key architectural decision is **mode isolation**. Each mode operates independently:

### Streaming Isolation

Previously, streaming state was global:
```typescript
// ❌ Old - Global streaming (caused cross-mode leaks)
isStreaming: boolean;
streamingContent: string;
```

Now, streaming state is per-mode:
```typescript
// ✅ New - Per-mode streaming
streaming: Record<Mode, { isStreaming: boolean; content: string }>;
```

### Workspace Isolation

Workspaces are only relevant to BUILD mode:

```typescript
// In ChatPane
function useBuildModeWorkspace(mode: Mode, workspaceId?: string | null) {
  // Only fetch workspace data for BUILD mode
  const workspaceHook = useWorkspace(mode === "BUILD" ? workspaceId : null);
  
  // Return null/no-op for non-BUILD modes
  return {
    workspace: mode === "BUILD" ? workspace : null,
    // ... other properties
  };
}
```

## Persistence Strategy

The following state is persisted to `localStorage` via Zustand's `persist` middleware:

| State | Persisted | Reason |
|-------|-----------|--------|
| `userId` | ✅ | Maintain user identity across sessions |
| `activeMode` | ✅ | Remember last used mode |
| `selectedProvider` | ✅ | Remember AI preferences |
| `selectedModel` | ✅ | Remember AI preferences |
| `previewPanelOpen` | ✅ | Remember UI layout |
| `drafts` | ✅ | Preserve unsent messages |
| `conversations` | ❌ | Fetched from server on load |
| `streaming` | ❌ | Ephemeral, reset on page load |

## Guidelines for Adding New State

### 1. Determine the Scope

Ask: "Is this state specific to a mode, or shared across all modes?"

- **Per-mode**: Add to the `Record<Mode, T>` pattern
- **Global**: Add as a simple property

### 2. Determine the Source

Ask: "Is this state from the server, or purely client-side?"

- **Server state**: Use React Query
- **Client state**: Use Zustand or local React state

### 3. Determine Persistence

Ask: "Should this state survive a page refresh?"

- **Yes**: Add to `partialize` in the Zustand store
- **No**: Keep outside `partialize`

### 4. Example: Adding a New Per-Mode Feature

```typescript
// 1. Add to store interface
interface AppState {
  // ... existing state
  newFeature: Record<Mode, NewFeatureState>;
  setNewFeature: (mode: Mode, value: NewFeatureState) => void;
}

// 2. Initialize with defaults for all modes
newFeature: {
  CHAT: defaultValue,
  DESIGN: defaultValue,
  BUILD: defaultValue,
},

// 3. Create mode-aware setter
setNewFeature: (mode, value) =>
  set((state) => ({
    newFeature: {
      ...state.newFeature,
      [mode]: value,
    },
  })),

// 4. Access in component
const { newFeature } = useAppStore();
const currentValue = newFeature[mode];
```

## File Structure

```
lib/
├── store.ts              # Zustand store definition
├── hooks/
│   ├── useBootstrap.ts   # Initial app setup
│   ├── useChat.ts        # Chat messaging (per-mode)
│   ├── useConversation.ts # Single conversation management
│   ├── useConversations.ts # Conversation list
│   └── useWorkspace.ts   # Workspace management (BUILD only)
└── types.ts              # Type definitions
```

## Testing Mode Isolation

To verify mode isolation is working:

1. **Streaming Test**: Start a message in BUILD mode, switch to CHAT mode. The streaming indicator should not appear in CHAT mode.

2. **Workspace Test**: The preview pane should only appear in BUILD mode. No workspace-related UI should appear in CHAT or DESIGN modes.

3. **Draft Test**: Type a message in CHAT mode, switch to BUILD mode. The draft should be preserved per-mode.

4. **Conversation Test**: Each mode maintains its own conversation history independently.
