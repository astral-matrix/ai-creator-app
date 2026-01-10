import { NextRequest, NextResponse } from 'next/server';
import { userRepo, conversationRepo } from '@/lib/db/repositories';
import { Mode, Provider } from '@/lib/types';

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

    // Create new conversation
    const conversation = await conversationRepo.create({
      userId: user.id,
      mode,
      provider,
      model,
    });

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
      workspaceId: conversation.workspaceId,
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
