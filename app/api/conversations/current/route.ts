import { NextRequest, NextResponse } from 'next/server';
import { userRepo, conversationRepo } from '@/lib/db/repositories';
import { Mode } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('mode') as Mode;
    const anonUserId = searchParams.get('anonUserId');

    if (!mode || !anonUserId) {
      return NextResponse.json(
        { error: 'Missing mode or anonUserId' },
        { status: 400 }
      );
    }

    // Get user and preferences
    const user = await userRepo.findOrCreate(anonUserId);
    const prefs = await userRepo.getPreferences(user.id);

    if (!prefs) {
      return NextResponse.json(
        { error: 'User preferences not found' },
        { status: 404 }
      );
    }

    // Get current conversation ID for mode
    const prefKey = `currentConversationId${mode.charAt(0) + mode.slice(1).toLowerCase()}` as keyof typeof prefs;
    const currentId = prefs[prefKey] as string | null;

    if (!currentId) {
      return NextResponse.json(
        { error: 'No current conversation for this mode' },
        { status: 404 }
      );
    }

    const conversation = await conversationRepo.findById(currentId);

    if (!conversation || conversation.userId !== user.id) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: conversation.id,
      mode: conversation.mode,
      title: conversation.title,
      provider: conversation.provider,
      model: conversation.model,
      workspaceId: conversation.workspaceId,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messages: conversation.messages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role,
        content: m.content,
        status: m.status,
        clientMessageId: m.clientMessageId,
        tokenIn: m.tokenIn,
        tokenOut: m.tokenOut,
        metadata: m.metadata,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Get current conversation error:', error);
    return NextResponse.json(
      { error: 'Failed to get conversation' },
      { status: 500 }
    );
  }
}
