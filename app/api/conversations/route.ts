import { NextRequest, NextResponse } from 'next/server';
import { conversationRepo, userRepo } from '@/lib/db/repositories';
import { Mode } from '@/lib/types';

// GET /api/conversations?anonUserId=xxx&mode=BUILD
// Returns all conversations for a user, optionally filtered by mode
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const anonUserId = searchParams.get('anonUserId');
    const mode = searchParams.get('mode') as Mode | null;

    if (!anonUserId) {
      return NextResponse.json(
        { error: 'Missing anonUserId' },
        { status: 400 }
      );
    }

    // Verify user exists
    const user = await userRepo.findOrCreate(anonUserId);

    // Get conversations
    const conversations = await conversationRepo.findByUser(user.id, mode);

    return NextResponse.json({
      conversations: conversations.map((c) => ({
        id: c.id,
        mode: c.mode,
        title: c.title,
        provider: c.provider,
        model: c.model,
        workspaceId: c.workspaceId,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        messageCount: c._count?.messages || 0,
      })),
    });
  } catch (error) {
    console.error('List conversations error:', error);
    return NextResponse.json(
      { error: 'Failed to list conversations' },
      { status: 500 }
    );
  }
}
