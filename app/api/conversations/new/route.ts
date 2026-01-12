import { NextRequest, NextResponse } from 'next/server';
import { userRepo, conversationRepo, workspaceRepo } from '@/lib/db/repositories';
import { Mode, Provider } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

const WORKSPACE_HOST_PATH = process.env.WORKSPACE_HOST_PATH || '/tmp/ai-creator-workspaces';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { anonUserId, mode, provider, model } = body as {
      anonUserId: string;
      mode: Mode;
      provider: Provider;
      model: string;
    };

    if (!anonUserId || !mode || !provider || !model) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify user exists
    const user = await userRepo.findOrCreate(anonUserId);

    // Create new conversation (title will be set on first message)
    const conversation = await conversationRepo.create({
      userId: user.id,
      mode,
      provider,
      model,
    });

    let workspaceId: string | null = null;

    // For BUILD mode, automatically create a workspace
    if (mode === 'BUILD') {
      const workspaceUuid = uuidv4();
      const hostPath = path.join(WORKSPACE_HOST_PATH, workspaceUuid);

      // Create workspace directory on host
      fs.mkdirSync(hostPath, { recursive: true });

      // Create workspace in database (this also sets the correct previewUrlPath)
      const workspace = await workspaceRepo.create({
        userId: user.id,
        name: 'New Project',
        hostPath,
      });

      // Link workspace to conversation
      await conversationRepo.linkWorkspace(conversation.id, workspace.id);

      workspaceId = workspace.id;
    }

    // Update user preferences to set this as current conversation for the mode
    const prefKey = `currentConversationId${mode.charAt(0) + mode.slice(1).toLowerCase()}`;
    await userRepo.updatePreferences(user.id, {
      [prefKey]: conversation.id,
    } as any);

    return NextResponse.json({
      id: conversation.id,
      mode: conversation.mode,
      title: conversation.title,
      provider: conversation.provider,
      model: conversation.model,
      workspaceId: workspaceId,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messageCount: 0,
      messages: [],
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
