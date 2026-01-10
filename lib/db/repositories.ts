import prisma from './prisma';
import { Mode, Provider, MessageRole, MessageStatus, WorkspaceStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';

// User repository
export const userRepo = {
  async findOrCreate(userId?: string | null) {
    if (userId) {
      const existing = await prisma.user.findUnique({
        where: { id: userId },
        include: { preferences: true },
      });
      if (existing) {
        // Update last seen
        await prisma.user.update({
          where: { id: userId },
          data: { lastSeenAt: new Date() },
        });
        return existing;
      }
    }

    // Create new user with preferences
    const newUser = await prisma.user.create({
      data: {
        preferences: {
          create: {},
        },
      },
      include: { preferences: true },
    });

    return newUser;
  },

  async getPreferences(userId: string) {
    return prisma.userPreferences.findUnique({
      where: { userId },
    });
  },

  async updatePreferences(userId: string, data: Partial<{
    theme: string;
    currentConversationIdChat: string | null;
    currentConversationIdDesign: string | null;
    currentConversationIdBuild: string | null;
    defaultProviderChat: Provider;
    defaultModelChat: string;
    defaultProviderDesign: Provider;
    defaultModelDesign: string;
    defaultProviderBuild: Provider;
    defaultModelBuild: string;
  }>) {
    return prisma.userPreferences.update({
      where: { userId },
      data,
    });
  },
};

// Conversation repository
export const conversationRepo = {
  async create(data: {
    userId: string;
    mode: Mode;
    provider: Provider;
    model: string;
    title?: string;
    workspaceId?: string;
  }) {
    return prisma.conversation.create({
      data: {
        userId: data.userId,
        mode: data.mode,
        provider: data.provider,
        model: data.model,
        title: data.title,
        workspaceId: data.workspaceId,
      },
    });
  },

  async findById(id: string) {
    return prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  },

  async findByUserAndMode(userId: string, mode: Mode) {
    return prisma.conversation.findMany({
      where: { userId, mode },
      orderBy: { updatedAt: 'desc' },
    });
  },

  async getCurrentForMode(userId: string, mode: Mode, currentId: string | null) {
    if (currentId) {
      const conversation = await prisma.conversation.findUnique({
        where: { id: currentId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
          _count: {
            select: { messages: true },
          },
        },
      });
      if (conversation && conversation.userId === userId && conversation.mode === mode) {
        return conversation;
      }
    }
    return null;
  },

  async updateTitle(id: string, title: string) {
    return prisma.conversation.update({
      where: { id },
      data: { title },
    });
  },

  async linkWorkspace(conversationId: string, workspaceId: string) {
    return prisma.conversation.update({
      where: { id: conversationId },
      data: { workspaceId },
    });
  },

  async updateProviderModel(id: string, provider: Provider, model: string) {
    return prisma.conversation.update({
      where: { id },
      data: { provider, model },
    });
  },
};

// Message repository
export const messageRepo = {
  async create(data: {
    conversationId: string;
    role: MessageRole;
    content: string;
    status?: MessageStatus;
    clientMessageId?: string;
    tokenIn?: number;
    tokenOut?: number;
    metadata?: Record<string, unknown>;
  }) {
    // Update conversation updatedAt
    await prisma.conversation.update({
      where: { id: data.conversationId },
      data: { updatedAt: new Date() },
    });

    return prisma.message.create({
      data: {
        conversationId: data.conversationId,
        role: data.role,
        content: data.content,
        status: data.status || 'complete',
        clientMessageId: data.clientMessageId,
        tokenIn: data.tokenIn,
        tokenOut: data.tokenOut,
        metadata: data.metadata,
      },
    });
  },

  async findByClientMessageId(clientMessageId: string) {
    return prisma.message.findFirst({
      where: { clientMessageId },
    });
  },

  async updateContent(id: string, content: string, status: MessageStatus = 'complete') {
    return prisma.message.update({
      where: { id },
      data: { content, status },
    });
  },

  async updateStatus(id: string, status: MessageStatus) {
    return prisma.message.update({
      where: { id },
      data: { status },
    });
  },

  async updateUsage(id: string, tokenIn: number, tokenOut: number) {
    return prisma.message.update({
      where: { id },
      data: { tokenIn, tokenOut },
    });
  },

  async getConversationMessages(conversationId: string) {
    return prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  },
};

// Workspace repository
export const workspaceRepo = {
  async create(data: {
    userId: string;
    name?: string;
    hostPath: string;
  }) {
    const workspace = await prisma.workspace.create({
      data: {
        userId: data.userId,
        name: data.name,
        hostPath: data.hostPath,
        previewUrlPath: '', // Will be set after creation
      },
    });

    // Update with preview URL path
    return prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        previewUrlPath: `/preview/${workspace.id}/`,
      },
    });
  },

  async findById(id: string) {
    return prisma.workspace.findUnique({
      where: { id },
    });
  },

  async findByUser(userId: string) {
    return prisma.workspace.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  },

  async updateStatus(id: string, status: WorkspaceStatus, containerId?: string | null, exposedPort?: number | null) {
    return prisma.workspace.update({
      where: { id },
      data: {
        status,
        containerId: containerId !== undefined ? containerId : undefined,
        exposedPort: exposedPort !== undefined ? exposedPort : undefined,
      },
    });
  },

  async updateLastCommand(id: string) {
    return prisma.workspace.update({
      where: { id },
      data: { lastCommandAt: new Date() },
    });
  },

  async delete(id: string) {
    return prisma.workspace.delete({
      where: { id },
    });
  },
};

// Workspace process repository
export const processRepo = {
  async create(data: {
    workspaceId: string;
    command: string;
    status: 'running' | 'exited' | 'failed';
  }) {
    return prisma.workspaceProcess.create({
      data: {
        workspaceId: data.workspaceId,
        command: data.command,
        status: data.status,
      },
    });
  },

  async update(id: string, data: {
    status?: 'running' | 'exited' | 'failed';
    exitCode?: number;
    outputSnippet?: string;
    endedAt?: Date;
  }) {
    return prisma.workspaceProcess.update({
      where: { id },
      data,
    });
  },

  async findByWorkspace(workspaceId: string) {
    return prisma.workspaceProcess.findMany({
      where: { workspaceId },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  },
};
