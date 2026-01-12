import { NextRequest, NextResponse } from 'next/server';
import { userRepo, conversationRepo } from '@/lib/db/repositories';
import { Mode, Provider, MODE_DEFAULTS, BootstrapResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { anonUserId } = body as { anonUserId?: string };

    // Find or create user
    const user = await userRepo.findOrCreate(anonUserId);
    const prefs = user.preferences!;

    // Ensure current conversations exist for each mode
    const modes: Mode[] = ['CHAT', 'DESIGN', 'BUILD'];
    const conversations: Record<string, any> = {};
    const updatedPrefs: Record<string, string> = {};

    for (const mode of modes) {
      const prefKey = `currentConversationId${mode.charAt(0) + mode.slice(1).toLowerCase()}` as keyof typeof prefs;
      const currentId = prefs[prefKey] as string | null;

      let conversation = await conversationRepo.getCurrentForMode(user.id, mode, currentId);

      if (!conversation) {
        // Create a new conversation for this mode
        const defaults = MODE_DEFAULTS[mode];
        const providerKey = `defaultProvider${mode.charAt(0) + mode.slice(1).toLowerCase()}` as keyof typeof prefs;
        const modelKey = `defaultModel${mode.charAt(0) + mode.slice(1).toLowerCase()}` as keyof typeof prefs;

        const provider = (prefs[providerKey] as Provider) || defaults.provider;
        const model = (prefs[modelKey] as string) || defaults.model;

        conversation = await conversationRepo.create({
          userId: user.id,
          mode,
          provider,
          model,
        }) as any;

        // Update preference with new conversation ID
        updatedPrefs[prefKey] = conversation!.id;
      }

      conversations[mode.toLowerCase()] = conversation ? {
        id: conversation.id,
        mode: conversation.mode,
        title: conversation.title,
        provider: conversation.provider,
        model: conversation.model,
        workspaceId: conversation.workspaceId,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
        messageCount: (conversation as any)._count?.messages || 0,
      } : null;
    }

    // Update preferences if any new conversations were created
    if (Object.keys(updatedPrefs).length > 0) {
      await userRepo.updatePreferences(user.id, updatedPrefs as any);
    }

    const response: BootstrapResponse = {
      userId: user.id,
      preferences: {
        theme: prefs.theme,
        currentConversationIdChat: updatedPrefs.currentConversationIdChat || prefs.currentConversationIdChat,
        currentConversationIdDesign: updatedPrefs.currentConversationIdDesign || prefs.currentConversationIdDesign,
        currentConversationIdBuild: updatedPrefs.currentConversationIdBuild || prefs.currentConversationIdBuild,
        defaultProviderChat: prefs.defaultProviderChat as Provider,
        defaultModelChat: prefs.defaultModelChat,
        defaultProviderDesign: prefs.defaultProviderDesign as Provider,
        defaultModelDesign: prefs.defaultModelDesign,
        defaultProviderBuild: prefs.defaultProviderBuild as Provider,
        defaultModelBuild: prefs.defaultModelBuild,
      },
      conversations: {
        chat: conversations.chat,
        design: conversations.design,
        build: conversations.build,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Bootstrap error:', error);
    return NextResponse.json(
      { error: 'Failed to bootstrap user' },
      { status: 500 }
    );
  }
}

// PUT /api/bootstrap - Update user preferences
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { anonUserId, preferences } = body as {
      anonUserId: string;
      preferences: Record<string, unknown>;
    };

    if (!anonUserId) {
      return NextResponse.json(
        { error: 'Missing anonUserId' },
        { status: 400 }
      );
    }

    // Find user
    const user = await userRepo.findOrCreate(anonUserId);

    // Update preferences
    await userRepo.updatePreferences(user.id, preferences as any);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update preferences error:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}
