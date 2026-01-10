import { NextRequest, NextResponse } from 'next/server';
import { conversationRepo, userRepo } from '@/lib/db/repositories';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const anonUserId = searchParams.get('anonUserId');

    if (!anonUserId) {
      return NextResponse.json(
        { error: 'Missing anonUserId' },
        { status: 400 }
      );
    }

    const conversation = await conversationRepo.findById(id);

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (conversation.userId !== anonUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
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
    console.error('Get conversation error:', error);
    return NextResponse.json(
      { error: 'Failed to get conversation' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { anonUserId, title, provider, model, workspaceId } = body;

    if (!anonUserId) {
      return NextResponse.json(
        { error: 'Missing anonUserId' },
        { status: 400 }
      );
    }

    const conversation = await conversationRepo.findById(id);

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    if (conversation.userId !== anonUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Update fields
    if (title !== undefined) {
      await conversationRepo.updateTitle(id, title);
    }

    if (provider && model) {
      await conversationRepo.updateProviderModel(id, provider, model);
    }

    if (workspaceId !== undefined) {
      await conversationRepo.linkWorkspace(id, workspaceId);
    }

    // Fetch updated conversation
    const updated = await conversationRepo.findById(id);

    return NextResponse.json({
      id: updated!.id,
      mode: updated!.mode,
      title: updated!.title,
      provider: updated!.provider,
      model: updated!.model,
      workspaceId: updated!.workspaceId,
      createdAt: updated!.createdAt.toISOString(),
      updatedAt: updated!.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Update conversation error:', error);
    return NextResponse.json(
      { error: 'Failed to update conversation' },
      { status: 500 }
    );
  }
}
